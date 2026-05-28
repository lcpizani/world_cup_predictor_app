from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.match import MatchResponse


class PredictionCreate(BaseModel):
    match_id: UUID
    predicted_home: int = Field(ge=0)
    predicted_away: int = Field(ge=0)


class PredictionUpdate(BaseModel):
    predicted_home: int = Field(ge=0)
    predicted_away: int = Field(ge=0)


class PointEventResponse(BaseModel):
    id: UUID
    reason: str
    points: int
    match_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class PredictionResponse(BaseModel):
    id: UUID
    user_id: UUID
    match_id: UUID
    predicted_home: int
    predicted_away: int
    is_locked: bool
    points_awarded: Optional[int] = None
    submitted_at: datetime
    match: MatchResponse

    model_config = {"from_attributes": True}
