from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.match import Match
from app.schemas.match import MatchCreate


def create_match(db: Session, data: MatchCreate) -> Match:
    match = Match(
        external_match_id=None,
        home_team=data.home_team,
        away_team=data.away_team,
        kickoff_at=data.kickoff_at,
        stage=data.stage,
        group=data.group,
        status="scheduled",
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


def list_matches(db: Session, stage: Optional[str] = None, status: Optional[str] = None) -> List[Match]:
    q = db.query(Match)
    if stage:
        q = q.filter(Match.stage == stage)
    if status:
        q = q.filter(Match.status == status)
    return q.order_by(Match.kickoff_at.asc()).all()


def get_match(db: Session, match_id: UUID) -> Match:
    match = db.query(Match).filter(Match.id == match_id).first()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return match
