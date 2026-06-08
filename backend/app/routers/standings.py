from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.group_standing import GroupStanding
from app.models.match import Match
from app.schemas.standings import BracketSlot, GroupData, GroupStandingRow, LiveMatchBadge
from app.schemas.match import MatchResponse

router = APIRouter()

# Hardcoded 2026 World Cup knockout bracket topology.
# slot_id corresponds to FIFA match numbers (73–104).
# R32 = 73–88, R16 = 89–96, QF = 97–100, SF = 101–102, 3rd = 103, Final = 104
#
# Pairings mirror the official FIFA 2026 knockout bracket (confirmed after the
# December 2025 draw). The bracket tree is NOT a naive "consecutive match numbers
# feed the next round" structure — e.g. M89 = Winner M74 vs Winner M77 — so both
# the R32 group placeholders and the _ADVANCEMENT feeder map below are transcribed
# directly from the published schedule rather than derived.
# Sources: en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage and FIFA/CBS.
_BRACKET_TOPOLOGY = [
    # ── Round of 32 ─────────────────────────────────────────────────────────
    {"slot_id": 73,  "round": "round_of_32", "home_label": "2nd Group A", "away_label": "2nd Group B"},
    {"slot_id": 74,  "round": "round_of_32", "home_label": "1st Group E", "away_label": "Best 3rd (A/B/C/D/F)"},
    {"slot_id": 75,  "round": "round_of_32", "home_label": "1st Group F", "away_label": "2nd Group C"},
    {"slot_id": 76,  "round": "round_of_32", "home_label": "1st Group C", "away_label": "2nd Group F"},
    {"slot_id": 77,  "round": "round_of_32", "home_label": "1st Group I", "away_label": "Best 3rd (C/D/F/G/H)"},
    {"slot_id": 78,  "round": "round_of_32", "home_label": "2nd Group E", "away_label": "2nd Group I"},
    {"slot_id": 79,  "round": "round_of_32", "home_label": "1st Group A", "away_label": "Best 3rd (C/E/F/H/I)"},
    {"slot_id": 80,  "round": "round_of_32", "home_label": "1st Group L", "away_label": "Best 3rd (E/H/I/J/K)"},
    {"slot_id": 81,  "round": "round_of_32", "home_label": "1st Group D", "away_label": "Best 3rd (B/E/F/I/J)"},
    {"slot_id": 82,  "round": "round_of_32", "home_label": "1st Group G", "away_label": "Best 3rd (A/E/H/I/J)"},
    {"slot_id": 83,  "round": "round_of_32", "home_label": "2nd Group K", "away_label": "2nd Group L"},
    {"slot_id": 84,  "round": "round_of_32", "home_label": "1st Group H", "away_label": "2nd Group J"},
    {"slot_id": 85,  "round": "round_of_32", "home_label": "1st Group B", "away_label": "Best 3rd (E/F/G/I/J)"},
    {"slot_id": 86,  "round": "round_of_32", "home_label": "1st Group J", "away_label": "2nd Group H"},
    {"slot_id": 87,  "round": "round_of_32", "home_label": "1st Group K", "away_label": "Best 3rd (D/E/I/J/L)"},
    {"slot_id": 88,  "round": "round_of_32", "home_label": "2nd Group D", "away_label": "2nd Group G"},
    # ── Round of 16 ─────────────────────────────────────────────────────────
    {"slot_id": 89,  "round": "round_of_16", "home_label": "Winner M74", "away_label": "Winner M77"},
    {"slot_id": 90,  "round": "round_of_16", "home_label": "Winner M73", "away_label": "Winner M75"},
    {"slot_id": 91,  "round": "round_of_16", "home_label": "Winner M76", "away_label": "Winner M78"},
    {"slot_id": 92,  "round": "round_of_16", "home_label": "Winner M79", "away_label": "Winner M80"},
    {"slot_id": 93,  "round": "round_of_16", "home_label": "Winner M83", "away_label": "Winner M84"},
    {"slot_id": 94,  "round": "round_of_16", "home_label": "Winner M81", "away_label": "Winner M82"},
    {"slot_id": 95,  "round": "round_of_16", "home_label": "Winner M86", "away_label": "Winner M88"},
    {"slot_id": 96,  "round": "round_of_16", "home_label": "Winner M85", "away_label": "Winner M87"},
    # ── Quarter Finals ───────────────────────────────────────────────────────
    {"slot_id": 97,  "round": "quarter_finals", "home_label": "Winner M89", "away_label": "Winner M90"},
    {"slot_id": 98,  "round": "quarter_finals", "home_label": "Winner M93", "away_label": "Winner M94"},
    {"slot_id": 99,  "round": "quarter_finals", "home_label": "Winner M91", "away_label": "Winner M92"},
    {"slot_id": 100, "round": "quarter_finals", "home_label": "Winner M95", "away_label": "Winner M96"},
    # ── Semi Finals ──────────────────────────────────────────────────────────
    {"slot_id": 101, "round": "semi_finals", "home_label": "Winner M97", "away_label": "Winner M98"},
    {"slot_id": 102, "round": "semi_finals", "home_label": "Winner M99", "away_label": "Winner M100"},
    # ── Third Place ──────────────────────────────────────────────────────────
    {"slot_id": 103, "round": "third_place", "home_label": "Loser M101", "away_label": "Loser M102"},
    # ── Final ────────────────────────────────────────────────────────────────
    {"slot_id": 104, "round": "final", "home_label": "Winner M101", "away_label": "Winner M102"},
]

