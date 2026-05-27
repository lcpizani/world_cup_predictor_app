import os
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.match import Match
from app.models.prediction import Prediction

scheduler = AsyncIOScheduler()


def _lock_predictions_at_kickoff() -> None:
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        matches_to_lock = (
            db.query(Match)
            .filter(Match.status == "scheduled", Match.kickoff_at <= now)
            .all()
        )
        for match in matches_to_lock:
            match.status = "live"
            db.query(Prediction).filter(
                Prediction.match_id == match.id,
                Prediction.is_locked == False,  # noqa: E712
            ).update({"is_locked": True}, synchronize_session=False)
            db.add(match)
        if matches_to_lock:
            db.commit()
    finally:
        db.close()


def start_scheduler() -> None:
    # Skip in test/sqlite environments to avoid interference with test isolation.
    if os.getenv("DATABASE_URL", "").startswith("sqlite"):
        return
    scheduler.add_job(_lock_predictions_at_kickoff, "interval", minutes=1, id="lock_predictions")
    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown()
