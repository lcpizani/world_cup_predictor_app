from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.user import UserResponse


class ScoringRulesCreate(BaseModel):
    correct_result_pts: int = Field(default=0, ge=0)
    correct_winner_pts: int = Field(default=0, ge=0)
    correct_goal_diff_pts: int = Field(default=0, ge=0)
    correct_goals_one_team_pts: int = Field(default=0, ge=0)


class ScoringRulesResponse(BaseModel):
    correct_result_pts: int
    correct_winner_pts: int
    correct_goal_diff_pts: int
    correct_goals_one_team_pts: int

    model_config = {"from_attributes": True}


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

