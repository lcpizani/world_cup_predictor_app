from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.services import auth as auth_service
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import TokenResponse
from app.dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if settings.INVITE_CODE and data.invite_code != settings.INVITE_CODE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid invite code")
    user = auth_service.register_user(db, data)
    return user


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm uses `username` field for email by convention
    token = auth_service.login_user(db, form_data.username, form_data.password)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return current_user
