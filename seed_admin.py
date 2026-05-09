"""
Bootstrap the first admin user.
Run: python seed_admin.py

Prompts for username, email, and password. Creates an admin account
with email already verified (since this is the bootstrap admin).
After this, all other accounts must go through normal signup + verification.
"""
import asyncio
import getpass
import sys
import re
from datetime import datetime, timezone

from config.db import connect_db, close_db
from backend.services import user_service
from backend.security.passwords import hash_password


USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.\-]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def main():
    print("=" * 56)
    print("  AAR — Bootstrap Admin Account")
    print("=" * 56)
    await connect_db()
    await user_service.ensure_indexes()

    username = input("Admin username: ").strip().lower()
    if not USERNAME_RE.match(username):
        print("Invalid username. Use 3-32 chars: letters, digits, . _ -")
        await close_db()
        sys.exit(1)

    if await user_service.get_by_username(username):
        print(f"User '{username}' already exists.")
        await close_db()
        sys.exit(1)

    full_name = input("Full name: ").strip()
    if len(full_name) < 2:
        print("Full name too short.")
        await close_db(); sys.exit(1)

    email = input("Email: ").strip().lower()
    if not EMAIL_RE.match(email):
        print("Invalid email.")
        await close_db(); sys.exit(1)

    if await user_service.get_by_email(email):
        print("Email already registered.")
        await close_db(); sys.exit(1)

    while True:
        pw1 = getpass.getpass("Password (8+ chars, letters + digits): ")
        if len(pw1) < 8 or not re.search(r"[A-Za-z]", pw1) or not re.search(r"[0-9]", pw1):
            print("Password too weak. Must be 8+ chars and contain letters and digits.")
            continue
        pw2 = getpass.getpass("Confirm password: ")
        if pw1 != pw2:
            print("Passwords don't match.")
            continue
        break

    pw_hash = hash_password(pw1)
    await user_service.create_user(
        username=username,
        password_hash=pw_hash,
        full_name=full_name,
        email=email,
        role="admin",
    )

    # Mark email verified for bootstrap admin
    from config.db import get_db
    await get_db()["users"].update_one(
        {"username": username},
        {"$set": {"email_verified": True, "id_verified": True,
                  "updated_at": datetime.now(timezone.utc)}},
    )

    print()
    print(f"✅ Admin '{username}' created and verified.")
    print("You can now log in via the frontend.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
