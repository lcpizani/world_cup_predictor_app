from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.prediction import Prediction
from app.models.point_event import PointEvent
from app.models.match import Match
from app.models.user import User
from app.schemas.prediction import PredictionCreate, PredictionUpdate


def submit_prediction(db: Session, data: PredictionCreate, user: User) -> Prediction:
    match = db.query(Match).filter(Match.id == data.match_id).first()
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.status != "scheduled":
        raise HTTPException(status_code=400, detail="Predictions are locked after kickoff")

    existing = db.query(Prediction).filter(
        Prediction.user_id == user.id,
        Prediction.match_id == match.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Prediction already submitted — use PUT to update")

    prediction = Prediction(
        user_id=user.id,
        match_id=match.id,
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


def update_prediction(db: Session, prediction_id: UUID, data: PredictionUpdate, user: User) -> Prediction:
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


def list_predictions(db: Session, user: User, tournament_id: Optional[UUID] = None) -> List[Prediction]:
    predictions = (
        db.query(Prediction)
        .options(joinedload(Prediction.match))
        .filter(Prediction.user_id == user.id)
        .all()
    )

    if tournament_id:
        pred_ids = [p.id for p in predictions]
        point_events = (
            db.query(PointEvent)
            .filter(
                PointEvent.prediction_id.in_(pred_ids),
                PointEvent.tournament_id == tournament_id,
            )
            .all()
        )
        points_by_pred: dict = {}
        for pe in point_events:
            points_by_pred[pe.prediction_id] = points_by_pred.get(pe.prediction_id, 0) + pe.points

        for pred in predictions:
            if pred.is_locked:
                pred.points_awarded = points_by_pred.get(pred.id, 0)
            else:
                pred.points_awarded = None

    return predictions
