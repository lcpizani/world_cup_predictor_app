from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session

from app.database import get_db
from app.logger import logger
from app.services import auth as auth_service
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import TokenResponse
from app.dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    try:
        user = auth_service.register_user(db, data)
    except HTTPException as exc:
        logger.warning("Registration failed", username=data.username, detail=exc.detail)
        raise
    logger.info("User registered", username=user.username)
    return user


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        # OAuth2PasswordRequestForm uses `username` field for email by convention
        token = auth_service.login_user(db, form_data.username, form_data.password)
    except HTTPException as exc:
        logger.warning("Login failed", email=form_data.username, detail=exc.detail)
        raise
    logger.info("User logged in", email=form_data.username)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return current_user
