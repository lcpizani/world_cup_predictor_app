from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class PredictionStatsUser(BaseModel):
    id: UUID
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class GameStatMatch(BaseModel):
    id: UUID
    home_team: str
    away_team: str
    home_score: int
    away_score: int
    stage: str
    kickoff_at: str

    model_config = {"from_attributes": True}


class GameStatEntry(BaseModel):
    match: GameStatMatch
    avg_points: float
    hit_rate: float
    exact_rate: float
    prediction_count: int


class PlayerStatEntry(BaseModel):
    user: PredictionStatsUser
    total_points: int
    games_predicted: int
    avg_points_per_game: float
    avg_daily_rank: Optional[float] = None


class PredictionStatsResponse(BaseModel):
    game_stats: List[GameStatEntry]
    player_stats: List[PlayerStatEntry]


# ── Global (platform-wide) prediction stats ───────────────────────────────────

class GlobalGameStatScore(BaseModel):
    home: int
    away: int


class GlobalGameStatEntry(BaseModel):
    match: GameStatMatch
    hit_rate: float
    exact_rate: float
    prediction_count: int
    max_consensus_count: int
    consensus_pick: Literal["home", "draw", "away"]
    max_same_score_count: int
    most_common_score: GlobalGameStatScore


class GlobalPredictionStatsSummary(BaseModel):
    total_users: int
    total_predictions: int
    overall_hit_rate: float
    overall_exact_rate: float


class GlobalPredictionStatsResponse(BaseModel):
    game_stats: List[GlobalGameStatEntry]
    summary: GlobalPredictionStatsSummary
