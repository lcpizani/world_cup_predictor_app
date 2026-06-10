from pydantic import BaseModel, EmailStr, Field, field_validator

_SUPPORTED_LOCALES = {"en", "pt"}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    locale: str = "en"

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, v: str) -> str:
        return v if v in _SUPPORTED_LOCALES else "en"


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str
