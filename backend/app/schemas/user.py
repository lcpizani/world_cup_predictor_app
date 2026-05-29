from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = Field(default=None, max_length=100)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    display_name: Optional[str] = Field(default=None, max_length=100)


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_admin: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class UserStatsResponse(BaseModel):
    id: UUID
    username: str
    display_name: Optional[str] = None
    created_at: datetime
    tournaments_count: int
    total_points: int

    model_config = {"from_attributes": True}


class PredictionHistoryItem(BaseModel):
    match_id: UUID
    home_team: str
    away_team: str
    kickoff_at: datetime
    # Nullable so unfinished-match predictions can be hidden from other users.
    predicted_home: Optional[int] = None
    predicted_away: Optional[int] = None
    actual_home: Optional[int] = None
    actual_away: Optional[int] = None
    points_awarded: Optional[int] = None

    model_config = {"from_attributes": True}
