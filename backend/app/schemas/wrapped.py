from typing import Dict, List, Optional

from pydantic import BaseModel


class WrappedBestMatch(BaseModel):
    home_team: str
    away_team: str
    actual_home: Optional[int]
    actual_away: Optional[int]
    predicted_home: int
    predicted_away: int
    points_awarded: int


class WrappedTopThreeEntry(BaseModel):
    rank: int
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    total_points: int
    is_current_user: bool


class WrappedBestScoreTeam(BaseModel):
    team: str
    count: int


class WrappedStatsResponse(BaseModel):
    total_predictions: int
    exact_scores: int
    correct_winners: int
    hit_rate_pct: float
    best_match: Optional[WrappedBestMatch]
    points_by_stage: Dict[str, int]
    favorite_team: Optional[str]
    favorite_team_count: int = 0
    best_score_teams: List[WrappedBestScoreTeam] = []
    user_rank: int
    total_members: int
    top_three: List[WrappedTopThreeEntry]
