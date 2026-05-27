from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.prediction import Prediction
from app.models.match import Match
from app.models.tournament import Tournament, TournamentMember
from app.models.user import User
from app.schemas.prediction import PredictionCreate


def submit_prediction(db: Session, data: PredictionCreate, user: User) -> Prediction:
    match = db.query(Match).filter(Match.id == data.match_id).first()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    tournament = db.query(Tournament).filter(Tournament.id == data.tournament_id).first()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Tournament not found")

    member = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament.id, TournamentMember.user_id == user.id
    ).first()
    if member is None:
        raise HTTPException(status_code=403, detail="User is not a member of tournament")

    if match.status != "scheduled":
        raise HTTPException(status_code=400, detail="Predictions are locked after kickoff")

    existing = db.query(Prediction).filter(
        Prediction.user_id == user.id,
        Prediction.match_id == match.id,
        Prediction.tournament_id == tournament.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Prediction already submitted — use PUT to update")

    prediction = Prediction(
        user_id=user.id,
        match_id=match.id,
        tournament_id=tournament.id,
        predicted_home=data.predicted_home,
        predicted_away=data.predicted_away,
        is_locked=False,
    )
    db.add(prediction)
    db.commit()

    return (
        db.query(Prediction)
        .options(joinedload(Prediction.match))
        .filter(Prediction.id == prediction.id)
        .one()
    )


def update_prediction(db: Session, prediction_id: UUID, data: PredictionCreate, user: User) -> Prediction:
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if prediction is None:
        raise HTTPException(status_code=404, detail="Prediction not found")
    if prediction.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not the owner of the prediction")
    if prediction.is_locked:
        raise HTTPException(status_code=400, detail="Prediction is locked")

    match = db.query(Match).filter(Match.id == prediction.match_id).first()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if match.status != "scheduled":
        raise HTTPException(status_code=400, detail="Match has already started")

    prediction.predicted_home = data.predicted_home
    prediction.predicted_away = data.predicted_away
    db.add(prediction)
    db.commit()

    return (
        db.query(Prediction)
        .options(joinedload(Prediction.match))
        .filter(Prediction.id == prediction.id)
        .one()
    )


def list_predictions(db: Session, tournament_id: UUID, user: User, match_id: Optional[UUID] = None) -> List[Prediction]:
    member = db.query(TournamentMember).filter(
        TournamentMember.tournament_id == tournament_id, TournamentMember.user_id == user.id
    ).first()
    if member is None:
        raise HTTPException(status_code=403, detail="User is not a member of tournament")

    q = db.query(Prediction).options(joinedload(Prediction.match)).filter(
        Prediction.user_id == user.id, Prediction.tournament_id == tournament_id
    )
    if match_id:
        q = q.filter(Prediction.match_id == match_id)
    return q.all()
