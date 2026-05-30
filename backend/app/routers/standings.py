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
_BRACKET_TOPOLOGY = [
    # ── Round of 32 ─────────────────────────────────────────────────────────
    {"slot_id": 73,  "round": "round_of_32", "home_label": "1st Group A", "away_label": "Best 3rd (C/D/E/F)"},
    {"slot_id": 74,  "round": "round_of_32", "home_label": "1st Group B", "away_label": "Best 3rd (A/C/D/E/F)"},
    {"slot_id": 75,  "round": "round_of_32", "home_label": "1st Group C", "away_label": "2nd Group A"},
    {"slot_id": 76,  "round": "round_of_32", "home_label": "1st Group D", "away_label": "2nd Group B"},
    {"slot_id": 77,  "round": "round_of_32", "home_label": "1st Group E", "away_label": "2nd Group C"},
    {"slot_id": 78,  "round": "round_of_32", "home_label": "1st Group F", "away_label": "2nd Group D"},
    {"slot_id": 79,  "round": "round_of_32", "home_label": "1st Group G", "away_label": "2nd Group E"},
    {"slot_id": 80,  "round": "round_of_32", "home_label": "1st Group H", "away_label": "2nd Group F"},
    {"slot_id": 81,  "round": "round_of_32", "home_label": "1st Group I", "away_label": "2nd Group G"},
    {"slot_id": 82,  "round": "round_of_32", "home_label": "1st Group J", "away_label": "2nd Group H"},
    {"slot_id": 83,  "round": "round_of_32", "home_label": "1st Group K", "away_label": "2nd Group I"},
    {"slot_id": 84,  "round": "round_of_32", "home_label": "1st Group L", "away_label": "2nd Group J"},
    {"slot_id": 85,  "round": "round_of_32", "home_label": "Best 3rd (A/B/G/H)", "away_label": "2nd Group K"},
    {"slot_id": 86,  "round": "round_of_32", "home_label": "Best 3rd (A/B/C/D)", "away_label": "2nd Group L"},
    {"slot_id": 87,  "round": "round_of_32", "home_label": "Best 3rd (I/J/K/L)", "away_label": "Best 3rd (E/F/G/H)"},
    {"slot_id": 88,  "round": "round_of_32", "home_label": "Best 3rd (A/B/E/F)", "away_label": "Best 3rd (C/D/I/J)"},
    # ── Round of 16 ─────────────────────────────────────────────────────────
    {"slot_id": 89,  "round": "round_of_16", "home_label": "Winner M73", "away_label": "Winner M74"},
    {"slot_id": 90,  "round": "round_of_16", "home_label": "Winner M75", "away_label": "Winner M76"},
    {"slot_id": 91,  "round": "round_of_16", "home_label": "Winner M77", "away_label": "Winner M78"},
    {"slot_id": 92,  "round": "round_of_16", "home_label": "Winner M79", "away_label": "Winner M80"},
    {"slot_id": 93,  "round": "round_of_16", "home_label": "Winner M81", "away_label": "Winner M82"},
    {"slot_id": 94,  "round": "round_of_16", "home_label": "Winner M83", "away_label": "Winner M84"},
    {"slot_id": 95,  "round": "round_of_16", "home_label": "Winner M85", "away_label": "Winner M86"},
    {"slot_id": 96,  "round": "round_of_16", "home_label": "Winner M87", "away_label": "Winner M88"},
    # ── Quarter Finals ───────────────────────────────────────────────────────
    {"slot_id": 97,  "round": "quarter_finals", "home_label": "Winner M89", "away_label": "Winner M90"},
    {"slot_id": 98,  "round": "quarter_finals", "home_label": "Winner M91", "away_label": "Winner M92"},
    {"slot_id": 99,  "round": "quarter_finals", "home_label": "Winner M93", "away_label": "Winner M94"},
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
# Used to resolve team names dynamically when the next-round DB match doesn't exist yet.
_ADVANCEMENT: dict[int, dict[str, tuple[int, str]]] = {
    # R16
    89:  {"home": (73,  "winner"), "away": (74,  "winner")},
    90:  {"home": (75,  "winner"), "away": (76,  "winner")},
    91:  {"home": (77,  "winner"), "away": (78,  "winner")},
    92:  {"home": (79,  "winner"), "away": (80,  "winner")},
    93:  {"home": (81,  "winner"), "away": (82,  "winner")},
    94:  {"home": (83,  "winner"), "away": (84,  "winner")},
    95:  {"home": (85,  "winner"), "away": (86,  "winner")},
    96:  {"home": (87,  "winner"), "away": (88,  "winner")},
    # QF
    97:  {"home": (89,  "winner"), "away": (90,  "winner")},
    98:  {"home": (91,  "winner"), "away": (92,  "winner")},
    99:  {"home": (93,  "winner"), "away": (94,  "winner")},
    100: {"home": (95,  "winner"), "away": (96,  "winner")},
    # SF
    101: {"home": (97,  "winner"), "away": (98,  "winner")},
    102: {"home": (99,  "winner"), "away": (100, "winner")},
    # 3rd place (losers of SF)
    103: {"home": (101, "loser"),  "away": (102, "loser")},
    # Final
    104: {"home": (101, "winner"), "away": (102, "winner")},
}

# Map stage string values from the DB to the round labels in the topology
_STAGE_TO_ROUND = {
    "round_of_32": "round_of_32",
    "round_of_16": "round_of_16",
    "quarter_finals": "quarter_finals",
    "semi_finals": "semi_finals",
    "third_place": "third_place",
    "final": "final",
}


def _winner_of(match: Match) -> str | None:
    """Return the winning team name, or None if not yet finished or a draw."""
    if match.status != "finished" or match.home_score is None or match.away_score is None:
        return None
    if match.home_score > match.away_score:
        return match.home_team
    if match.away_score > match.home_score:
        return match.away_team
    return None  # draw (shouldn't happen in knockout, but be safe)


def _loser_of(match: Match) -> str | None:
    """Return the losing team name, or None if not yet finished or a draw."""
    if match.status != "finished" or match.home_score is None or match.away_score is None:
        return None
    if match.home_score > match.away_score:
        return match.away_team
    if match.away_score > match.home_score:
        return match.home_team
    return None


def _resolve_label(slot_id: int, side: str, knockout_by_slot: dict[int, Match]) -> str | None:
    """Resolve a bracket label from the advancement map. Returns team name or None."""
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


def _build_live_delta(live_matches: list[Match]) -> tuple[
    dict[str, dict],  # team_name -> delta stats
    dict[str, "LiveMatchBadge"],  # team_name -> badge
]:
    """Compute provisional stats delta and live badges from live matches."""
    delta: dict[str, dict] = {}
    badges: dict[str, LiveMatchBadge] = {}

    for match in live_matches:
        hs = match.home_score or 0
        as_ = match.away_score or 0

        if hs > as_:
            home_result, away_result = "W", "L"
            home_pts, away_pts = 3, 0
            home_w, home_d, home_l = 1, 0, 0
            away_w, away_d, away_l = 0, 0, 1
        elif hs < as_:
            home_result, away_result = "L", "W"
            home_pts, away_pts = 0, 3
            home_w, home_d, home_l = 0, 0, 1
            away_w, away_d, away_l = 1, 0, 0
        else:
            home_result, away_result = "D", "D"
            home_pts = away_pts = 1
            home_w = home_l = away_w = away_l = 0
            home_d = away_d = 1

        for team, gf, ga, result, pts, w, d, l in [
            (match.home_team, hs, as_, home_result, home_pts, home_w, home_d, home_l),
            (match.away_team, as_, hs, away_result, away_pts, away_w, away_d, away_l),
        ]:
            delta[team] = {
                "played": 1, "won": w, "drawn": d, "lost": l,
                "goals_for": gf, "goals_against": ga,
                "goal_difference": gf - ga, "points": pts,
            }
            opp_score = ga  # from team's POV, opponent scored 'ga'
            badges[team] = LiveMatchBadge(team_score=gf, opp_score=opp_score, result=result)

    return delta, badges


def _apply_live_delta(
    groups: dict[str, list[GroupStandingRow]],
    delta: dict[str, dict],
    badges: dict[str, "LiveMatchBadge"],
) -> dict[str, list[GroupStandingRow]]:
    """Merge live delta into standing rows and attach live_match badges. Re-sorts each group."""
    result: dict[str, list[GroupStandingRow]] = {}
    for group, rows in groups.items():
        merged = []
        for row in rows:
            d = delta.get(row.team_name)
            if d:
                row = GroupStandingRow(
                    position=row.position,
                    team_name=row.team_name,
                    group=row.group,
                    played=row.played + d["played"],
                    won=row.won + d["won"],
                    drawn=row.drawn + d["drawn"],
                    lost=row.lost + d["lost"],
                    goals_for=row.goals_for + d["goals_for"],
                    goals_against=row.goals_against + d["goals_against"],
                    goal_difference=row.goal_difference + d["goal_difference"],
                    points=row.points + d["points"],
                    live_match=badges.get(row.team_name),
                )
            merged.append(row)

        # Re-sort: pts desc → GD desc → GF desc
        merged.sort(key=lambda r: (-r.points, -r.goal_difference, -r.goals_for))
        for i, r in enumerate(merged, start=1):
            object.__setattr__(r, "position", i) if hasattr(r, "__slots__") else None
            # Pydantic v2: rebuild with updated position
            merged[i - 1] = r.model_copy(update={"position": i})

        result[group] = merged
    return result


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

    # Build base groups dict
    if rows:
        groups: dict[str, list[GroupStandingRow]] = {}
        for row in rows:
            if row.group not in groups:
                groups[row.group] = []
            groups[row.group].append(GroupStandingRow.model_validate(row))
    else:
        # No standings synced yet — derive structure from fixtures with zero stats
        fallback = _standings_from_matches(db)
        groups = {g.group: g.standings for g in fallback}

    # Merge live match deltas
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

    if live_matches:
        delta, badges = _build_live_delta(live_matches)
        groups = _apply_live_delta(groups, delta, badges)

    return [
        GroupData(group=group, standings=standings)
        for group, standings in sorted(groups.items())
    ]


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
    for match in knockout_matches:
        if match.external_match_id:
            try:
                slot_id = int(match.external_match_id)
                knockout_by_slot[slot_id] = match
            except (ValueError, TypeError):
                pass

    slots: list[BracketSlot] = []
    for entry in _BRACKET_TOPOLOGY:
        slot_id = entry["slot_id"]
        match = knockout_by_slot.get(slot_id)

        if match:
            # DB record takes precedence — use actual team names
            home_label = match.home_team
            away_label = match.away_team
        else:
            # Attempt to resolve from advancement map
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