# Maps each slot to the (feeder_slot_id, "winner"|"loser") pair for home and away.
_ADVANCEMENT: dict[int, dict[str, tuple[int, str]]] = {
    # R16
    89:  {"home": (74,  "winner"), "away": (77,  "winner")},
    90:  {"home": (73,  "winner"), "away": (75,  "winner")},
    91:  {"home": (76,  "winner"), "away": (78,  "winner")},
    92:  {"home": (79,  "winner"), "away": (80,  "winner")},
    93:  {"home": (83,  "winner"), "away": (84,  "winner")},
    94:  {"home": (81,  "winner"), "away": (82,  "winner")},
    95:  {"home": (86,  "winner"), "away": (88,  "winner")},
    96:  {"home": (85,  "winner"), "away": (87,  "winner")},
    # QF
    97:  {"home": (89,  "winner"), "away": (90,  "winner")},
    98:  {"home": (93,  "winner"), "away": (94,  "winner")},
    99:  {"home": (91,  "winner"), "away": (92,  "winner")},
    100: {"home": (95,  "winner"), "away": (96,  "winner")},
    # SF
    101: {"home": (97,  "winner"), "away": (98,  "winner")},
    102: {"home": (99,  "winner"), "away": (100, "winner")},
    # 3rd place (losers of SF)
    103: {"home": (101, "loser"),  "away": (102, "loser")},
    # Final
    104: {"home": (101, "winner"), "away": (102, "winner")},
}

_STAGE_TO_ROUND = {
    "round_of_32": "round_of_32",
    "round_of_16": "round_of_16",
    "quarter_finals": "quarter_finals",
    "semi_finals": "semi_finals",
    "third_place": "third_place",
    "final": "final",
}

# The FIFA match numbers (slot_ids) belonging to each round, in bracket order.
# Derived from the topology so the two never drift apart.
_ROUND_SLOT_IDS: dict[str, list[int]] = {}
for _entry in _BRACKET_TOPOLOGY:
    _ROUND_SLOT_IDS.setdefault(_entry["round"], []).append(_entry["slot_id"])


def _match_order_key(match: Match) -> tuple[int, int]:
    """Sort knockout matches within a stage so they line up with the FIFA slots.

    football-data.org assigns sequential external IDs in FIFA match-number order
    *within each stage* (the IDs themselves are not 73–104, but their ascending
    order within a round matches the bracket order). Matches without a numeric
    external ID sort last but stay deterministic.
    """
    try:
        return (0, int(match.external_match_id))
    except (TypeError, ValueError):
        return (1, 0)


def _winner_of(match: Match) -> str | None:
    if match.status != "finished" or match.home_score is None or match.away_score is None:
        return None
    if match.home_score > match.away_score:
        return match.home_team
    if match.away_score > match.home_score:
        return match.away_team
    return None


def _loser_of(match: Match) -> str | None:
    if match.status != "finished" or match.home_score is None or match.away_score is None:
        return None
    if match.home_score > match.away_score:
        return match.away_team
    if match.away_score > match.home_score:
        return match.home_team
    return None


def _resolve_label(slot_id: int, side: str, knockout_by_slot: dict[int, Match]) -> str | None:
    advancement = _ADVANCEMENT.get(slot_id)
    if not advancement:
        return None
    feeder_slot_id, role = advancement[side]
    feeder_match = knockout_by_slot.get(feeder_slot_id)
    if feeder_match is None:
        return None
    if role == "winner":
        return _winner_of(feeder_match)
    return _loser_of(feeder_match)


def _standings_from_matches(db: Session) -> list[GroupData]:
    """Derive zero-stat standings from group-stage fixtures when no sync has run yet."""
    group_stage_matches = (
        db.query(Match)
        .filter(Match.stage == "group_stage", Match.group.isnot(None))
        .all()
    )

    teams_by_group: dict[str, set[str]] = {}
    for match in group_stage_matches:
        group_key = match.group.replace("Group ", "GROUP_").replace(" ", "_").upper()  # type: ignore[union-attr]
        if group_key not in teams_by_group:
            teams_by_group[group_key] = set()
        teams_by_group[group_key].add(match.home_team)
        teams_by_group[group_key].add(match.away_team)

    result: list[GroupData] = []
    for group_key in sorted(teams_by_group):
        teams = sorted(teams_by_group[group_key])
        standings = [
            GroupStandingRow(
                position=pos,
                team_name=name,
                group=group_key,
                played=0, won=0, drawn=0, lost=0,
                goals_for=0, goals_against=0, goal_difference=0, points=0,
            )
            for pos, name in enumerate(teams, start=1)
        ]
        result.append(GroupData(group=group_key, standings=standings))

    return result


