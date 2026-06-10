import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from passlib.context import CryptContext
from jose import jwt
from sqlalchemy import update
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.config import settings
from app.models.user import User
from app.models.tournament import Tournament
from app.models.password_reset_token import PasswordResetToken
from app.schemas.user import UserCreate
from app.services.email import send_password_reset_email
from app.logger import logger


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def validate_invite_code(db: Session, invite_code: str) -> bool:
    """Accept registration when: INVITE_CODE is not set in dev (open mode),
    invite_code matches the global secret, or invite_code is a valid tournament code.

    In production, an empty INVITE_CODE fails closed — otherwise a misconfigured
    deploy would allow open registration."""
    global_secret = settings.INVITE_CODE
    if not global_secret:
        if settings.ENVIRONMENT == "production":
            return False
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


def create_reset_token(db: Session, email: str) -> None:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return

    now = datetime.now(timezone.utc)

    # Replace all existing tokens for this user with a single new one.
    # This prevents token accumulation and limits the attack surface to one
    # valid token at a time.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
    ).delete(synchronize_session=False)

    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    reset_token = PasswordResetToken(
        token=token_hash,
        user_id=user.id,
        expires_at=now + timedelta(minutes=15),
    )
    db.add(reset_token)
    db.commit()

    reset_url = f"{settings.APP_URL.rstrip('/')}/auth/reset-password?token={token}"
    try:
        send_password_reset_email(user.email, reset_url)
    except Exception as exc:
        # Token is already committed; log loudly so ops can investigate.
        # The user can request a new link — the committed token will be
        # replaced on the next request.
        logger.error(
            "Password reset email failed — token committed but not delivered",
            user_id=str(user.id),
            error=str(exc),
        )


def reset_password(db: Session, token: str, new_password: str) -> None:
    now = datetime.now(timezone.utc)
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Atomic CAS: mark the token used in a single statement so two concurrent
    # requests with the same token cannot both succeed (TOCTOU prevention).
    result = db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.token == token_hash,
            PasswordResetToken.used == False,  # noqa: E712
            PasswordResetToken.expires_at > now,
        )
        .values(used=True)
        .returning(PasswordResetToken.user_id)
    )
    row = result.fetchone()
    if row is None:
        db.rollback()
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user_id = row[0]
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        db.rollback()
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")

    user.hashed_password = pwd_context.hash(new_password)

    # Invalidate all remaining unused tokens for this user so sibling tokens
    # from prior forgot-password requests can no longer be used.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.used == False,  # noqa: E712
    ).delete(synchronize_session=False)

    db.commit()


def login_user(db: Session, email: str, password: str) -> str:
    user = db.query(User).filter(User.email == email).first()
    if user is None or not pwd_context.verify(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload: Dict[str, Any] = {"sub": str(user.id), "exp": expire}
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token
