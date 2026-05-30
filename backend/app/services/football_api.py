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
from app.models.group_standing import GroupStanding
from app.services.scoring import apply_match_result

FOOTBALL_API_BASE = "https://api.football-data.org/v4"

_LIVE_STATUSES = {"IN_PLAY", "PAUSED"}
_EDGE_STATUSES = {"CANCELLED", "POSTPONED", "SUSPENDED", "AWARDED"}
_ALLOWED_COMPETITION_CODES = {"WC", "EC", "PL", "PD", "BL1", "SA", "FL1", "CL", "EL"}


def _headers() -> dict:
    if not settings.FOOTBALL_API_KEY:
        raise HTTPException(status_code=503, detail="FOOTBALL_API_KEY not configured")
    return {"X-Auth-Token": settings.FOOTBALL_API_KEY}


def _validate_competition_code(code: str) -> None:
    if code not in _ALLOWED_COMPETITION_CODES:
        raise HTTPException(status_code=400, detail=f"Unknown competition code '{code}'")


def _map_api_status(api_status: str) -> str:
    if api_status in ("SCHEDULED", "TIMED"):
        return "scheduled"
    if api_status in _LIVE_STATUSES:
        return "live"
    if api_status == "FINISHED":
        return "finished"
    return "suspended"


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

    upserted = 0
    for fixture in data.get("matches", []):
        ext_id = str(fixture["id"])
        kickoff = datetime.fromisoformat(fixture["utcDate"].replace("Z", "+00:00"))
        home = fixture["homeTeam"].get("name")
        away = fixture["awayTeam"].get("name")
        stage = fixture.get("stage", "GROUP_STAGE").lower()
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
        upserted += 1

    db.commit()
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

        if internal_status == "live":
            score = fixture.get("score", {}).get("fullTime", {})
            # Use regular time score; fall back to half-time if full-time not yet set
            home_score = score.get("home")
            away_score = score.get("away")
            if home_score is None or away_score is None:
                ht = fixture.get("score", {}).get("halfTime", {})
                home_score = ht.get("home")
                away_score = ht.get("away")
            if home_score is not None and away_score is not None:
                match.status = "live"
                match.home_score = home_score
                match.away_score = away_score
                db.add(match)
                live_updated += 1
            continue

        if internal_status == "finished":
            score = fixture.get("score", {}).get("fullTime", {})
            home_score = score.get("home")
            away_score = score.get("away")
            if home_score is None or away_score is None:
                continue
            try:
                apply_match_result(db, match.id, home_score, away_score, status="finished")
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


def sync_standings(db: Session, competition_code: str = "WC") -> dict:
    """Fetch group standings from football-data.org and upsert into group_standings."""
    _validate_competition_code(competition_code)
    logger.info("Fetching standings from football-data.org", competition_code=competition_code)
    with httpx.Client(timeout=15) as client:
        resp = client.get(
            f"{FOOTBALL_API_BASE}/competitions/{competition_code}/standings",
            headers=_headers(),
        )
        if not resp.is_success:
            logger.error("football-data.org standings request failed", status_code=resp.status_code, competition_code=competition_code)
        resp.raise_for_status()
        data = resp.json()

    now = datetime.now(timezone.utc)
    total_rows = 0

    for standing in data.get("standings", []):
        if standing.get("type") != "TOTAL":
            continue

        stage = standing.get("stage", "")
        # Skip non-group entries (e.g. "ALL" which the API returns before group stage starts)
        if not stage.startswith("GROUP_"):
            continue

        group = stage  # already in "GROUP_A" format

        rows = standing.get("table", [])

        # Delete existing rows for this group, then insert fresh data
        db.query(GroupStanding).filter(GroupStanding.group == group).delete(synchronize_session=False)

        for row in rows:
            db.add(GroupStanding(
                group=group,
                position=row["position"],
                team_name=row["team"]["name"],
                played=row.get("playedGames", 0),
                won=row.get("won", 0),
                drawn=row.get("draw", 0),
                lost=row.get("lost", 0),
                goals_for=row.get("goalsFor", 0),
                goals_against=row.get("goalsAgainst", 0),
                goal_difference=row.get("goalDifference", 0),
                points=row.get("points", 0),
                synced_at=now,
            ))
            total_rows += 1

    db.commit()
    logger.info("Standings sync complete", competition_code=competition_code, synced=total_rows)
    return {"synced": total_rows}
