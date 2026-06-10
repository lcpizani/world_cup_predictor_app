from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session

from app.database import get_db
from app.logger import logger
from app.limiter import limiter
from app.services import auth as auth_service
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import TokenResponse, ForgotPasswordRequest, ResetPasswordRequest, MessageResponse
from app.dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(
    request: Request,
    data: UserCreate,
    db: Session = Depends(get_db),
    invite_code: str = Query(default=""),
):
    if not auth_service.validate_invite_code(db, invite_code):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration is invite-only")
    try:
        user = auth_service.register_user(db, data)
    except HTTPException as exc:
        logger.warning("Registration failed", username=data.username, detail=exc.detail)
        raise
    logger.info("User registered", username=user.username)
    return user


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        # OAuth2PasswordRequestForm uses `username` field for email by convention
        token = auth_service.login_user(db, form_data.username, form_data.password)
    except HTTPException as exc:
        logger.warning("Login failed", detail=exc.detail)
        raise
    logger.info("User logged in")
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return current_user


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("5/hour")
def forgot_password(request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    try:
        auth_service.create_reset_token(db, data.email, locale=data.locale)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error in forgot_password", error=str(exc))
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("10/minute")
def reset_password(request: Request, data: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        auth_service.reset_password(db, data.token, data.new_password)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error in reset_password", error=str(exc))
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
    return {"message": "Password updated successfully."}
