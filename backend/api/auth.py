"""
Auth routes — secure implementation.
* bcrypt password hashing
* JWT bearer tokens with expiration
* MongoDB-backed user store
* Per-IP rate limiting on sensitive endpoints
* Strict input validation (Pydantic + sanitization)
* ID image upload with type/size validation
* Email verification flow
* Token-based password reset (15 min, single-use)
* Admin-only operations enforced via JWT role claim (frontend cannot spoof)
"""
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request, status
from fastapi.responses import FileResponse

from backend.models.schemas import (
    LoginRequest, LoginResponse,
    SignupResponse,
    VerifyEmailRequest, ResendVerificationRequest,
    ForgotPasswordRequest, AdminResetRequest, ConfirmResetRequest,
    ProfileUpdateRequest,
)
from backend.security.passwords import hash_password, verify_password, needs_rehash
from backend.security.tokens import (
    create_session_token, create_reset_token, decode_token, generate_verification_code,
)
from backend.security.deps import get_current_session, require_admin
from backend.security.sanitize import clean_text, safe_filename, reject_operators
from backend.security.rate_limit import limiter
from backend.services import user_service
from backend.services import audit_service
from config.settings import (
    UserRole, SELF_SIGNUP_ROLES,
    ID_UPLOAD_DIR, MAX_UPLOAD_SIZE_BYTES, ALLOWED_IMAGE_TYPES, ALLOWED_IMAGE_EXTENSIONS,
    DEV_PRINT_VERIFICATION_CODES, VERIFICATION_CODE_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ─── Helpers ──────────────────────────────────────────────
MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15


def _send_verification_email(email: str, code: str):
    """
    Production: integrate SMTP/SendGrid/SES here.
    Dev: print code to console (configured by DEV_PRINT_VERIFICATION_CODES).
    """
    if DEV_PRINT_VERIFICATION_CODES:
        print(f"[VERIFICATION] To: {email} — Code: {code} (valid {VERIFICATION_CODE_EXPIRE_MINUTES} min)")


def _send_reset_email(email: str, token: str):
    """Same idea — replace with real email in production."""
    if DEV_PRINT_VERIFICATION_CODES:
        print(f"[PASSWORD RESET] To: {email} — Token: {token}")


def _validate_image_upload(file: UploadFile, content: bytes):
    """
    Verify the upload is a real image of allowed type/size.
    Defense-in-depth: explicit denylist + extension allowlist + MIME allowlist
    + magic-byte check + actual Pillow decode.
    """
    # Explicit denylist of types that are never accepted (covers XXE / SSRF / RCE
    # vectors even if a future change accidentally relaxes the allowlist).
    DENIED_MIME = {
        "image/svg+xml", "application/xml", "text/xml", "text/html",
        "application/javascript", "text/javascript",
        "application/x-msdownload", "application/x-bat", "application/x-sh",
        "application/x-php", "application/x-httpd-php",
        "application/zip", "application/x-rar-compressed",
        "application/pdf", "application/octet-stream",
    }
    DENIED_EXT = {
        ".svg", ".xml", ".html", ".htm", ".js", ".php", ".phtml",
        ".exe", ".bat", ".sh", ".cmd", ".ps1", ".jar", ".com",
        ".zip", ".rar", ".7z", ".tar", ".gz",
        ".pdf", ".dll", ".vbs", ".jsp",
    }

    if file.content_type and file.content_type.lower() in DENIED_MIME:
        raise HTTPException(status_code=400, detail="File type is not allowed")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images are allowed")

    # Filename safety: reject path-traversal attempts and dangerous extensions.
    raw_name = file.filename or ""
    if any(c in raw_name for c in ("/", "\\", "\x00")) or raw_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid filename")
    ext = Path(raw_name).suffix.lower()
    if ext in DENIED_EXT:
        raise HTTPException(status_code=400, detail="File extension is not allowed")
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file extension")

    if len(content) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB)")

    if len(content) < 100:
        raise HTTPException(status_code=400, detail="File appears to be empty or corrupt")

    # Reject obvious script/markup content even if MIME claimed image
    head = content[:512].lower()
    for marker in (b"<?xml", b"<!doctype", b"<svg", b"<html", b"<script", b"#!/"):
        if marker in head:
            raise HTTPException(status_code=400, detail="File content does not match an image format")

    # Magic byte check — the content must actually be an image
    magic_jpeg = content[:3] == b"\xff\xd8\xff"
    magic_png = content[:8] == b"\x89PNG\r\n\x1a\n"
    magic_webp = content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    if not (magic_jpeg or magic_png or magic_webp):
        raise HTTPException(status_code=400, detail="File content does not match an image format")

    # Confirm Pillow can decode (catches polyglot files / malformed images)
    try:
        from io import BytesIO
        from PIL import Image
        img = Image.open(BytesIO(content))
        img.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupt image file")


