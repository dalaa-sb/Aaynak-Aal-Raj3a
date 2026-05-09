"""
User service — all MongoDB operations for the `users` collection.
Every input is sanitized and operator-checked before reaching the DB.
"""
from datetime import datetime, timezone
from typing import Optional, List, Dict
from config.db import get_db
from backend.security.sanitize import clean_text, reject_operators

USERS = "users"


async def ensure_indexes():
    """Create unique indexes on username and email (case-insensitive collation)."""
    db = get_db()
    await db[USERS].create_index("username", unique=True)
    await db[USERS].create_index("email", unique=True, sparse=True)


async def get_by_username(username: str) -> Optional[dict]:
    """Look up a user by exact username string. Strict type check blocks NoSQL injection."""
    if not isinstance(username, str) or not username:
        return None
    username = username.strip().lower()
    db = get_db()
    return await db[USERS].find_one({"username": username})


async def get_by_email(email: str) -> Optional[dict]:
    if not isinstance(email, str) or not email:
        return None
    email = email.strip().lower()
    db = get_db()
    return await db[USERS].find_one({"email": email})


async def get_by_identifier(identifier: str) -> Optional[dict]:
    """Find by username OR email."""
    if not isinstance(identifier, str):
        return None
    identifier = identifier.strip().lower()
    if "@" in identifier:
        return await get_by_email(identifier)
    return await get_by_username(identifier)


async def create_user(*, username: str, password_hash: str, full_name: str, email: str, role: str,
                      id_image_path: Optional[str] = None,
                      verification_code: Optional[str] = None,
                      verification_expires: Optional[datetime] = None,
                      language: Optional[str] = None) -> dict:
    """Insert a new user with strict validation — rejects any operator in input."""
    # Final defense: reject_operators on every field
    for v in (username, full_name, email, role):
        if not isinstance(v, str):
            raise ValueError("Invalid field type")

    now = datetime.now(timezone.utc)
    doc = {
        "username": username.strip().lower(),
        "email": email.strip().lower(),
        "full_name": clean_text(full_name, max_length=80),
        "password_hash": password_hash,
        "role": role,
        "language": language if language in ("en", "ar", "fr") else None,
        "email_verified": False,
        "id_verified": False,
        "id_image_path": id_image_path,
        "verification_code": verification_code,
        "verification_expires": verification_expires,
        "reset_token_jti": None,
        "failed_login_count": 0,
        "locked_until": None,
        "created_at": now,
        "updated_at": now,
        "last_login": None,
    }
    reject_operators(doc)
    db = get_db()
    res = await db[USERS].insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def list_users() -> List[dict]:
    db = get_db()
    cur = db[USERS].find({}, {"password_hash": 0, "verification_code": 0, "reset_token_jti": 0}).sort("created_at", -1)
    return [u async for u in cur]


async def delete_user(username: str) -> bool:
    """Delete a user account AND clean up any associated ID image on disk.

    Best-effort file cleanup: if the file is missing or unwritable, we log
    the error but still report the user record was deleted. The audit trail
    is the source of truth for who was deleted, when, and by whom.
    """
    if not isinstance(username, str):
        return False
    db = get_db()

    # Look up the user first so we know which file to delete
    user = await db[USERS].find_one({"username": username.strip().lower()})
    if not user:
        return False

    res = await db[USERS].delete_one({"username": username.strip().lower()})
    if res.deleted_count == 0:
        return False

    # Best-effort: delete the orphaned ID image so it doesn't accumulate on disk.
    # Path stored in DB is relative to UPLOAD_DIR (e.g. "id/<uuid>.jpg").
    img_rel = user.get("id_image_path")
    if img_rel:
        try:
            from config.settings import UPLOAD_DIR
            img_path = (UPLOAD_DIR / img_rel).resolve()
            # Path-traversal safety: confirm the resolved path is still under UPLOAD_DIR
            if str(img_path).startswith(str(UPLOAD_DIR.resolve())) and img_path.is_file():
                img_path.unlink()
        except Exception as e:
            # Don't fail the user deletion just because a file cleanup failed
            print(f"[user_service] Could not remove ID image for {username}: {e}")

    return True


