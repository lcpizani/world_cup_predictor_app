from typing import List, Optional
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


class PredictionStatsResponse(BaseModel):
    game_stats: List[GameStatEntry]
    player_stats: List[PlayerStatEntry]
