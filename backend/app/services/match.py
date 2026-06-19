from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.match import Match
from app.models.prediction import Prediction
from app.models.tournament import TournamentMember
from app.schemas.match import MatchCreate, CrowdWisdom, CrowdWisdomTopScore


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


def get_crowd_wisdom(db: Session, match_id: UUID, current_user, tournament_id: Optional[UUID] = None) -> CrowdWisdom:
    match = db.query(Match).filter(Match.id == match_id).first()
    if match is None or match.status in ("scheduled", "suspended"):
        raise HTTPException(status_code=404, detail="Match not found")

    total_members: Optional[int] = None
    q = db.query(Prediction).filter(Prediction.match_id == match_id)
    if tournament_id is not None:
        total_members = db.query(TournamentMember).filter(
            TournamentMember.tournament_id == tournament_id
        ).count()
        member_user_ids = db.query(TournamentMember.user_id).filter(
            TournamentMember.tournament_id == tournament_id
        ).subquery()
        q = q.filter(Prediction.user_id.in_(member_user_ids))
    predictions = q.all()
    total = len(predictions)

    if total == 0:
        return CrowdWisdom(
            total_predictors=0,
            total_members=total_members,
            home_pct=0.0,
            draw_pct=0.0,
            away_pct=0.0,
            top_score=None,
            your_score_pct=None,
        )

    home_wins = sum(1 for p in predictions if p.predicted_home > p.predicted_away)
    draws = sum(1 for p in predictions if p.predicted_home == p.predicted_away)
    away_wins = sum(1 for p in predictions if p.predicted_home < p.predicted_away)

    # Most popular exact score
    score_counts: dict = {}
    for p in predictions:
        key = (p.predicted_home, p.predicted_away)
        score_counts[key] = score_counts.get(key, 0) + 1
    top_key = max(score_counts, key=lambda k: score_counts[k])
    top_score = CrowdWisdomTopScore(
        home=top_key[0],
        away=top_key[1],
        pct=round(score_counts[top_key] / total * 100, 1),
    )

    # Personal alignment
    your_score_pct: Optional[float] = None
    user_pred = next((p for p in predictions if p.user_id == current_user.id), None)
    if user_pred is not None:
        user_key = (user_pred.predicted_home, user_pred.predicted_away)
        your_score_pct = round(score_counts.get(user_key, 0) / total * 100, 1)

    home_pct = round(home_wins / total * 100, 1)
    draw_pct = round(draws / total * 100, 1)
    away_pct = round(100.0 - home_pct - draw_pct, 1)

    return CrowdWisdom(
        total_predictors=total,
        total_members=total_members,
        home_pct=home_pct,
        draw_pct=draw_pct,
        away_pct=away_pct,
        top_score=top_score,
        your_score_pct=your_score_pct,
    )
