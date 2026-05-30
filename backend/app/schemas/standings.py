from typing import List, Optional

from pydantic import BaseModel

from app.schemas.match import MatchResponse


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