# ─── SIGNUP (with ID upload) ─────────────────────────────
@router.post("/signup", response_model=SignupResponse)
@limiter.limit("5/minute")
async def signup(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
    role: str = Form(...),
    language: str = Form(None),
    id_image: UploadFile = File(...),
):
    # 1. Validate inputs through schema (does sanitization + format checks)
    from backend.models.schemas import SignupRequest
    try:
        req = SignupRequest(
            username=username, password=password, full_name=full_name,
            email=email, role=role,
            language=language if language in ("en", "ar", "fr") else None,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    # 2. Role whitelist (defense-in-depth — Pydantic Literal already restricts)
    if req.role not in SELF_SIGNUP_ROLES:
        raise HTTPException(status_code=403, detail="Invalid role")

    # 3. Username & email uniqueness
    if await user_service.get_by_username(req.username):
        raise HTTPException(status_code=409, detail="Username already taken")
    if await user_service.get_by_email(req.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    # 4. ID image upload validation
    content = await id_image.read()
    _validate_image_upload(id_image, content)

    import uuid
    ext = Path(id_image.filename).suffix.lower()
    new_filename = f"{req.username}_{uuid.uuid4().hex[:12]}{ext}"
    new_filename = safe_filename(new_filename)
    save_path = ID_UPLOAD_DIR / new_filename
    save_path.write_bytes(content)
    relative_path = f"id/{new_filename}"  # stored relative — never expose absolute

    # 5. Hash password + generate email verification code
    pw_hash = hash_password(req.password)
    code = generate_verification_code()
    expires = datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_CODE_EXPIRE_MINUTES)

    # 6. Create user
    try:
        await user_service.create_user(
            username=req.username,
            password_hash=pw_hash,
            full_name=req.full_name,
            email=req.email,
            role=req.role,
            id_image_path=relative_path,
            verification_code=code,
            verification_expires=expires,
            language=req.language,
        )
    except Exception as e:
        # Clean up the uploaded file if DB insert fails
        try: save_path.unlink(missing_ok=True)
        except Exception: pass
        raise HTTPException(status_code=500, detail=f"Could not create account: {e}")

    # 7. Send verification code (dev: print to console)
    _send_verification_email(req.email, code)

    await audit_service.log_action(
        action="user.signup",
        actor_username=req.username, actor_role=req.role,
        target_type="user", target_id=req.username,
        metadata={"role": req.role, "has_id_image": True}, request=request,
    )

    return SignupResponse(
        success=True,
        message="Account created. Check your email for the verification code.",
        username=req.username,
        role=req.role,
        requires_verification=True,
    )


# ─── EMAIL VERIFICATION ──────────────────────────────────
@router.post("/verify-email")
@limiter.limit("10/minute")
async def verify_email(request: Request, req: VerifyEmailRequest):
    user = await user_service.get_by_identifier(req.username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("email_verified"):
        return {"success": True, "message": "Email already verified"}

    stored_code = user.get("verification_code")
    expires = user.get("verification_expires")

    if not stored_code or not expires:
        raise HTTPException(status_code=400, detail="No verification code pending. Request a new one.")

    if isinstance(expires, datetime):
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="Verification code expired. Request a new one.")

    # Constant-time string comparison
    import hmac
    if not hmac.compare_digest(stored_code, req.code):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    await user_service.mark_email_verified(user["username"])
    return {"success": True, "message": "Email verified. You can now log in."}


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, req: ResendVerificationRequest):
    user = await user_service.get_by_identifier(req.username)
    # Always return success to avoid user enumeration via timing
    if user and not user.get("email_verified"):
        code = generate_verification_code()
        expires = datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_CODE_EXPIRE_MINUTES)
        await user_service.set_verification(user["username"], code, expires)
        _send_verification_email(user.get("email", ""), code)
    return {"success": True, "message": "If the account exists and is unverified, a new code was sent."}


