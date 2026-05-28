import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from passlib.context import CryptContext
from jose import jwt
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.config import settings
from app.models.user import User
from app.models.tournament import Tournament
from app.schemas.user import UserCreate


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def validate_invite_code(db: Session, invite_code: str) -> bool:
    """Accept registration when: INVITE_CODE is not set (open/dev mode),
    invite_code matches the global secret, or invite_code is a valid tournament code."""
    global_secret = settings.INVITE_CODE
    if not global_secret:
        return True
    if invite_code and secrets.compare_digest(invite_code, global_secret):
        return True
    if invite_code:
        tournament = db.query(Tournament).filter(Tournament.invite_code == invite_code).first()
        return tournament is not None
    return False


def register_user(db: Session, data: UserCreate) -> User:
    existing = db.query(User).filter((User.email == data.email) | (User.username == data.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already registered")

    hashed = pwd_context.hash(data.password)
    user = User(
        email=data.email,
        username=data.username,
        display_name=data.display_name,
        hashed_password=hashed,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_user(db: Session, email: str, password: str) -> str:
    user = db.query(User).filter(User.email == email).first()
    if user is None or not pwd_context.verify(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload: Dict[str, Any] = {"sub": str(user.id), "exp": expire}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token
