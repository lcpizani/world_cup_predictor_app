from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MatchCreate(BaseModel):
    home_team: str
    away_team: str
    kickoff_at: datetime
    stage: str
    group: Optional[str] = None


class MatchResponse(BaseModel):
    id: UUID
    external_match_id: Optional[str] = None
    home_team: str
    away_team: str
    kickoff_at: datetime
    stage: str
    group: Optional[str] = None
    status: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    minute: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchResultUpdate(BaseModel):
    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)
    status: Optional[str] = "finished"