# ─── LOGIN ────────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(request: Request, req: LoginRequest):
    user = await user_service.get_by_identifier(req.username)

    # Always run a hash compare even on missing user (timing attack mitigation)
    if not user:
        # Spend ~bcrypt time even on miss
        verify_password(req.password, "$2b$12$" + "x" * 53)
        await audit_service.log_action(
            action="user.login.failure",
            actor_username=req.username, target_type="user", target_id=req.username,
            metadata={"reason": "user_not_found"}, request=request,
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Lockout check
    locked_until = user.get("locked_until")
    if locked_until:
        if isinstance(locked_until, datetime):
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) < locked_until:
                raise HTTPException(status_code=423, detail="Account temporarily locked. Try again later.")

    # Verify password
    if not verify_password(req.password, user.get("password_hash", "")):
        new_count = await user_service.increment_failed_login(user["username"])
        if new_count >= MAX_FAILED_LOGINS:
            until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
            await user_service.lock_account_until(user["username"], until)
        await audit_service.log_action(
            action="user.login.failure",
            actor_username=user["username"], target_type="user", target_id=user["username"],
            metadata={"reason": "bad_password", "failed_count": new_count}, request=request,
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Block unverified accounts
    if not user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Email not verified. Please verify before signing in.")

    # Issue JWT
    role = user["role"]
    if hasattr(role, "value"):
        role = role.value
    token, expires_in = create_session_token(username=user["username"], role=role)

    # Update last_login + reset failed counter
    await user_service.update_last_login(user["username"])

    # Optionally rehash password if cost factor changed
    if needs_rehash(user["password_hash"]):
        try:
            await user_service.update_password(user["username"], hash_password(req.password))
        except Exception:
            pass

    await audit_service.log_action(
        action="user.login.success",
        actor_username=user["username"], actor_role=role,
        target_type="user", target_id=user["username"],
        request=request,
    )

    return LoginResponse(
        token=token,
        role=role,
        username=user["username"],
        full_name=user.get("full_name"),
        email_verified=user.get("email_verified", False),
        id_verified=user.get("id_verified", False),
        expires_in=expires_in,
        language=user.get("language"),  # null if never set; frontend falls back gracefully
    )


# ─── LOGOUT ───────────────────────────────────────────────
@router.post("/logout")
async def logout(session: dict = Depends(get_current_session)):
    # Stateless JWT — client discards. (For full revocation, maintain a blacklist.)
    return {"success": True, "message": "Logged out"}


# ─── VERIFY (for client-side session check) ──────────────
@router.get("/verify")
async def verify(session: dict = Depends(get_current_session)):
    user = await user_service.get_by_username(session["username"])
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user_service.public_user_dict(user)


# ─── PASSWORD RESET (token-based, time-limited, single-use) ──
@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, req: ForgotPasswordRequest):
    """User requests a reset link. Always returns success (no enumeration)."""
    user = await user_service.get_by_identifier(req.identifier)
    if user:
        token, exp = create_reset_token(user["username"])
        # Decode to get jti so we can invalidate after use
        payload = decode_token(token, expected_type="password_reset")
        await user_service.set_reset_jti(user["username"], payload.get("jti"))
        _send_reset_email(user.get("email", ""), token)
    return {"success": True, "message": "If the account exists, a reset link was sent."}