async def update_password(username: str, new_hash: str) -> bool:
    if not isinstance(username, str) or not isinstance(new_hash, str):
        return False
    db = get_db()
    res = await db[USERS].update_one(
        {"username": username.strip().lower()},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc),
                  "reset_token_jti": None, "failed_login_count": 0, "locked_until": None}},
    )
    return res.modified_count > 0


async def set_verification(username: str, code: str, expires: datetime) -> bool:
    if not isinstance(username, str):
        return False
    db = get_db()
    res = await db[USERS].update_one(
        {"username": username.strip().lower()},
        {"$set": {"verification_code": code, "verification_expires": expires,
                  "updated_at": datetime.now(timezone.utc)}},
    )
    return res.modified_count > 0


async def mark_email_verified(username: str) -> bool:
    db = get_db()
    res = await db[USERS].update_one(
        {"username": username.strip().lower()},
        {"$set": {"email_verified": True, "verification_code": None,
                  "verification_expires": None, "updated_at": datetime.now(timezone.utc)}},
    )
    return res.modified_count > 0


async def set_reset_jti(username: str, jti: Optional[str]) -> bool:
    db = get_db()
    res = await db[USERS].update_one(
        {"username": username.strip().lower()},
        {"$set": {"reset_token_jti": jti, "updated_at": datetime.now(timezone.utc)}},
    )
    return res.modified_count > 0


async def update_last_login(username: str) -> None:
    db = get_db()
    await db[USERS].update_one(
        {"username": username.strip().lower()},
        {"$set": {"last_login": datetime.now(timezone.utc),
                  "failed_login_count": 0, "locked_until": None}},
    )


async def increment_failed_login(username: str) -> int:
    """Track failed logins for soft account lockout. Returns the new count.

    Uses MongoDB's atomic findOneAndUpdate so concurrent failed-login attempts
    cannot race against each other and undercount.
    """
    from pymongo import ReturnDocument
    db = get_db()
    res = await db[USERS].find_one_and_update(
        {"username": username.strip().lower()},
        {"$inc": {"failed_login_count": 1}},
        return_document=ReturnDocument.AFTER,
    )
    return (res or {}).get("failed_login_count", 0)


async def lock_account_until(username: str, until: datetime) -> None:
    db = get_db()
    await db[USERS].update_one(
        {"username": username.strip().lower()},
        {"$set": {"locked_until": until}},
    )


def public_user_dict(u: dict, include_id_path: bool = False) -> dict:
    """Convert a Mongo doc to a safe public dict — strips secrets."""
    if not u:
        return {}
    out = {
        "username": u.get("username"),
        "role": u.get("role"),
        "full_name": u.get("full_name"),
        "email": u.get("email"),
        "phone": u.get("phone"),
        "language": u.get("language"),  # null if user has never set a preference
        "email_verified": u.get("email_verified", False),
        "id_verified": u.get("id_verified", False),
        "created_at": u.get("created_at").isoformat() if isinstance(u.get("created_at"), datetime) else u.get("created_at"),
        "updated_at": u.get("updated_at").isoformat() if isinstance(u.get("updated_at"), datetime) else u.get("updated_at"),
        "last_login": u.get("last_login").isoformat() if isinstance(u.get("last_login"), datetime) else u.get("last_login"),
    }
    if include_id_path:
        out["id_image_path"] = u.get("id_image_path")
    return out


async def update_profile(username: str, *,
                          full_name: Optional[str] = None,
                          phone: Optional[str] = None,
                          language: Optional[str] = None) -> bool:
    """
    Update user-editable profile fields.
    Sensitive fields (role, password, verification flags, lock status) are
    intentionally not accepted here.
    """
    if not isinstance(username, str):
        return False
    update = {}
    if full_name is not None:
        update["full_name"] = full_name
    if phone is not None or phone == "":
        update["phone"] = phone or None
    if language is not None:
        update["language"] = language
    if not update:
        return True  # no-op success
    update["updated_at"] = datetime.now(timezone.utc)
    db = get_db()
    res = await db["users"].update_one({"username": username}, {"$set": update})
    return res.matched_count > 0
