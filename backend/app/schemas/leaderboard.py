from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel
import datetime


class LeaderboardUserResponse(BaseModel):
    id: UUID
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class LeaderboardEntry(BaseModel):
    rank: int
    user: LeaderboardUserResponse
    total_points: int
    provisional_points: int
    live_total: int
    rank_delta: int = 0
    exact_scores: int = 0

    model_config = {"from_attributes": True}


class LeaderboardResponse(BaseModel):
    tournament_id: UUID
    has_live_matches: bool
    show_rank_change: bool = False
    entries: List[LeaderboardEntry]

    model_config = {"from_attributes": True}


class LiveLeaderboardEntry(BaseModel):
    rank: int
    user: LeaderboardUserResponse
    total_points: int
    provisional_points: int
    live_total: int
    rank_delta: int = 0
    exact_scores: int = 0

    model_config = {"from_attributes": True}


class LiveLeaderboardResponse(BaseModel):
    tournament_id: UUID
    has_live_matches: bool
    show_rank_change: bool = False
    entries: List[LiveLeaderboardEntry]

    model_config = {"from_attributes": True}


class RankingHistoryUser(BaseModel):
    id: UUID
    username: str
    display_name: Optional[str] = None

    model_config = {"from_attributes": True}


class RankingHistorySeries(BaseModel):
    user: RankingHistoryUser
    ranks: List[int]
    points: List[int]
    is_current_user: bool = False


class RankingHistoryResponse(BaseModel):
    match_days: List[str]
    series: List[RankingHistorySeries]
