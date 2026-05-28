from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    avatar_url: Optional[str] = None
    is_admin: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
