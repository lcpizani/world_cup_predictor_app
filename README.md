# ⚽ World Cup Predictor

A full-stack prediction league app for the FIFA World Cup. Friends create private leagues, submit score predictions for every match, and earn points based on how accurate they are — with a live leaderboard that updates as results come in.

---

## Table of Contents

- [What it is](#what-it-is)
- [How it works](#how-it-works)
- [Scoring system](#scoring-system)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Database schema](#database-schema)
- [Getting started](#getting-started)
- [Running with Docker](#running-with-docker)
- [Running locally (dev)](#running-locally-dev)

---

## What it is

World Cup Predictor is a private prediction league platform. The core loop is:

1. A user **creates a league** and shares an invite code with friends.
2. Friends **join the league** using that code.
3. Everyone **submits score predictions** for each World Cup match before kickoff.
4. When a match finishes, the app **automatically fetches the result** from a live football data API and **scores all predictions**.
5. The **leaderboard** updates in real time to show who's winning the league.

Each league creator sets their own **scoring rules** — you can weight exact scores more heavily, or reward any correct winner equally. This makes every league feel different.

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
Browse upcoming matches
        ↓
Submit score predictions (before kickoff)
        ↓
Watch the leaderboard as results come in
```

### What happens when a match finishes

1. The background scheduler (running inside the API server) polls **football-data.org** periodically for finished results.
2. When a match goes `live`, all predictions for that match are **locked** — no more edits.
3. When the match reaches `finished`, the **scoring engine** runs:
   - It loads every prediction for that match across all leagues.
   - For each prediction, it computes which scoring categories were hit.
   - It writes a `PointEvent` row per earned category (the audit log).
   - It updates `points_awarded` on the prediction and `total_points` on the league member.
4. The leaderboard immediately reflects the new totals.

If a result is entered incorrectly (e.g. via the admin panel), an admin can trigger a **full recompute** for any league — it wipes all point events and re-runs scoring from scratch against the corrected scores.

---

## Scoring system

Each league has its own scoring rules, configured at creation. There are four categories:

| Category | When it fires | Typical points |
|---|---|---|
| **Exact score** (`correct_result`) | Predicted score matches exactly (e.g. predict 2-1, actual 2-1) | 5 |
| **Correct winner** (`correct_winner`) | Predicted the right outcome (home win / draw / away win) | 3 |
| **Correct goal difference** (`correct_goal_diff`) | Predicted the right margin (e.g. predict 3-1, actual 2-0 — both +2) | 2 |
| **Correct goals one team** (`correct_goals_one_team`) | Predicted the right score for at least one team | 1 |

**Rules:**
- If you hit the **exact score**, only `correct_result` fires — the other categories don't stack on top.
- If you don't hit the exact score, the other three categories stack freely.
- Any category with 0 points assigned by the league creator is silently skipped.
- Points awarded to each prediction are stored individually so the audit log is always accurate.

---

## Tech stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (Python 3.11+) |
| ORM | SQLAlchemy 2.x (sync) |
| Database | PostgreSQL 16 |
| Migrations | Alembic |
| Config | pydantic-settings (`.env`) |
| Auth | JWT via `python-jose`, passwords via `passlib` (bcrypt) |
| Football API client | `httpx` → football-data.org v4 |
| Background scheduler | APScheduler (`BackgroundScheduler`) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Data fetching | TanStack React Query v5 |
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
│   │   ├── dependencies.py      # get_current_user() JWT dependency
│   │   ├── models/
│   │   │   ├── user.py          # User
│   │   │   ├── tournament.py    # Tournament, TournamentScoringRules, TournamentMember
│   │   │   ├── match.py         # Match (World Cup fixtures)
│   │   │   ├── prediction.py    # Prediction (one per user per match per league)
│   │   │   └── point_event.py   # PointEvent (scoring audit log)
│   │   ├── schemas/
│   │   │   ├── auth.py          # TokenResponse
│   │   │   ├── user.py          # UserCreate, UserResponse
│   │   │   ├── tournament.py    # TournamentCreate/Response, ScoringRules, Member
│   │   │   ├── match.py         # MatchCreate/Response, MatchScoreUpdate
│   │   │   ├── prediction.py    # PredictionCreate/Response, PointEventResponse
│   │   │   └── leaderboard.py   # LeaderboardEntry, LeaderboardResponse
│   │   ├── routers/
│   │   │   ├── auth.py          # POST /auth/register, /login; GET /me
│   │   │   ├── tournaments.py   # CRUD + join + leaderboard
│   │   │   ├── matches.py       # List + seed matches; PUT /result
│   │   │   ├── predictions.py   # Submit, update, list predictions
│   │   │   └── admin.py         # Sync fixtures/results, recompute scores
│   │   ├── services/
│   │   │   ├── auth.py          # register_user, login_user (JWT creation)
│   │   │   ├── tournament.py    # create, join, list, leaderboard
│   │   │   ├── match.py         # create_match, list_matches, update_match_score
│   │   │   ├── prediction.py    # submit, update, list predictions
│   │   │   ├── scoring.py       # compute_points, apply_match_result, recompute
│   │   │   ├── football_api.py  # sync_matches, sync_results (football-data.org)
│   │   │   └── scheduler.py     # APScheduler setup (live poll + daily sync)
│   │   └── clients/
│   │       └── football_api.py  # Low-level httpx client
│   ├── alembic/                 # Migration scripts
│   ├── tests/
│   │   ├── test_scoring_unit.py         # Pure unit tests (no DB)
│   │   ├── test_scoring_integration.py  # Full DB-backed scoring tests
│   │   └── test_scoring_edge_cases.py   # Boundary and adversarial scenarios
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                          # Landing / redirect to dashboard
│   │   ├── layout.tsx                        # Root layout, Navbar, React Query provider
│   │   ├── dashboard/page.tsx                # My Leagues (list + join)
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── tournaments/
│   │   │   ├── new/page.tsx                  # Create league form
│   │   │   ├── [id]/page.tsx                 # League detail + predictions
│   │   │   └── [id]/leaderboard/page.tsx     # Live leaderboard
│   │   ├── admin/page.tsx                    # Admin panel (sync, reset, apply results)
│   │   └── api/auth/                         # Next.js API routes (login, register, logout)
│   ├── components/
│   │   └── Navbar.tsx
│   ├── lib/
│   │   ├── api.ts                            # Typed API client (all backend calls)
│   │   ├── flags.ts                          # Country flag emoji helpers
│   │   └── providers.tsx                     # TanStack Query + auth providers
│   └── types/
│       └── api.ts                            # Shared TypeScript types
│
├── docker-compose.yml
└── README.md
```

---

## Architecture

### Backend layers

The backend follows a strict two-layer separation:

```
HTTP Request
    ↓
Router         — parses request, calls ONE service function, serializes response
    ↓
Service        — all business logic + database access (receives Session, returns ORM object or raises HTTPException)
    ↓
SQLAlchemy ORM
    ↓
PostgreSQL
```

Routers never query the database directly. Services never import from routers.

### Authentication

- On login, the server signs a JWT containing `{"sub": "<user_uuid>"}` and an expiry.
- The frontend stores the token in a cookie and sends it as `Authorization: Bearer <token>` on every API request.
- The `get_current_user` FastAPI dependency decodes the token and returns the User ORM object — all protected routes depend on it.

### Background scheduler

APScheduler runs inside the same process as the FastAPI app (started/stopped via FastAPI's `lifespan` context manager). Two jobs run:

| Job | Trigger | What it does |
|---|---|---|
| Live score poll | Every 60 seconds | Calls football-data.org for finished matches, scores predictions |
| Daily fixture sync | Daily at 03:00 UTC | Upserts all World Cup fixtures from the API |

The scheduler jobs never crash the server — all errors are caught and logged.

### Scoring engine

`app/services/scoring.py` contains three functions:

- **`compute_points_for_prediction(prediction, scoring_rules, match)`** — pure function, no DB. Takes ORM objects, returns a list of `(reason, points)` tuples. Raises `ValueError` if match scores are `None`. Fully unit-testable without a database.
- **`apply_match_result(db, match_id, home_score, away_score, status)`** — DB operation. Sets match scores, calls `compute_points_for_prediction` for every prediction on that match across all leagues, writes `PointEvent` rows, updates `points_awarded` and `total_points`. Idempotent: blocked if match is already `finished`.
- **`recompute_tournament_scores(db, tournament_id)`** — full recompute. Deletes all `PointEvent` rows for the league, resets all points to zero, then re-runs scoring for every finished match. Used for result corrections.

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
| `GET` | `/tournaments/{id}` | League details |
| `POST` | `/tournaments/join` | Join by invite code |
| `GET` | `/tournaments/{id}/leaderboard` | Live leaderboard |

### Matches
| Method | Path | Description |
|---|---|---|
| `POST` | `/matches/` | Seed a match (dev/admin) |
| `GET` | `/matches/` | List matches (filter by `stage`, `match_status`) |
| `GET` | `/matches/{id}` | Single match |
| `PUT` | `/matches/{id}/result` | Apply final score (admin) |

### Predictions
| Method | Path | Description |
|---|---|---|
| `POST` | `/predictions/` | Submit a prediction |
| `PUT` | `/predictions/{id}` | Update a prediction (before kickoff) |
| `GET` | `/predictions/` | List your predictions (`?tournament_id=`) |

### Admin
| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/sync/matches` | Sync fixtures from football API |
| `POST` | `/admin/sync/results` | Sync finished results + trigger scoring |
| `PATCH` | `/admin/matches/{id}/score` | Manually override a match score |
| `POST` | `/admin/tournaments/{id}/recompute` | Recompute all scores for a league |
| `DELETE` | `/admin/matches/reset` | Reset all match scores (dev) |

Interactive docs available at `http://localhost:8080/docs`.

---

## Database schema

```
users
  id (UUID PK), email, username, hashed_password, avatar_url, is_admin, created_at

tournaments
  id (UUID PK), name, created_by → users, invite_code (unique), is_active, created_at

tournament_scoring_rules
  id (UUID PK), tournament_id → tournaments (unique),
  correct_result_pts, correct_winner_pts, correct_goal_diff_pts, correct_goals_one_team_pts,
  created_at

tournament_members
  id (UUID PK), tournament_id → tournaments, user_id → users,
  total_points, joined_at
  UNIQUE(tournament_id, user_id)

matches
  id (UUID PK), external_match_id (unique), home_team, away_team,
  kickoff_at (indexed), stage, group, status (indexed),
  home_score, away_score, created_at

predictions
  id (UUID PK), user_id → users, match_id → matches, tournament_id → tournaments,
  predicted_home, predicted_away, is_locked, points_awarded, submitted_at
  UNIQUE(user_id, match_id, tournament_id)

point_events
  id (UUID PK), prediction_id → predictions, user_id → users,
  tournament_id → tournaments, match_id → matches,
  reason (correct_result | correct_winner | correct_goal_diff | correct_goals_one_team),
  points, created_at
  INDEX(user_id, tournament_id)  ← leaderboard query path
```

All primary keys are UUIDs. Foreign keys use `CASCADE` for child rows that can't exist without their parent (e.g. scoring rules without a tournament), and `RESTRICT` for references that should block deletion.

---

## Getting started

### Prerequisites

- Docker & Docker Compose (recommended)
- **Or:** Python 3.11+, Node.js 20+, and a running PostgreSQL instance

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
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and other settings

# Run migrations
alembic upgrade head

# Start the dev server (auto-reloads on save)
uvicorn app.main:app --reload --port 8080
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local

# Start the dev server
npm run dev
# → http://localhost:3000
```

### Running tests

```bash
cd backend
source .venv/bin/activate

# Run all tests
pytest tests/ -v

# Run only unit tests (no database required)
pytest tests/test_scoring_unit.py -v

# Run integration tests
pytest tests/test_scoring_integration.py -v
```

---

## Notes

- **Fixture data** comes from [football-data.org](https://www.football-data.org/) (free tier covers World Cup fixtures, 10 req/min limit). Set `FOOTBALL_API_KEY` in your `.env` before calling the sync endpoints.
- **Leaderboard ranking** assigns the same rank to tied players (e.g. two players on 15 pts both get rank 1, and the next player gets rank 3).
- **Predictions lock automatically** the moment a match goes `live` — the background scheduler handles this without any user action needed.
- **The admin panel** (`/admin` in the frontend) lets you manually trigger fixture/result syncs, apply match scores directly, and recompute league scores — useful during development or if the automated sync lags.
