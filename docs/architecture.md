# ⚽ World Cup Predictor

A full-stack prediction league app for the FIFA 2026 World Cup. Friends create private leagues, submit score predictions for every match, and earn points based on how accurate they are — with a live leaderboard and bracket that update as results come in.

---

## Table of Contents

- [What it is](#what-it-is)
- [How it works](#how-it-works)
- [Scoring system](#scoring-system) — see also [docs/scoring.md](scoring.md) for a deep dive with worked examples
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Database schema](#database-schema)
- [Getting started](#getting-started)
- [Running with Docker](#running-with-docker)
- [Running locally (dev)](#running-locally-dev)
- [Simulation script](#simulation-script)

---

## What it is

World Cup Predictor is a private prediction league platform. The core loop is:

1. A user **creates a league** and shares an invite code with friends.
2. Friends **join the league** using that code.
3. Everyone **submits score predictions** for each World Cup match before kickoff.
4. When a match finishes, the app **automatically fetches the result** from a live football data API and **scores all predictions**.
5. The **leaderboard** updates in real time to show who's winning the league.
6. A **live bracket** tracks the knockout stage, advancing teams automatically as each round is completed.

Each league creator sets their own **scoring rules** — you can weight exact scores more heavily, reward any correct winner equally, and choose from which stage points are doubled. This makes every league feel different.

---

## How it works

### User flow

```
Register / Log in
        ↓
Create a league (set scoring rules + share invite code)
    OR
Join a league (enter invite code)
        ↓
Browse upcoming matches → submit score predictions (before kickoff)
        ↓
Watch the leaderboard + bracket as results come in
```

### What happens when a match finishes

1. The background scheduler (running inside the API server) polls **football-data.org** periodically for finished results.
2. When a match goes `live`, all predictions for that match are **locked** — no more edits.
3. When the match reaches `finished`, the **scoring engine** runs:
   - Loads every prediction for that match across all leagues.
   - For each prediction, computes which scoring categories were hit (applying any stage multiplier).
   - Writes a `PointEvent` row per earned category (the audit log).
   - Updates `points_awarded` on the prediction and `total_points` on the league member.
4. **Group standings** are recalculated immediately from match results, with full FIFA tiebreaker rules applied (pts → GD → GF → head-to-head pts → head-to-head GD → head-to-head GF).
5. The leaderboard and bracket immediately reflect the new state.

---

## Scoring system

Each league has its own scoring rules, configured at creation. There are four categories:

| Category | When it fires | Default points |
|---|---|---|
| **Exact score** (`correct_result`) | Predicted score matches exactly (e.g. predict 2-1, actual 2-1) | 5 |
| **Correct winner** (`correct_winner`) | Predicted the right outcome (home win / draw / away win) | 3 |
| **Correct goal difference** (`correct_goal_diff`) | Predicted the right margin (e.g. predict 3-1, actual 2-0 — both +2) | 2 |
| **Correct goals one team** (`correct_goals_one_team`) | Predicted the right score for at least one team | 1 |

**Stacking rules:**
- If you hit the **exact score**, only `correct_result` fires — the other categories don't stack on top.
- If you don't hit the exact score, the other three categories stack freely.
- Any category with 0 points assigned is silently skipped.

**Stage multiplier:** Leagues can configure a `double_points_from_stage` threshold. From that stage onwards (e.g. from `quarter_finals`), all point values are doubled. Points are stored individually per `PointEvent` so the audit log is always accurate.

---

## Tech stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (Python 3.12) |
| ORM | SQLAlchemy 2.x (sync) |
| Database | PostgreSQL 16 |
| Migrations | Alembic |
| Config | pydantic-settings (`.env`) |
| Auth | JWT via `python-jose`, passwords via `passlib` (bcrypt) |
| Football API client | `httpx` → football-data.org v4 |
| Background scheduler | APScheduler (`BackgroundScheduler`) |
| Logging | structlog (JSON output, GCP-compatible) |
| Rate limiting | slowapi |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Data fetching | TanStack React Query v5 |
| i18n | next-intl (English + Portuguese) |
| Auth token storage | `js-cookie` (cookie-based) |

### Infrastructure
| Tool | Purpose |
|---|---|
| Docker Compose | Local dev: spins up Postgres + API together |
| Alembic | Database migrations |

---

## Project structure

```
world_cup_predictor_app/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan (scheduler), CORS, routers
│   │   ├── config.py            # All settings via pydantic-settings + .env
│   │   ├── database.py          # SQLAlchemy engine, SessionLocal, Base, get_db()
│   │   ├── dependencies.py      # get_current_user() / get_admin_user() JWT deps
│   │   ├── limiter.py           # slowapi rate limiter setup
│   │   ├── logger.py            # structlog JSON logger
│   │   ├── models/
│   │   │   ├── user.py          # User
│   │   │   ├── tournament.py    # Tournament, TournamentScoringRules, TournamentMember
│   │   │   ├── match.py         # Match (World Cup fixtures + results)
│   │   │   ├── prediction.py    # Prediction (one per user per match)
│   │   │   ├── point_event.py   # PointEvent (scoring audit log)
│   │   │   └── group_standing.py # GroupStanding (live group table rows)
│   │   ├── schemas/
│   │   │   ├── auth.py          # TokenResponse
│   │   │   ├── user.py          # UserCreate, UserResponse
│   │   │   ├── tournament.py    # TournamentCreate/Response, ScoringRules, Member
│   │   │   ├── match.py         # MatchCreate/Response, MatchScoreUpdate
│   │   │   ├── prediction.py    # PredictionCreate/Response, PointEventResponse
│   │   │   ├── leaderboard.py   # LeaderboardEntry, LeaderboardResponse
│   │   │   └── standings.py     # GroupData, GroupStandingRow, BracketSlot, LiveMatchBadge
│   │   ├── routers/
│   │   │   ├── auth.py          # POST /auth/register, /login; GET /me
│   │   │   ├── tournaments.py   # CRUD + join + leaderboard + compare
│   │   │   ├── matches.py       # List matches; PUT /result
│   │   │   ├── predictions.py   # Submit, update, list predictions
│   │   │   ├── standings.py     # GET /standings (group tables) + /standings/bracket
│   │   │   ├── users.py         # GET /users/{username}/profile
│   │   │   └── admin.py         # Sync fixtures/results, recompute, seed helpers
│   │   └── services/
│   │       ├── auth.py          # register_user, login_user (JWT creation)
│   │       ├── tournament.py    # create, join, list, leaderboard
│   │       ├── match.py         # create_match, list_matches
│   │       ├── prediction.py    # submit, update, list predictions
│   │       ├── scoring.py       # compute_points, apply_match_result, recompute
│   │       ├── standings.py     # recalculate_standings_from_matches (with H2H tiebreaker)
│   │       ├── football_api.py  # sync_matches, sync_results (football-data.org v4)
│   │       └── scheduler.py     # APScheduler setup (live poll + daily sync)
│   ├── scripts/
│   │   └── simulate_bracket.py  # End-to-end simulation against local DB (see below)
│   ├── alembic/                 # Migration scripts
│   ├── tests/
│   │   ├── test_full_pipeline.py        # Group stage → standings → scoring
│   │   ├── test_bracket_mapping.py      # Knockout bracket slot linking
│   │   ├── test_stage_normalization.py  # API stage name mapping
│   │   └── test_scoring_*.py            # Unit + integration scoring tests
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                          # Landing / redirect
│   │   ├── layout.tsx                        # Root layout, Navbar, providers
│   │   ├── dashboard/page.tsx                # My Leagues (list + join)
│   │   ├── predictions/page.tsx              # All matches — submit/edit predictions
│   │   ├── standings/page.tsx                # Group tables + live knockout bracket
│   │   ├── leagues/page.tsx                  # League browser
│   │   ├── onboarding/page.tsx               # First-time setup (locale etc.)
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── tournaments/
│   │   │   ├── new/page.tsx                  # Create league form
│   │   │   ├── [code]/page.tsx               # League detail + predictions
│   │   │   ├── [code]/leaderboard/page.tsx   # Live leaderboard
│   │   │   ├── [code]/compare/page.tsx       # Compare predictions with others
│   │   │   └── [code]/settings/page.tsx      # League settings (admin)
│   │   ├── calendar/page.tsx                 # Match calendar (month/week view, team filter, stage colours)
│   │   ├── stats/page.tsx                    # Tournament statistics (goals, rankings, score distribution)
│   │   ├── profile/
│   │   │   ├── page.tsx                      # Own profile
│   │   │   └── [username]/page.tsx           # Public profile
│   │   ├── join/[code]/page.tsx              # Direct invite-link join
│   │   ├── admin/page.tsx                    # Admin panel
│   │   └── api/
│   │       ├── auth/{login,logout,register}/ # Next.js auth API routes
│   │       └── proxy/[...path]/route.ts      # Transparent backend proxy (auth forwarding)
│   ├── messages/
│   │   ├── en.json                           # English i18n strings
│   │   └── pt.json                           # Portuguese i18n strings
│   └── …
│
├── docs/
│   ├── architecture.md   ← this file
│   ├── scoring.md
│   ├── deployment.md
│   ├── post-deploy.md
│   └── custom-domain.md
└── README.md
```

---

## Architecture

### Backend layers

```
HTTP Request
    ↓
Router         — parses request, calls service(s), serializes response
    ↓
Service        — all business logic + DB access (receives Session, raises HTTPException)
    ↓
SQLAlchemy ORM
    ↓
PostgreSQL
```

Routers never query the database directly. Services never import from routers (except `standings.py` router, which owns the hardcoded bracket topology data used by the simulation script).

### Authentication

- On login, the server signs a JWT containing `{"sub": "<user_uuid>"}` with an expiry.
- The frontend stores the token in a cookie and sends it as `Authorization: Bearer <token>` via the Next.js proxy route on every API request.
- The `get_current_user` FastAPI dependency decodes the token and returns the User ORM object.

### Background scheduler

APScheduler runs inside the same process as the FastAPI app (started/stopped via FastAPI's `lifespan` context manager). Two jobs run:

| Job | Trigger | What it does |
|---|---|---|
| Live score poll | Every 60 s | Polls football-data.org for in-progress/finished matches, updates scores, scores predictions, recalculates standings |
| Daily fixture sync | Daily at 03:00 UTC | Upserts all World Cup fixtures from the API |

Both jobs catch all exceptions and log them — they never crash the server.

### Scoring engine

`app/services/scoring.py` contains three functions:

- **`compute_points_for_prediction(prediction, scoring_rules, match)`** — pure function, no DB. Takes ORM objects, applies the stage multiplier (`double_points_from_stage`), returns a list of `(reason, points)` tuples. Fully unit-testable.
- **`apply_match_result(db, match_id, home_score, away_score, status)`** — DB operation. Sets match scores, runs the pure function for every prediction on that match across all leagues, writes `PointEvent` rows, updates `points_awarded` and `total_points`. Idempotent: blocked if match is already `finished`.
- **`recompute_tournament_scores(db, tournament_id)`** — full recompute. Deletes all `PointEvent` rows for the league, resets all points to zero, then re-runs scoring for every finished match.

### Group standings

`app/services/standings.py` — `recalculate_standings_from_matches()` is called automatically after every result sync and after every manually applied score. It:

1. Builds a zeroed roster from ALL group-stage fixtures (so teams appear before any game is played).
2. Overlays W/D/L, GF, GA from finished/live matches.
3. Sorts each group using the **full FIFA 2026 tiebreaker chain**: points → goal difference → goals scored → head-to-head points → head-to-head goal difference → head-to-head goals scored.

Head-to-head tiebreakers are computed by finding clusters of teams still tied after the primary sort and building a mini-table from only the matches played between those tied teams.

Standings are stored in `group_standings` and served from there — no API call to football-data.org is needed for standings.

### Knockout bracket

`app/routers/standings.py` owns the hardcoded 2026 World Cup bracket topology (`_BRACKET_TOPOLOGY`, `_ADVANCEMENT`). These are transcribed directly from the [official FIFA draw](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage) and cover all 32 knockout slots (M73–M104).

`GET /standings/bracket` resolves each slot by:
1. Trying to match a real fixture by team names (for slots where teams are already known).
2. Falling back to match-number order within each round (for the Round of 32, whose teams come from group standings).

The frontend `standings/page.tsx` renders this as a five-column bracket tree. The column order (`BRACKET_SLOT_ORDER`) is a pre-order walk of the advancement tree so that the two feeders of each next-round match sit adjacent, enabling automatic connector geometry.

---

## API reference

All endpoints (except `/health`, `/auth/register`, `/auth/login`) require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Log in, returns JWT |
| `GET` | `/auth/me` | Get current user |

### Tournaments
| Method | Path | Description |
|---|---|---|
| `POST` | `/tournaments/` | Create a league |
| `GET` | `/tournaments/` | List leagues you belong to |
| `GET` | `/tournaments/{code}` | League details |
| `POST` | `/tournaments/join` | Join by invite code |
| `GET` | `/tournaments/{code}/leaderboard` | Live leaderboard |
| `GET` | `/tournaments/{code}/compare` | Compare your predictions with another member |
| `PATCH` | `/tournaments/{code}/settings` | Update league settings (creator only) |

### Matches
| Method | Path | Description |
|---|---|---|
| `GET` | `/matches/` | List matches (filter by `stage`, `status`) |
| `GET` | `/matches/{id}` | Single match |

### Predictions
| Method | Path | Description |
|---|---|---|
| `POST` | `/predictions/` | Submit or update a prediction (upsert) |
| `GET` | `/predictions/` | List your predictions |

### Standings
| Method | Path | Description |
|---|---|---|
| `GET` | `/standings` | All group tables (12 groups × 4 teams) |
| `GET` | `/standings/bracket` | Full knockout bracket (M73–M104) with resolved teams |

### Users
| Method | Path | Description |
|---|---|---|
| `GET` | `/users/{username}/profile` | Public user profile |

### Admin
| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/sync/health` | Check API key + rate limit status |
| `POST` | `/admin/sync/matches` | Sync all fixtures from football-data.org |
| `POST` | `/admin/sync/results` | Sync live/finished results + trigger scoring |
| `POST` | `/admin/standings/recalculate` | Recompute all group standings from match results |
| `POST` | `/admin/tournaments/{id}/recompute` | Recompute all scores for a league |
| `DELETE` | `/admin/matches/reset` | Delete ALL matches + related data (local dev only) |
| `POST` | `/admin/seed/live-match` | Set a match to live with a score (dev) |
| `POST` | `/admin/seed/finish-match` | Force-finish a match with a score (dev) |
| `GET` | `/admin/registration-invite` | Return the platform-level invite code |

Interactive docs: `http://localhost:8080/docs`

---

## Database schema

```
users
  id (UUID PK), email, username, hashed_password, avatar_url,
  locale, is_admin, created_at

tournaments
  id (UUID PK), name, code (unique slug), created_by → users,
  invite_code (unique), is_active, created_at

tournament_scoring_rules
  id (UUID PK), tournament_id → tournaments (unique FK),
  correct_result_pts, correct_winner_pts,
  correct_goal_diff_pts, correct_goals_one_team_pts,
  double_points_from_stage,    ← e.g. "quarter_finals"
  created_at

tournament_members
  id (UUID PK), tournament_id → tournaments, user_id → users,
  total_points, provisional_points,   ← provisional = live-match estimate
  joined_at
  UNIQUE(tournament_id, user_id)

matches
  id (UUID PK), external_match_id (unique), home_team, away_team,
  kickoff_at (indexed), stage, group,
  status (scheduled | live | finished | suspended),
  home_score, away_score, minute,   ← minute only set during live matches
  created_at

predictions
  id (UUID PK), user_id → users, match_id → matches,
  predicted_home, predicted_away,
  is_locked, points_awarded, submitted_at
  UNIQUE(user_id, match_id)

point_events
  id (UUID PK), prediction_id → predictions, user_id → users,
  tournament_id → tournaments, match_id → matches,
  reason (correct_result | correct_winner | correct_goal_diff | correct_goals_one_team),
  points, created_at
  INDEX(user_id, tournament_id)   ← leaderboard query path

group_standings
  id (UUID PK), group (e.g. "GROUP_A"), position, team_name,
  played, won, drawn, lost,
  goals_for, goals_against, goal_difference, points,
  synced_at
  UNIQUE(group, team_name)
```

All primary keys are UUIDs. Foreign keys use `CASCADE` for rows that can't exist without their parent, and `RESTRICT` for references that should block deletion.

---

## Getting started

### Prerequisites

- Docker & Docker Compose (recommended)
- **Or:** Python 3.12+, Node.js 20+, and a running PostgreSQL instance

### Quick start with Docker

```bash
# 1. Clone the repo
git clone <repo-url>
cd world_cup_predictor_app

# 2. Set your environment variables
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set FOOTBALL_API_KEY

# 3. Start everything
docker compose up --build

# 4. Run database migrations (first run only)
docker compose exec api alembic upgrade head

# 5. Open the app
# Frontend: http://localhost:3000
# API docs:  http://localhost:8080/docs
```

---

## Running with Docker

```bash
# Start (builds images on first run)
docker compose up --build

# Run migrations
docker compose exec api alembic upgrade head

# Seed World Cup fixtures (requires FOOTBALL_API_KEY)
curl -X POST http://localhost:8080/admin/sync/matches \
  -H "Authorization: Bearer <your-token>"

# Stop
docker compose down

# Wipe the database (fresh start)
docker compose down -v
```

---

## Running locally (dev)

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and FOOTBALL_API_KEY

# Run migrations
alembic upgrade head

# Start the dev server (auto-reloads on save)
uvicorn app.main:app --reload --port 8080
```

### Frontend

```bash
cd frontend

npm install
cp .env.local.example .env.local
npm run dev
# → http://localhost:3000
```

### Running tests

```bash
cd backend
source .venv/bin/activate

# All tests
.venv/bin/pytest tests/ -v

# Just the pipeline + bracket tests (require local DB)
.venv/bin/pytest tests/test_full_pipeline.py tests/test_bracket_mapping.py -v
```

---

## Simulation script

`backend/scripts/simulate_bracket.py` runs a full end-to-end tournament simulation against the **local** Postgres database (refuses to run against non-localhost URLs). Useful for verifying that standings, scoring, and the bracket all wire up correctly after code changes.

What it does:

1. **Wipes** predictions, point events, group standings, knockout matches; resets group fixtures to `scheduled`; zeroes member points. Real group fixtures (teams, kickoff times) and users/leagues are kept.
2. **Generates random predictions** for every member across every match in every league.
3. **Plays all 72 group games** with random scores, computing standings + scoring.
4. **Determines 32 qualifiers** (12 group winners + 12 runners-up + 8 best thirds), validates the Kuhn-matching assignment of third-place teams to their bracket slots.
5. **Publishes Round of 32 fixtures** exactly as the live API would, then verifies all 16 slots link correctly in the bracket endpoint.
6. **Plays R32 → R16 → QF** round by round, verifying each round's bracket links before scoring.
7. **Finishes one SF, leaves the other LIVE** — confirms provisional points and the live bracket state.
8. Prints leaderboards for all leagues.

```bash
cd backend
.venv/bin/python scripts/simulate_bracket.py
```

---

## Notes

- **Fixture data** comes from [football-data.org](https://www.football-data.org/) v4 (free tier: 10 req/min, covers WC fixtures and results). Set `FOOTBALL_API_KEY` in `.env`.
- **Standings** are computed locally from match results — no separate API call needed. The algorithm implements the full FIFA 2026 tiebreaker chain including head-to-head.
- **Bracket topology** is hardcoded from the [official FIFA 2026 draw](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage) and does not rely on consecutive match numbers (the tree is interleaved).
- **Leaderboard ranking** assigns the same rank to tied players (dense rank: two players on 15 pts both get rank 1, next player gets rank 3).
- **Predictions lock automatically** the moment a match goes `live` — the background scheduler handles this without any user action.
- **Provisional points** are computed from live match scores and shown on the leaderboard in real time, then replaced by final points when the match finishes.
