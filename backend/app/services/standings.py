"""Calculate group standings from finished match results stored in the DB.

This is the authoritative recalculation path — used whenever a match result
is applied (manually or via API sync) so standings always reflect real game data.

Sorting follows FIFA 2026 tiebreaker rules (applied in order):
  1. Points
  2. Goal difference
  3. Goals scored
  4. Head-to-head points (among the tied cluster)
  5. Head-to-head goal difference (among the tied cluster)
  6. Head-to-head goals scored (among the tied cluster)
"""
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.group_standing import GroupStanding
from app.models.match import Match


def _h2h_sort(
    cluster: list[tuple[str, dict]],
    grp_matches: list,
) -> list[tuple[str, dict]]:
    """Re-sort a cluster of teams that are tied on pts/GD/GF using head-to-head."""
    team_set = {t for t, _ in cluster}
    h2h: dict[str, dict] = {t: {"pts": 0, "gd": 0, "gf": 0} for t in team_set}

    for m in grp_matches:
        if m.home_team not in team_set or m.away_team not in team_set:
            continue
        hs, as_ = m.home_score, m.away_score
        h2h[m.home_team]["gf"] += hs
        h2h[m.away_team]["gf"] += as_
        h2h[m.home_team]["gd"] += hs - as_
        h2h[m.away_team]["gd"] += as_ - hs
        if hs > as_:
            h2h[m.home_team]["pts"] += 3
        elif as_ > hs:
            h2h[m.away_team]["pts"] += 3
        else:
            h2h[m.home_team]["pts"] += 1
            h2h[m.away_team]["pts"] += 1

    return sorted(
        cluster,
        key=lambda x: (h2h[x[0]]["pts"], h2h[x[0]]["gd"], h2h[x[0]]["gf"]),
        reverse=True,
    )


def _sort_group(
    teams_items: list[tuple[str, dict]],
    grp_matches: list,
) -> list[tuple[str, dict]]:
    """Sort a group's teams by FIFA tiebreaker rules (pts → GD → GF → H2H)."""
    def primary_key(item: tuple[str, dict]) -> tuple:
        s = item[1]
        return (s["won"] * 3 + s["drawn"], s["gf"] - s["ga"], s["gf"])

    primary = sorted(teams_items, key=primary_key, reverse=True)

    # Find clusters of teams still tied after the primary sort and apply H2H.
    result: list[tuple[str, dict]] = []
    i = 0
    while i < len(primary):
        j = i + 1
        while j < len(primary) and primary_key(primary[j]) == primary_key(primary[i]):
            j += 1
        cluster = primary[i:j]
        result.extend(_h2h_sort(cluster, grp_matches) if len(cluster) > 1 else cluster)
        i = j

    return result


def recalculate_standings_from_matches(db: Session, group: Optional[str] = None) -> dict:
    """Recompute group_standings rows from all known group-stage teams.

    Builds a full team roster from ALL group-stage matches (any status), so
    every team appears in standings with zeros even before any game is played.
    Stats are then overlaid from finished/live matches only.

    If `group` is given (e.g. "Group A"), only that group is recalculated.
    Returns {"recalculated": <number of rows written>}.
    """
    # Step 1: Build zeroed roster from ALL group-stage matches (any status).
    roster_query = db.query(Match).filter(
        Match.stage == "group_stage",
        Match.group.isnot(None),
    )
    if group:
        roster_query = roster_query.filter(Match.group == group)

    zero_stats = lambda: {"played": 0, "won": 0, "drawn": 0, "lost": 0, "gf": 0, "ga": 0}
    group_data: dict = defaultdict(lambda: defaultdict(zero_stats))

    for match in roster_query.all():
        _ = group_data[match.group][match.home_team]
        _ = group_data[match.group][match.away_team]

    # Step 2: Overlay real stats from finished/live matches.
    results_query = db.query(Match).filter(
        Match.status.in_(["finished", "live"]),
        Match.stage == "group_stage",
        Match.home_score.isnot(None),
        Match.away_score.isnot(None),
        Match.group.isnot(None),
    )
    if group:
        results_query = results_query.filter(Match.group == group)

    finished_matches = results_query.all()

    # Index finished matches by group so H2H lookup is O(group_size) not O(all).
    matches_by_group: dict[str, list] = defaultdict(list)
    for m in finished_matches:
        matches_by_group[m.group].append(m)
        grp = m.group
        hs, as_ = m.home_score, m.away_score

        for team, gf, ga in [(m.home_team, hs, as_), (m.away_team, as_, hs)]:
            group_data[grp][team]["played"] += 1
            group_data[grp][team]["gf"] += gf
            group_data[grp][team]["ga"] += ga

        if hs > as_:
            group_data[grp][m.home_team]["won"] += 1
            group_data[grp][m.away_team]["lost"] += 1
        elif hs < as_:
            group_data[grp][m.away_team]["won"] += 1
            group_data[grp][m.home_team]["lost"] += 1
        else:
            group_data[grp][m.home_team]["drawn"] += 1
            group_data[grp][m.away_team]["drawn"] += 1

    now = datetime.now(timezone.utc)
    total_rows = 0

    for grp, teams in group_data.items():
        # Match.group is stored as "Group A"; GroupStanding.group uses "GROUP_A"
        normalized_group = grp.upper().replace(" ", "_")

        sorted_teams = _sort_group(list(teams.items()), matches_by_group[grp])

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
