from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from passlib.context import CryptContext
from jose import jwt
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.config import settings
from app.models.user import User
from app.schemas.user import UserCreate


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def register_user(db: Session, data: UserCreate) -> User:
    existing = db.query(User).filter((User.email == data.email) | (User.username == data.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already registered")

    hashed = pwd_context.hash(data.password)
    user = User(email=data.email, username=data.username, hashed_password=hashed)
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
