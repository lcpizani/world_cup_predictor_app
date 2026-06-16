"""
Integration with football-data.org API (v4).

Requires FOOTBALL_API_KEY in settings.
Free tier: 10 requests/minute, covers major competitions.
World Cup competition code: "WC"
"""
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.logger import logger
from app.models.match import Match
from app.services.scoring import apply_match_result
from app.services.standings import recalculate_standings_from_matches

FOOTBALL_API_BASE = "https://api.football-data.org/v4"

_LIVE_STATUSES = {"IN_PLAY"}
_HALFTIME_STATUSES = {"PAUSED"}
_EDGE_STATUSES = {"CANCELLED", "POSTPONED", "SUSPENDED", "AWARDED"}
_ALLOWED_COMPETITION_CODES = {"WC", "EC", "PL", "PD", "BL1", "SA", "FL1", "CL", "EL"}


def _headers() -> dict:
    if not settings.FOOTBALL_API_KEY:
        raise HTTPException(status_code=503, detail="FOOTBALL_API_KEY not configured")
    return {"X-Auth-Token": settings.FOOTBALL_API_KEY, "X-Api-Version": "v4.1"}


def _validate_competition_code(code: str) -> None:
    if code not in _ALLOWED_COMPETITION_CODES:
        raise HTTPException(status_code=400, detail=f"Unknown competition code '{code}'")


def _map_api_status(api_status: str) -> str:
    if api_status in ("SCHEDULED", "TIMED"):
        return "scheduled"
    if api_status in _LIVE_STATUSES:
        return "live"
    if api_status in _HALFTIME_STATUSES:
        return "halftime"
    if api_status == "FINISHED":
        return "finished"
    return "suspended"


# football-data.org returns knockout rounds as LAST_16 / LAST_32 / LAST_64, but the
# rest of the app (scoring STAGE_ORDER, standings bracket, frontend, i18n keys) speaks
# round_of_16 / round_of_32 / round_of_64. Translate to our canonical vocabulary here so
# the multiplier and the "scoring locked once knockout scored" guard line up with the DB.
_API_STAGE_TO_CANONICAL = {
    "GROUP_STAGE": "group_stage",
    "LAST_64": "round_of_64",
    "LAST_32": "round_of_32",
    "LAST_16": "round_of_16",
    "QUARTER_FINALS": "quarter_finals",
    "SEMI_FINALS": "semi_finals",
    "THIRD_PLACE": "third_place",
    "FINAL": "final",
}


def _normalize_stage(api_stage: str | None) -> str:
    """Map a football-data.org stage enum to the app's canonical stage name.

    Unknown values fall back to a lowercased form so a new/unexpected stage never
    crashes a sync — at worst it simply won't qualify for double points (the scoring
    multiplier safely returns 1 for stages it doesn't recognise).
    """
    if not api_stage:
        return "group_stage"
    return _API_STAGE_TO_CANONICAL.get(api_stage.upper(), api_stage.lower())


def sync_matches(db: Session, competition_code: str = "WC") -> dict:
    """Fetch fixtures from football-data.org and upsert Match rows."""
    _validate_competition_code(competition_code)
    logger.info("Fetching fixtures from football-data.org", competition_code=competition_code)
    with httpx.Client(timeout=15) as client:
        resp = client.get(
            f"{FOOTBALL_API_BASE}/competitions/{competition_code}/matches",
            headers=_headers(),
        )
        if not resp.is_success:
            logger.error("football-data.org fixtures request failed", status_code=resp.status_code, competition_code=competition_code)
        resp.raise_for_status()
        data = resp.json()

    # Snapshot the table state before we touch it. A sync that fills a
    # previously-empty matches table is a strong signal that the table was wiped
    # and is being silently repopulated — surface it loudly rather than masking.
    matches_before = db.query(Match).count()

    upserted = 0
    inserted = 0
    for fixture in data.get("matches", []):
        ext_id = str(fixture["id"])
        kickoff = datetime.fromisoformat(fixture["utcDate"].replace("Z", "+00:00"))
        home = fixture["homeTeam"].get("name")
        away = fixture["awayTeam"].get("name")
        stage = _normalize_stage(fixture.get("stage"))
        raw_group = fixture.get("group")
        group = raw_group.replace("GROUP_", "Group ").title() if raw_group else None

        # Skip knockout placeholders where teams aren't decided yet
        if not home or not away:
            continue

        existing = db.query(Match).filter(Match.external_match_id == ext_id).first()
        if existing:
            # Only mutate matches that haven't kicked off. Once status flips to
            # "live" or "finished", predictions are locked against this match —
            # changing teams or kickoff time would silently misalign them.
            if existing.status == "scheduled":
                existing.kickoff_at = kickoff
                existing.home_team = home
                existing.away_team = away
                existing.stage = stage
                existing.group = group
                db.add(existing)
        else:
            db.add(Match(
                external_match_id=ext_id,
                home_team=home,
                away_team=away,
                kickoff_at=kickoff,
                stage=stage,
                group=group,
                status="scheduled",
            ))
            inserted += 1
        upserted += 1

    db.commit()
    recalculate_standings_from_matches(db)
    if matches_before == 0 and inserted > 0:
        logger.warning(
            "Repopulated empty matches table from API",
            competition_code=competition_code,
            inserted=inserted,
        )
    logger.info("Fixtures sync complete", competition_code=competition_code, upserted=upserted)
    return {"upserted": upserted}


