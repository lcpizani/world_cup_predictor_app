from typing import List, Literal, Optional

from pydantic import BaseModel

from app.schemas.match import MatchResponse


class LiveMatchBadge(BaseModel):
    team_score: int
    opp_score: int
    result: Literal["W", "D", "L"]


class GroupStandingRow(BaseModel):
    position: int
    team_name: str
    group: str
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int
    live_match: Optional[LiveMatchBadge] = None

    model_config = {"from_attributes": True}


class GroupData(BaseModel):
    group: str
    standings: List[GroupStandingRow]


class GroupStandingsResponse(BaseModel):
    groups: List[GroupData]


class BracketSlot(BaseModel):
    slot_id: int
    round: str
    home_label: str
    away_label: str
    match: Optional[MatchResponse] = None
