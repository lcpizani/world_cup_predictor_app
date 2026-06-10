from datetime import datetime, timezone, timedelta
from typing import List

from icalendar import Calendar, Event

from app.models.match import Match
from app.services.email import _translate_team

UID_DOMAIN = "wcfootballpredictions.com"


def generate_fixtures_ics(matches: List[Match], locale: str = "en") -> bytes:
    cal = Calendar()
    cal.add("prodid", "-//WC Football Predictions//wcfootballpredictions.com//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("x-wr-calname", "WC 2026 Fixtures")

    for match in matches:
        event = Event()
        event.add("uid", f"match-{match.id}@{UID_DOMAIN}")
        home = _translate_team(match.home_team, locale)
        away = _translate_team(match.away_team, locale)
        event.add("summary", f"{home} vs {away}")

        kickoff = match.kickoff_at
        if kickoff.tzinfo is None:
            kickoff = kickoff.replace(tzinfo=timezone.utc)

        event.add("dtstart", kickoff)
        event.add("dtend", kickoff + timedelta(hours=2))

        if match.group:
            description = f"{match.stage.replace('_', ' ').title()} - {match.group}"
        else:
            description = match.stage.replace("_", " ").title()
        event.add("description", description)

        event.add("dtstamp", datetime.now(timezone.utc))

        cal.add_component(event)

    return cal.to_ical()
