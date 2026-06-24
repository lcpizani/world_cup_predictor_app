# Frontend — World Cup Predictor

Next.js 15 (App Router) frontend for the World Cup Predictor app.

---

## Environment variables

Create a `.env.local` file in this directory (copy from `.env.local.example` if it exists):

```bash
cp .env.local.example .env.local
```

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL baked into the client bundle at build time — used for all client-side API calls (e.g. `https://your-backend.run.app`) |
| `BACKEND_URL` | Yes (production) | Backend URL used by Next.js server-side API routes to proxy auth requests (login, register, logout). Without this, auth fails server-side. |

For local development both can point to the Docker backend:
```
NEXT_PUBLIC_API_URL=http://localhost:8080
BACKEND_URL=http://localhost:8080
```

---

## Running locally

```bash
# Install dependencies
npm install

# Start the dev server (auto-reloads on save)
npm run dev
# → http://localhost:3000
```

Requires the backend to be running. Start everything together with:
```bash
docker compose up --build
```
from the repo root, then run `npm run dev` in this directory for hot-reload on frontend changes.

---

## Folder structure

```
frontend/
├── app/
│   ├── layout.tsx                    # Root layout — Navbar, React Query provider
│   ├── page.tsx                      # Root redirect to /dashboard
│   ├── dashboard/page.tsx            # My leagues overview
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── tournaments/
│   │   ├── new/page.tsx              # Create league form
│   │   ├── [id]/page.tsx             # League detail + predictions
│   │   └── [id]/leaderboard/page.tsx # Live leaderboard
│   ├── predictions/page.tsx          # My picks (all matches, all leagues)
│   ├── standings/page.tsx            # Group standings + bracket
│   ├── calendar/page.tsx             # Match calendar (month/week view, team filter)
│   ├── stats/page.tsx                # Tournament statistics
│   ├── admin/page.tsx                # Admin panel (sync, results, recompute)
│   └── api/auth/                     # Next.js server-side API routes
│       ├── login/route.ts            # Proxies login to backend, sets cookie
│       ├── register/route.ts         # Proxies registration to backend
│       └── logout/route.ts           # Clears auth cookie
├── components/                       # Shared UI components
├── lib/
│   ├── api.ts                        # Typed API client for all backend calls
│   ├── flags.ts                      # Country flag emoji helpers
│   └── providers.tsx                 # TanStack Query + auth context providers
└── types/
    └── api.ts                        # Shared TypeScript types matching backend schemas
```

---

## How it connects to the backend

**Client-side calls** use `NEXT_PUBLIC_API_URL` — this variable is baked into the JavaScript bundle at build time. All data fetching (matches, predictions, leaderboard) goes through `lib/api.ts` which sends requests directly from the browser to the backend.

**Auth (server-side proxy)** uses `BACKEND_URL` — the Next.js API routes at `app/api/auth/` run on the server and forward login/register requests to the backend. This allows setting HttpOnly cookies securely. `BACKEND_URL` is never exposed to the browser.

The auth token is stored in a cookie and sent as `Authorization: Bearer <token>` on every backend request.