def sync_results(db: Session, competition_code: str = "WC") -> dict:
    """Fetch all in-progress and finished matches and update their status/scores."""
    _validate_competition_code(competition_code)
    logger.info("Syncing match statuses from football-data.org", competition_code=competition_code)
    with httpx.Client(timeout=15) as client:
        resp = client.get(
            f"{FOOTBALL_API_BASE}/competitions/{competition_code}/matches",
            headers=_headers(),
        )
        if not resp.is_success:
            logger.error("football-data.org results request failed", status_code=resp.status_code, competition_code=competition_code)
        resp.raise_for_status()
        data = resp.json()

    scored = 0
    live_updated = 0
    suspended = 0

    for fixture in data.get("matches", []):
        api_status = fixture.get("status", "")
        internal_status = _map_api_status(api_status)
        ext_id = str(fixture["id"])

        match = db.query(Match).filter(Match.external_match_id == ext_id).first()
        if match is None:
            continue

        # Already settled — nothing to do
        if match.status == "finished":
            continue

        if internal_status == "suspended":
            if match.status != "suspended":
                match.status = "suspended"
                db.add(match)
                suspended += 1
                logger.warning(
                    "Match marked suspended — admin review required",
                    ext_id=ext_id,
                    api_status=api_status,
                )
            continue

        if internal_status in ("live", "halftime"):
            score_obj = fixture.get("score", {})
            api_duration = score_obj.get("duration", "REGULAR")
            # During ET/penalties use the running extraTime total; fall back to fullTime
            if api_duration in ("EXTRA_TIME", "PENALTY_SHOOTOUT"):
                et = score_obj.get("extraTime") or {}
                home_score = et.get("home")
                away_score = et.get("away")
            else:
                ft = score_obj.get("fullTime") or {}
                home_score = ft.get("home")
                away_score = ft.get("away")
            # Fall back to half-time if no score available yet
            if home_score is None or away_score is None:
                ht = score_obj.get("halfTime") or {}
                home_score = ht.get("home")
                away_score = ht.get("away")
            if home_score is not None and away_score is not None:
                match.status = internal_status
                match.home_score = home_score
                match.away_score = away_score
                match.minute = fixture.get("minute")
                match.injury_time = fixture.get("injuryTime")
                db.add(match)
                live_updated += 1
            continue

        if internal_status == "finished":
            score_obj = fixture.get("score", {})
            api_duration = score_obj.get("duration", "REGULAR")
            ft = score_obj.get("fullTime") or {}
            # Use extraTime total when available (it's cumulative, includes 90-min goals)
            if api_duration in ("EXTRA_TIME", "PENALTY_SHOOTOUT"):
                et = score_obj.get("extraTime") or {}
                home_score = et.get("home") if et.get("home") is not None else ft.get("home")
                away_score = et.get("away") if et.get("away") is not None else ft.get("away")
            else:
                home_score = ft.get("home")
                away_score = ft.get("away")
            if home_score is None or away_score is None:
                continue
            pen_home = pen_away = None
            if api_duration == "PENALTY_SHOOTOUT":
                pen = score_obj.get("penalties") or {}
                pen_home = pen.get("home")
                pen_away = pen.get("away")
            try:
                apply_match_result(
                    db, match.id, home_score, away_score,
                    status="finished",
                    duration=api_duration,
                    home_score_penalties=pen_home,
                    away_score_penalties=pen_away,
                )
                match.minute = None
                match.injury_time = None
                scored += 1
            except HTTPException as exc:
                logger.warning("Skipped scoring match", ext_id=ext_id, detail=exc.detail)

    db.commit()
    logger.info(
        "Results sync complete",
        competition_code=competition_code,
        scored=scored,
        live_updated=live_updated,
        suspended=suspended,
    )
    return {"scored": scored, "live_updated": live_updated, "suspended": suspended}


