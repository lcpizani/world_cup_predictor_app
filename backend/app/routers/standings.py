from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.group_standing import GroupStanding
from app.models.match import Match
from app.schemas.standings import BracketSlot, GroupData, GroupStandingRow
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

# Map stage string values from the DB to the round labels in the topology
_STAGE_TO_ROUND = {
    "round_of_32": "round_of_32",
    "round_of_16": "round_of_16",
    "quarter_finals": "quarter_finals",
    "semi_finals": "semi_finals",
    "third_place": "third_place",
    "final": "final",
}


def _standings_from_matches(db: Session) -> list[GroupData]:
    """Derive zero-stat standings from group-stage fixtures when no sync has run yet."""
    group_stage_matches = (
        db.query(Match)
        .filter(Match.stage == "group_stage", Match.group.isnot(None))
        .all()
    )

    # Collect unique teams per group, normalising "Group A" → "GROUP_A"
    teams_by_group: dict[str, set[str]] = {}
    for match in group_stage_matches:
        # matches.group is stored as "Group A" by sync_matches; convert to "GROUP_A"
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

    if rows:
        groups: dict[str, list[GroupStandingRow]] = {}
        for row in rows:
            if row.group not in groups:
                groups[row.group] = []
            groups[row.group].append(GroupStandingRow.model_validate(row))
        return [
            GroupData(group=group, standings=standings)
            for group, standings in sorted(groups.items())
        ]

    # No standings synced yet — derive structure from fixtures with zero stats
    return _standings_from_matches(db)


@router.get("/bracket", response_model=List[BracketSlot])
def get_bracket(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Fetch all knockout matches indexed by external_match_id
    knockout_by_ext_id: dict[str, Match] = {}
    knockout_by_slot: dict[int, Match] = {}

    knockout_matches = (
        db.query(Match)
        .filter(Match.stage.in_(list(_STAGE_TO_ROUND.keys())))
        .all()
    )
    for match in knockout_matches:
        if match.external_match_id:
            ext_id = match.external_match_id
            # football-data.org match IDs 73–104 correspond to slot_ids
            try:
                slot_id = int(ext_id)
                knockout_by_slot[slot_id] = match
            except (ValueError, TypeError):
                pass
        knockout_by_ext_id[match.external_match_id or ""] = match

    slots: list[BracketSlot] = []
    for entry in _BRACKET_TOPOLOGY:
        slot_id = entry["slot_id"]
        match = knockout_by_slot.get(slot_id)

        home_label = entry["home_label"]
        away_label = entry["away_label"]

        if match:
            home_label = match.home_team
            away_label = match.away_team

        slots.append(BracketSlot(
            slot_id=slot_id,
            round=entry["round"],
            home_label=home_label,
            away_label=away_label,
            match=MatchResponse.model_validate(match) if match else None,
        ))

    return slots