def _attach_live_badges(groups: dict[str, list[GroupStandingRow]], db: Session) -> None:
    """Stamp live_match badges onto standing rows for teams currently playing."""
    live_matches = (
        db.query(Match)
        .filter(
            Match.status == "live",
            Match.stage == "group_stage",
            Match.home_score.isnot(None),
            Match.away_score.isnot(None),
            Match.group.isnot(None),
        )
        .all()
    )
    if not live_matches:
        return

    badges: dict[str, LiveMatchBadge] = {}
    for match in live_matches:
        hs, as_ = match.home_score, match.away_score
        if hs > as_:
            home_result, away_result = "W", "L"
        elif hs < as_:
            home_result, away_result = "L", "W"
        else:
            home_result = away_result = "D"
        badges[match.home_team] = LiveMatchBadge(team_score=hs, opp_score=as_, result=home_result)
        badges[match.away_team] = LiveMatchBadge(team_score=as_, opp_score=hs, result=away_result)

    for rows in groups.values():
        for i, row in enumerate(rows):
            if row.team_name in badges:
                rows[i] = row.model_copy(update={"live_match": badges[row.team_name]})


@router.get("", response_model=List[GroupData])
def get_standings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = (
        db.query(GroupStanding)
        .order_by(GroupStanding.group, GroupStanding.position)
        .all()
    )

    if rows:
        groups: dict[str, list[GroupStandingRow]] = {}
        for row in rows:
            if row.group not in groups:
                groups[row.group] = []
            groups[row.group].append(GroupStandingRow.model_validate(row))

        # Fill in groups that have fixtures but no standings rows yet (e.g. only
        # some groups have played — recalculate only writes rows for played groups).
        for fallback in _standings_from_matches(db):
            if fallback.group not in groups:
                groups[fallback.group] = fallback.standings

        _attach_live_badges(groups, db)

        return [
            GroupData(group=group, standings=standings)
            for group, standings in sorted(groups.items())
        ]

    # No standings synced at all yet — derive all groups from fixtures
    return _standings_from_matches(db)


@router.get("/bracket", response_model=List[BracketSlot])
def get_bracket(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    knockout_by_slot: dict[int, Match] = {}

    knockout_matches = (
        db.query(Match)
        .filter(Match.stage.in_(list(_STAGE_TO_ROUND.keys())))
        .all()
    )
    # Link each stage's fixtures to its bracket slots. Rounds are processed in
    # dependency order (R32 first) so a round's feeder results are already linked
    # when we resolve the teams that have advanced into it.
    for round_name, slot_ids in _ROUND_SLOT_IDS.items():
        remaining = sorted(
            (m for m in knockout_matches if m.stage == round_name),
            key=_match_order_key,
        )

        # Primary link: attach a fixture to the slot whose advanced teams it
        # contains. football-data.org publishes knockout fixtures incrementally
        # and not necessarily in FIFA match-number order, so a positional mapping
        # would misroute live results — matching on the teams themselves is exact.
        for slot_id in slot_ids:
            home = _resolve_label(slot_id, "home", knockout_by_slot)
            away = _resolve_label(slot_id, "away", knockout_by_slot)
            if home is None or away is None:
                continue
            for match in remaining:
                if {match.home_team, match.away_team} == {home, away}:
                    knockout_by_slot[slot_id] = match
                    remaining.remove(match)
                    break

        # Fallback: any fixtures we couldn't resolve by teams (notably the Round
        # of 32, whose participants come from the group standings rather than from
        # feeder winners) fill the still-empty slots in FIFA match-number order,
        # i.e. ascending external ID within the round.
        empty_slots = [s for s in slot_ids if s not in knockout_by_slot]
        for slot_id, match in zip(empty_slots, remaining):
            knockout_by_slot[slot_id] = match

    slots: list[BracketSlot] = []
    for entry in _BRACKET_TOPOLOGY:
        slot_id = entry["slot_id"]
        match = knockout_by_slot.get(slot_id)

        if match:
            home_label = match.home_team
            away_label = match.away_team
        else:
            resolved_home = _resolve_label(slot_id, "home", knockout_by_slot)
            resolved_away = _resolve_label(slot_id, "away", knockout_by_slot)
            home_label = resolved_home if resolved_home is not None else entry["home_label"]
            away_label = resolved_away if resolved_away is not None else entry["away_label"]

        slots.append(BracketSlot(
            slot_id=slot_id,
            round=entry["round"],
            home_label=home_label,
            away_label=away_label,
            match=MatchResponse.model_validate(match) if match else None,
        ))

    return slots
