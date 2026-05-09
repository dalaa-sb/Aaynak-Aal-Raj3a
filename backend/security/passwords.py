"""
Password hashing — bcrypt (industry standard).
Uses bcrypt directly to avoid passlib/bcrypt version compatibility issues.
"""
import bcrypt

# Cost factor 12 — modern industry standard. ~250ms per hash on commodity hardware.
ROUNDS = 12


def hash_password(plain: str) -> str:
    """Return a bcrypt hash for the given plaintext password."""
    if not plain or not isinstance(plain, str):
        raise ValueError("Password must be a non-empty string")

    # bcrypt has a 72-byte input limit — truncate explicitly to avoid silent surprise
    pw_bytes = plain.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=ROUNDS)
    hashed = bcrypt.hashpw(pw_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time comparison of plaintext vs stored bcrypt hash."""
    if not plain or not hashed:
        return False
    if not isinstance(plain, str) or not isinstance(hashed, str):
        return False

    try:
        pw_bytes = plain.encode("utf-8")[:72]
        return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
    except Exception:
        # Don't leak which step failed (timing oracle protection)
        return False


def needs_rehash(hashed: str) -> bool:
    """Returns True if the stored hash uses a lower cost factor than current."""
    try:
        # bcrypt hash format: $2b$<rounds>$<salt+hash>
        if not hashed or not hashed.startswith("$2"):
            return True
        parts = hashed.split("$")
        if len(parts) < 4:
            return True
        stored_rounds = int(parts[2])
        return stored_rounds < ROUNDS
    except Exception:
        return False
