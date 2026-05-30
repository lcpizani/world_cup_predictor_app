"""Calculate group standings from finished match results stored in the DB.

This is the authoritative recalculation path — used whenever a match result
is applied (manually or via API sync) so standings always reflect real game data.
"""
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.group_standing import GroupStanding
from app.models.match import Match


def recalculate_standings_from_matches(db: Session, group: Optional[str] = None) -> dict:
    """Recompute group_standings rows from finished group-stage matches in the DB.

    If `group` is given (e.g. "Group A"), only that group is recalculated.
    Returns {"recalculated": <number of rows written>}.
    """
    query = db.query(Match).filter(
        Match.status == "finished",
        Match.stage == "group_stage",
        Match.home_score.isnot(None),
        Match.away_score.isnot(None),
        Match.group.isnot(None),
    )
    if group:
        query = query.filter(Match.group == group)

    matches = query.all()

    # Accumulate stats per group → team
    group_data: dict = defaultdict(lambda: defaultdict(lambda: {
        "played": 0, "won": 0, "drawn": 0, "lost": 0, "gf": 0, "ga": 0,
    }))

    for match in matches:
        grp = match.group
        hs, as_ = match.home_score, match.away_score

        for team, gf, ga in [
            (match.home_team, hs, as_),
            (match.away_team, as_, hs),
        ]:
            group_data[grp][team]["played"] += 1
            group_data[grp][team]["gf"] += gf
            group_data[grp][team]["ga"] += ga

        if hs > as_:
            group_data[grp][match.home_team]["won"] += 1
            group_data[grp][match.away_team]["lost"] += 1
        elif hs < as_:
            group_data[grp][match.away_team]["won"] += 1
            group_data[grp][match.home_team]["lost"] += 1
        else:
            group_data[grp][match.home_team]["drawn"] += 1
            group_data[grp][match.away_team]["drawn"] += 1

    now = datetime.now(timezone.utc)
    total_rows = 0

    for grp, teams in group_data.items():
        # Match.group is stored as "Group A"; GroupStanding.group uses "GROUP_A"
        normalized_group = grp.upper().replace(" ", "_")

        sorted_teams = sorted(
            teams.items(),
            key=lambda x: (
                x[1]["won"] * 3 + x[1]["drawn"],
                x[1]["gf"] - x[1]["ga"],
                x[1]["gf"],
            ),
            reverse=True,
        )

        db.query(GroupStanding).filter(
            GroupStanding.group == normalized_group
        ).delete(synchronize_session=False)

        for position, (team_name, stats) in enumerate(sorted_teams, start=1):
            gf = stats["gf"]
            ga = stats["ga"]
            db.add(GroupStanding(
                group=normalized_group,
                position=position,
                team_name=team_name,
                played=stats["played"],
                won=stats["won"],
                drawn=stats["drawn"],
                lost=stats["lost"],
                goals_for=gf,
                goals_against=ga,
                goal_difference=gf - ga,
                points=stats["won"] * 3 + stats["drawn"],
                synced_at=now,
            ))
            total_rows += 1

    db.commit()
    return {"recalculated": total_rows}
