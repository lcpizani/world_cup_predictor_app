#!/usr/bin/env python3
"""
Create or promote a user to admin.

Usage:
    python scripts/create_admin.py <email> <username>

If the email already exists the user is promoted to admin without changing their password.
Password is prompted interactively (not passed as an argument) to avoid shell-history exposure.
"""
import getpass
import sys
import os
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from passlib.context import CryptContext
from app.database import SessionLocal
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_or_promote_admin(email: str, username: str, password: str) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            existing.is_admin = True
            db.add(existing)
            db.commit()
            print(f"Promoted existing user to admin: {email}")
        else:
            user = User(
                id=uuid.uuid4(),
                email=email,
                username=username,
                hashed_password=pwd_context.hash(password),
                is_admin=True,
            )
            db.add(user)
            db.commit()
            print(f"Created admin user: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    password = getpass.getpass("Admin password: ")
    create_or_promote_admin(sys.argv[1], sys.argv[2], password)
