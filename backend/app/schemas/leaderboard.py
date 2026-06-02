from typing import List
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserResponse


class LeaderboardEntry(BaseModel):
    rank: int
    user: UserResponse
    total_points: int
    provisional_points: int
    live_total: int

    model_config = {"from_attributes": True}


class LeaderboardResponse(BaseModel):
    tournament_id: UUID
    has_live_matches: bool
    entries: List[LeaderboardEntry]

    model_config = {"from_attributes": True}


class LiveLeaderboardEntry(BaseModel):
    rank: int
    user: UserResponse
    total_points: int
    provisional_points: int
    live_total: int

    model_config = {"from_attributes": True}


class LiveLeaderboardResponse(BaseModel):
    tournament_id: UUID
    has_live_matches: bool
    entries: List[LiveLeaderboardEntry]

    model_config = {"from_attributes": True}
