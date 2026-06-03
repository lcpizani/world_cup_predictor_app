import os
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.logger import logger
from app.models.match import Match
from app.models.prediction import Prediction

scheduler = AsyncIOScheduler()

LOCK_WINDOW_MINUTES = 30


def _lock_predictions_pre_kickoff() -> None:
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        lock_threshold = now + timedelta(minutes=LOCK_WINDOW_MINUTES)
        matches_to_lock = (
            db.query(Match)
            .filter(Match.status == "scheduled", Match.kickoff_at <= lock_threshold)
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
            logger.info("Locked predictions pre-kickoff", count=len(matches_to_lock))
    except Exception as exc:
        logger.error("Error locking predictions pre-kickoff", error=str(exc))
        raise
    finally:
        db.close()


def start_scheduler() -> None:
    # Skip in test/sqlite environments to avoid interference with test isolation.
    if os.getenv("DATABASE_URL", "").startswith("sqlite"):
        return
    scheduler.add_job(_lock_predictions_pre_kickoff, "interval", minutes=1, id="lock_predictions", max_instances=1)
    # Only sync fixtures immediately on boot when explicitly opted in. Off by
    # default so a routine cold start cannot auto-mutate match data or silently
    # repopulate an emptied matches table (which previously masked a wipe). When
    # off, the job's first run is the normal interval from now (~6h), not paused.
    fixtures_kwargs = {}
    if settings.SYNC_FIXTURES_ON_BOOT:
        fixtures_kwargs["next_run_time"] = datetime.now(timezone.utc)
    scheduler.add_job(
        _sync_fixtures_job, "interval", hours=6, id="sync_fixtures", max_instances=1,
        **fixtures_kwargs,
    )
    scheduler.add_job(_sync_results_job, "interval", seconds=60, id="sync_results", max_instances=1)
    scheduler.start()
    logger.info("Scheduler started")


def _compute_next_results_interval(db: Session) -> int:
    """Return seconds until the next results sync based on current match state."""
    now = datetime.now(timezone.utc)
    has_live = db.query(Match).filter(Match.status == "live").first() is not None
    if has_live:
        return 60
    imminent = (
        db.query(Match)
        .filter(Match.status == "scheduled", Match.kickoff_at <= now + timedelta(hours=2))
        .first()
    )
    if imminent:
        return 300  # 5 min
    return 1800  # 30 min


def _sync_fixtures_job() -> None:
    from app.services import football_api  # local import avoids circular deps at module load

    db: Session = SessionLocal()
    try:
        football_api.sync_matches(db)
    except Exception as exc:
        logger.error("Auto fixtures sync failed", error=str(exc))
    finally:
        db.close()


def _sync_results_job() -> None:
    from app.services import football_api  # local import avoids circular deps at module load
    from app.services.standings import recalculate_standings_from_matches
    from app.services.scoring import update_provisional_points

    db: Session = SessionLocal()
    try:
        football_api.sync_results(db)
        recalculate_standings_from_matches(db)
        update_provisional_points(db)
        next_interval = _compute_next_results_interval(db)
    except Exception as exc:
        logger.error("Auto results sync failed", error=str(exc))
        next_interval = 300  # back off to 5 min on error
    finally:
        db.close()

    if scheduler.running:
        job = scheduler.get_job("sync_results")
        if job:
            job.reschedule("interval", seconds=next_interval)


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