@router.post("/admin-reset")
@limiter.limit("10/minute")
async def admin_issue_reset(request: Request, req: AdminResetRequest, session: dict = Depends(require_admin)):
    """Admin issues a password reset token for any user. Returns the token directly to the admin UI."""
    user = await user_service.get_by_identifier(req.target_username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token, exp = create_reset_token(user["username"])
    payload = decode_token(token, expected_type="password_reset")
    await user_service.set_reset_jti(user["username"], payload.get("jti"))

    await audit_service.log_action(
        action="user.password_reset_issued",
        actor_username=session["username"], actor_role=session["role"],
        target_type="user", target_id=user["username"],
        metadata={"expires_at": exp.isoformat(), "jti": payload.get("jti", "")[:8]},
        request=request,
    )

    # Admin gets the token in the response — they can hand it to the user out-of-band
    return {
        "success": True,
        "reset_token": token,
        "target_username": user["username"],
        "expires_at": exp.isoformat(),
        "message": "Reset token generated. It expires in 15 minutes and is single-use.",
    }


@router.post("/confirm-reset")
@limiter.limit("5/minute")
async def confirm_reset(request: Request, req: ConfirmResetRequest):
    """Anyone with a valid token can set a new password — it's the proof of authorization."""
    payload = decode_token(req.reset_token, expected_type="password_reset")
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    username = payload.get("sub")
    jti = payload.get("jti")
    user = await user_service.get_by_username(username) if username else None
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    # Single-use: jti must match the stored one
    if user.get("reset_token_jti") != jti:
        raise HTTPException(status_code=400, detail="Reset token already used or invalidated")

    # Hash + persist + clear jti
    new_hash = hash_password(req.new_password)
    await user_service.update_password(user["username"], new_hash)

    await audit_service.log_action(
        action="user.password_reset_used",
        actor_username=user["username"],
        target_type="user", target_id=user["username"],
        metadata={"jti": (jti or "")[:8]},
        request=request,
    )

    return {"success": True, "message": "Password updated. You can now sign in."}


# ─── ADMIN-ONLY USER MANAGEMENT ──────────────────────────
@router.get("/users")
async def list_users(session: dict = Depends(require_admin)):
    users = await user_service.list_users()
    return [user_service.public_user_dict(u, include_id_path=True) for u in users]


@router.delete("/users/{username}")
async def delete_user(username: str, request: Request, session: dict = Depends(require_admin)):
    # Prevent admin from deleting themselves accidentally
    if username == session["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    target = await user_service.get_by_username(username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Delete uploaded ID image if present
    rel_path = target.get("id_image_path")
    if rel_path:
        try:
            from config.settings import UPLOAD_DIR
            full = UPLOAD_DIR / rel_path
            if full.exists():
                full.unlink()
        except Exception:
            pass

    await user_service.delete_user(username)
    await audit_service.log_action(
        action="user.deleted",
        actor_username=session["username"], actor_role=session["role"],
        target_type="user", target_id=username,
        metadata={"deleted_role": target.get("role"), "deleted_email": target.get("email")},
        request=request,
    )
    return {"success": True, "message": f"Deleted {username}"}


@router.post("/users/{username}/verify-id")
async def admin_verify_id(username: str, request: Request, session: dict = Depends(require_admin)):
    """Admin marks a user's uploaded ID as verified."""
    user = await user_service.get_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from config.db import get_db
    db = get_db()
    await db["users"].update_one(
        {"username": user["username"]},
        {"$set": {"id_verified": True, "updated_at": datetime.now(timezone.utc)}},
    )
    await audit_service.log_action(
        action="user.id_verify",
        actor_username=session["username"], actor_role=session["role"],
        target_type="user", target_id=username,
        request=request,
    )
    return {"success": True, "message": "ID verified"}


@router.get("/users/{username}/id-image")
async def get_id_image(username: str, session: dict = Depends(require_admin)):
    """Admin can view a user's uploaded ID image."""
    user = await user_service.get_by_username(username)
    if not user or not user.get("id_image_path"):
        raise HTTPException(status_code=404, detail="No ID image on file")

    from config.settings import UPLOAD_DIR
    full = (UPLOAD_DIR / user["id_image_path"]).resolve()
    upload_root = UPLOAD_DIR.resolve()
    # Prevent path traversal: ensure full is inside upload_root
    if not str(full).startswith(str(upload_root)):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not full.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(str(full))


# ─── /me — self profile (any authenticated user) ─────────
@router.get("/me")
async def get_me(session: dict = Depends(get_current_session)):
    """Return the current user's safe public profile."""
    user = await user_service.get_by_username(session["username"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_service.public_user_dict(user, include_id_path=False)


@router.patch("/me")
async def update_me(
    payload: ProfileUpdateRequest,
    request: Request,
    session: dict = Depends(get_current_session),
):
    """
    Update editable profile fields on the current user only.
    Cannot change role, password, verification flags, lock status, or username.
    """
    ok = await user_service.update_profile(
        session["username"],
        full_name=payload.full_name,
        phone=payload.phone,
        language=payload.language,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")

    user = await user_service.get_by_username(session["username"])
    out = user_service.public_user_dict(user, include_id_path=False)

    await audit_service.log_action(
        action="user.profile_updated",
        actor_username=session["username"], actor_role=session["role"],
        target_type="user", target_id=session["username"],
        metadata={
            "fields_changed": [k for k, v in payload.model_dump(exclude_none=True).items()],
        },
        request=request,
    )
    return out
