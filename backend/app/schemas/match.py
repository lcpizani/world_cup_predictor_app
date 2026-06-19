from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CrowdWisdomTopScore(BaseModel):
    home: int
    away: int
    pct: float


class CrowdWisdom(BaseModel):
    total_predictors: int
    total_members: Optional[int] = None
    home_pct: float
    draw_pct: float
    away_pct: float
    top_score: Optional[CrowdWisdomTopScore]
    your_score_pct: Optional[float]


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
    home_score_penalties: Optional[int] = None
    away_score_penalties: Optional[int] = None
    duration: Optional[str] = None
    minute: Optional[int] = None
    injury_time: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchResultUpdate(BaseModel):
    home_score: int = Field(ge=0)
    away_score: int = Field(ge=0)
    status: Optional[str] = "finished"
