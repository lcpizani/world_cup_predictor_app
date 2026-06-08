# Scoring System

World Cup Predictor uses a four-category scoring system. Each league creator sets their own point values at creation time, so every league can feel different — but the categories and their logic are always the same.

---

## The four categories

| Category | What it means | Default points |
|---|---|---|
| **Exact score** | Your predicted scoreline matches exactly — e.g. predict 2-1, actual 2-1 | 5 |
| **Correct winner** | You picked the right outcome: home win, away win, or draw | 3 |
| **Correct goal difference** | The margin you predicted matches the actual margin — e.g. predict 3-1 (+2), actual 2-0 (+2) | 2 |
| **Correct goals (one team)** | You got the exact number of goals right for at least one team | 1 |

League creators can assign any point value (including 0) to any category. A category with 0 points is silently skipped — it won't appear in the audit log.

---

## Stage multiplier

Each league has a `double_points_from_stage` setting, configured at creation. From that stage onwards, **all point values are doubled** before being applied.

For example, if a league sets `double_points_from_stage = quarter_finals`:

| Stage | Multiplier |
|---|---|
| Group stage | ×1 |
| Round of 32 | ×1 |
| Round of 16 | ×1 |
| Quarter-finals | ×2 |
| Semi-finals | ×2 |
| Third place | ×2 |
| Final | ×2 |

The multiplier applies to each category individually, so an exact score in the final (with default 5 pts) scores 10. The stage order used is: `group_stage → round_of_32 → round_of_16 → quarter_finals → semi_finals → third_place → final`.

---

## Stacking rules

**Exact score is exclusive.** If you nail the exact score, only the exact score category fires — the other three don't stack on top. This keeps the maximum per-prediction points clean.

**All other categories stack freely.** If you don't hit the exact score, any combination of the remaining three categories can fire — up to 3+2+1 = 6 points from them. This means a "wrong score but right outcome and right margin" prediction (e.g. predict 2-0, actual 3-0) can outscore an exact score in a league with high partial-credit values, by design.

---

## Worked examples

### Example 1 — Exact score

| | Home | Away |
|---|---|---|
| **Predicted** | 2 | 1 |
| **Actual** | 2 | 1 |

| Category | Fires? | Points |
|---|---|---|
| Exact score | ✅ Yes | 5 |
| Correct winner | ❌ No (blocked by exact score) | — |
| Correct goal difference | ❌ No (blocked by exact score) | — |
| Correct goals (one team) | ❌ No (blocked by exact score) | — |
| **Total** | | **5** |

---

### Example 2 — Partial match (correct winner + correct goal difference)

| | Home | Away |
|---|---|---|
| **Predicted** | 3 | 1 |
| **Actual** | 2 | 0 |

Both predicted (+2 margin, home win) and actual (+2 margin, home win) agree on outcome and margin, but neither the exact score nor any individual team's goals match.

| Category | Fires? | Points |
|---|---|---|
| Exact score | ❌ No | — |
| Correct winner | ✅ Yes (both home wins) | 3 |
| Correct goal difference | ✅ Yes (both +2) | 2 |
| Correct goals (one team) | ❌ No (3≠2, 1≠0) | — |
| **Total** | | **5** |

---

### Example 3 — Correct winner only

| | Home | Away |
|---|---|---|
| **Predicted** | 1 | 0 |
| **Actual** | 3 | 1 |

| Category | Fires? | Points |
|---|---|---|
| Exact score | ❌ No | — |
| Correct winner | ✅ Yes (both home wins) | 3 |
| Correct goal difference | ❌ No (+1 vs +2) | — |
| Correct goals (one team) | ❌ No (1≠3, 0≠1) | — |
| **Total** | | **3** |

---

## How scoring is applied

When a match finishes:

1. The background scheduler polls football-data.org and detects the final result.
2. Predictions for that match are **locked** the moment the match goes live — no more edits.
3. The scoring engine runs `compute_points_for_prediction()` — a pure function — for every prediction across all leagues.
4. For each category that fires, a `PointEvent` row is written to the database (the audit log).
5. `points_awarded` on the prediction and `total_points` on the league membership are updated.
6. The leaderboard immediately reflects the new totals.

The scoring function is deterministic and stateless — given the same prediction, match result, and scoring rules, it always produces the same output.

---

## Admin recompute

If a match result is entered incorrectly (e.g. via the admin panel) and then corrected, an admin can trigger a **full recompute** for any league:

1. All `PointEvent` rows for that league are deleted.
2. All `total_points` and `points_awarded` values are reset to zero.
3. Scoring is re-run from scratch for every finished match in the league.

Recompute is **idempotent** — running it multiple times produces the same result. It's safe to trigger after any correction. Access it via the admin panel (`/admin`) or the API endpoint `POST /admin/tournaments/{id}/recompute`.
