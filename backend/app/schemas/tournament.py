from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.match import MatchResponse
from app.schemas.user import UserResponse


class ScoringRulesCreate(BaseModel):
    correct_result_pts: int = Field(default=0, ge=0)
    correct_winner_pts: int = Field(default=0, ge=0)
    correct_goal_diff_pts: int = Field(default=0, ge=0)
    correct_goals_one_team_pts: int = Field(default=0, ge=0)
    double_points_from_stage: Optional[str] = None


class ScoringRulesResponse(BaseModel):
    correct_result_pts: int
    correct_winner_pts: int
    correct_goal_diff_pts: int
    correct_goals_one_team_pts: int
    double_points_from_stage: Optional[str] = None

    model_config = {"from_attributes": True}


class ScoringRulesUpdate(BaseModel):
    correct_result_pts: Optional[int] = Field(default=None, ge=0)
    correct_winner_pts: Optional[int] = Field(default=None, ge=0)
    correct_goal_diff_pts: Optional[int] = Field(default=None, ge=0)
    correct_goals_one_team_pts: Optional[int] = Field(default=None, ge=0)
    double_points_from_stage: Optional[str] = None


class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    scoring_rules: Optional[ScoringRulesUpdate] = None


class TransferOwnershipRequest(BaseModel):
    new_owner_user_id: UUID


class TournamentCreate(BaseModel):
    name: str
    scoring_rules: ScoringRulesCreate


class TournamentResponse(BaseModel):
    id: UUID
    name: str
    invite_code: str
    is_active: bool
    created_at: datetime
    created_by: UUID
    creator: UserResponse
    scoring_rules: ScoringRulesResponse

    model_config = {"from_attributes": True}


class TournamentMemberResponse(BaseModel):
    id: UUID
    tournament_id: UUID
    user_id: UUID
    total_points: int
    joined_at: datetime
    user: UserResponse

    model_config = {"from_attributes": True}


class JoinTournamentRequest(BaseModel):
    invite_code: str


class TournamentComparePrediction(BaseModel):
    user_id: UUID
    username: str
    predicted_home: Optional[int] = None
    predicted_away: Optional[int] = None
    points_awarded: Optional[int] = None


class TournamentCompareMatch(BaseModel):
    match: MatchResponse
    predictions: List[TournamentComparePrediction]

