"""
Integration with football-data.org API (v4).

Requires FOOTBALL_API_KEY in settings.
Free tier: 10 requests/minute, covers major competitions.
World Cup competition code: "WC"
"""
from datetime import datetime

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.match import Match
from app.services.scoring import apply_match_result

FOOTBALL_API_BASE = "https://api.football-data.org/v4"


def _headers() -> dict:
    if not settings.FOOTBALL_API_KEY:
        raise HTTPException(status_code=503, detail="FOOTBALL_API_KEY not configured")
    return {"X-Auth-Token": settings.FOOTBALL_API_KEY}


def sync_matches(db: Session, competition_code: str = "WC") -> dict:
    """Fetch fixtures from football-data.org and upsert Match rows."""
    with httpx.Client(timeout=15) as client:
        resp = client.get(
            f"{FOOTBALL_API_BASE}/competitions/{competition_code}/matches",
            headers=_headers(),
        )
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
            if existing.status != "finished":
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
    return {"upserted": upserted}


def sync_results(db: Session, competition_code: str = "WC") -> dict:
    """Fetch finished fixtures and score any un-scored matches."""
    with httpx.Client(timeout=15) as client:
        resp = client.get(
            f"{FOOTBALL_API_BASE}/competitions/{competition_code}/matches",
            headers=_headers(),
            params={"status": "FINISHED"},
        )
        resp.raise_for_status()
        data = resp.json()

    scored = 0
    for fixture in data.get("matches", []):
        ext_id = str(fixture["id"])
        match = db.query(Match).filter(Match.external_match_id == ext_id).first()
        if match is None or match.status == "finished":
            continue

        score = fixture.get("score", {}).get("fullTime", {})
        home_score = score.get("home")
        away_score = score.get("away")
        if home_score is None or away_score is None:
            continue

        try:
            apply_match_result(db, match.id, home_score, away_score, status="finished")
            scored += 1
        except HTTPException:
            pass  # Already applied or validation error — skip

    return {"scored": scored}
