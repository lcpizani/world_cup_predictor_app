# 🚀 Deployment Runbook — GCP

A step-by-step guide to deploying the World Cup Predictor on Google Cloud Platform.

**What you'll end up with:**
- Frontend (Next.js) → Cloud Run, public URL
- Backend (FastAPI) → Cloud Run, public URL
- Database (PostgreSQL 16) → Docker container on a Compute Engine VM
- Auto-deploy on every push to `dev` via Cloud Run continuous deployment
- Environment variables set directly in Cloud Run (no Secret Manager needed)

**Time to complete:** ~60 minutes the first time.

**Cost:** ~$6 for 6 weeks (VM only). Free if the VM falls under your GCP free tier (1 e2-micro per account).

---

## Branch strategy

```
main  ──►  your working branch — test here, never auto-deploys
  │
  └──► dev  ──►  push here when tested → auto-deploys to cloud
```

- **`main`** — day-to-day work, experiments, testing locally. Nothing deploys from here.
- **`dev`** — tested changes only. Every push triggers Cloud Run to rebuild and redeploy.

---

## Prerequisites

Before you start, have these ready:

- [ ] GCP account (you have this)
- [ ] `gcloud` CLI installed — [install guide](https://cloud.google.com/sdk/docs/install)
- [ ] `football-data.org` API key (you have this)
- [ ] Access to your GitHub repo (to connect it to Cloud Run)

---

## Phase 1 — Enable Billing & APIs

### 1.1 Enable billing

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. In the top bar, open the **project selector** and note your **Project ID** (looks like `my-project-123`). You'll use this throughout.
3. Navigate to **Billing** → link a billing account to your project.
   - If you're a new customer, you'll be offered **$300 free credit** — accept it.

### 1.2 Set your shell environment

In your terminal, set these once so all commands below just work:

```bash
export PROJECT_ID="your-project-id"   # e.g. worldcup-predictor-123
export REGION="us-central1"           # or us-east1, europe-west1, etc.
export ZONE="us-central1-a"           # must be a zone within your chosen region

# Authenticate and set default project
gcloud auth login
gcloud config set project $PROJECT_ID
```

### 1.3 Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com
```

This takes about a minute. You'll see "Operation finished successfully."

> Note: Secret Manager and Cloud SQL are **not** needed.

---

## Phase 2 — Infrastructure

### 2.1 Create Artifact Registry repository

This is where your Docker images are stored.

```bash
gcloud artifacts repositories create worldcup-images \
  --repository-format=docker \
  --location=$REGION \
  --description="World Cup Predictor images"
```

### 2.2 Create the database VM

This VM will run PostgreSQL inside a Docker container. An `e2-micro` is free-tier eligible (one per GCP account) and more than enough for 20 users.

```bash
gcloud compute instances create worldcup-db-vm \
  --machine-type=e2-micro \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --zone=$ZONE \
  --tags=postgres-server \
  --boot-disk-size=20GB
```

> ⏳ This takes about 30 seconds to provision.

### 2.3 Install Docker and start PostgreSQL

SSH into the VM and run the following commands:

```bash
gcloud compute ssh worldcup-db-vm --zone=$ZONE
```

Once inside the VM:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker   # reload group without logging out

# Start PostgreSQL 16 (replace YOUR_DB_PASSWORD with a strong password)
docker run -d \
  --name postgres \
  --restart always \
  -e POSTGRES_USER=worldcup \
  -e POSTGRES_PASSWORD=YOUR_DB_PASSWORD \
  -e POSTGRES_DB=worldcup \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16

# Exit the VM
exit
```

> ⚠️ Save `YOUR_DB_PASSWORD` securely — you'll need it in Phase 6.

### 2.4 Open port 5432 in the firewall

Allow inbound connections to PostgreSQL:

```bash
gcloud compute firewall-rules create allow-postgres \
  --allow=tcp:5432 \
  --target-tags=postgres-server \
  --source-ranges=0.0.0.0/0 \
  --description="Allow PostgreSQL access to the DB VM"
```

> 🔒 The only protection here is your database password — make sure it's strong (16+ random characters).

### 2.5 Get the VM's external IP

```bash
gcloud compute instances describe worldcup-db-vm \
  --zone=$ZONE \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)'
```

It will look like: `34.123.45.67`

**Save this value** — it's your `DB_HOST`.

---

## Phase 3 — Service Accounts

### 3.1 Create the backend runtime service account

```bash
gcloud iam service-accounts create backend-sa \
  --display-name="World Cup Backend Runtime"
```

No extra roles needed — the backend connects to PostgreSQL over TCP using a password.

### 3.2 Grant Cloud Build the roles it needs

Cloud Run's continuous deployment uses Cloud Build internally. Grant the Compute Engine default service account (which Cloud Build uses in newer GCP projects) the permissions it needs:

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

for role in \
  roles/artifactregistry.writer \
  roles/run.admin \
  roles/iam.serviceAccountUser \
  roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="$role"
done
```

---

## Phase 4 — Connect GitHub to Cloud Run

Cloud Run's continuous deployment watches your `dev` branch and rebuilds + redeploys automatically on every push. No workflow files needed — it uses the Dockerfiles directly.

### 4.1 Create the backend service

1. Go to [console.cloud.google.com/run](https://console.cloud.google.com/run) → **Create Service**
2. Select **"Continuously deploy from a repository"** → **Set up with Cloud Build**
3. Connect your GitHub account and select your repo
4. Set **Branch** to `^dev$`
5. **Build type** → `Dockerfile`
6. **Source location** → `/backend`
7. **Dockerfile location** → `/backend/Dockerfile`
8. Click **Next** and configure the service:
   - **Service name** → `backend`
   - **Region** → your region
   - **Authentication** → Allow unauthenticated invocations
   - **Service account** → `backend-sa`
   - **Port** → `8080`
9. Click **Create**

> The first deploy will start but the backend won't be functional yet — it needs env vars (Phase 6) to connect to the database.

### 4.2 Create the frontend service

Repeat the same steps with:
- **Source location** → `/frontend`
- **Dockerfile location** → `/frontend/Dockerfile`
- **Service name** → `frontend`
- **Port** → `3000`
- **Build argument** → add `NEXT_PUBLIC_API_URL` = `http://placeholder` (update after Phase 6)
- No specific service account needed

---

## Phase 5 — Get your Cloud Run URLs

Once the initial builds finish, grab both URLs:

```bash
# Backend URL
gcloud run services describe backend \
  --region=$REGION \
  --format='value(status.url)'

# Frontend URL
gcloud run services describe frontend \
  --region=$REGION \
  --format='value(status.url)'
```

Save both — you'll need them in Phase 6.

---

## Phase 6 — Set Environment Variables in Cloud Run

This is where you configure everything the app needs to run. Set these **directly in Cloud Run**.

### 6.1 Backend env vars

```bash
BACKEND_URL="https://your-backend-url.run.app"    # from Phase 5
FRONTEND_URL="https://your-frontend-url.run.app"  # from Phase 5
DB_HOST="34.123.45.67"                            # VM external IP from Phase 2.5

gcloud run services update backend \
  --region=$REGION \
  --set-env-vars="DATABASE_URL=postgresql+psycopg2://worldcup:YOUR_DB_PASSWORD@$DB_HOST:5432/worldcup"

gcloud run services update backend \
  --region=$REGION \
  --set-env-vars="JWT_SECRET=$(openssl rand -hex 32)"

gcloud run services update backend \
  --region=$REGION \
  --set-env-vars="FOOTBALL_API_KEY=YOUR_FOOTBALL_API_KEY"

gcloud run services update backend \
  --region=$REGION \
  --set-env-vars="CORS_ORIGINS=$FRONTEND_URL"

gcloud run services update backend \
  --region=$REGION \
  --set-env-vars="ENVIRONMENT=production,ALLOW_ADMIN_MATCH_UPDATES=false"
```

> 💡 Each flag is run separately to avoid shell quoting issues with the DATABASE_URL.

**Example DATABASE_URL:**
`postgresql+psycopg2://worldcup:s3cr3t@34.123.45.67:5432/worldcup`

### 6.2 Frontend env vars

```bash
gcloud run services update frontend \
  --region=$REGION \
  --set-env-vars="NODE_ENV=production,BACKEND_URL=$BACKEND_URL"
```

### 6.3 Update `NEXT_PUBLIC_API_URL` and redeploy frontend

Next.js bakes `NEXT_PUBLIC_*` variables into the bundle at build time, so you need to update the build argument in Cloud Run and trigger a redeploy:

1. Go to [Cloud Run](https://console.cloud.google.com/run) → **frontend** service → **Edit & Deploy New Revision**
2. Go to the **Variables & Secrets** tab → find the `NEXT_PUBLIC_API_URL` build arg
3. Update it to your real backend URL
4. Click **Deploy**

> After this, every push to `dev` will use the correct backend URL automatically.

---

## Phase 7 — Migrations

Migrations run automatically on every backend deploy — the container starts by running `alembic upgrade head` before the server comes up (via `entrypoint.sh`).

To verify the first migration ran successfully, check the backend logs:

```bash
gcloud run services logs tail backend --region=$REGION
```

You should see `Running database migrations...` followed by `Starting server...`.

---

## Phase 8 — Post-Deploy: Admin & Data Setup

### 8.1 Create your admin user

```bash
gcloud run jobs create create-admin \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/worldcup-images/backend:latest \
  --region=$REGION \
  --service-account=backend-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="DATABASE_URL=postgresql+psycopg2://worldcup:YOUR_DB_PASSWORD@$DB_HOST:5432/worldcup" \
  --command=python \
  --args="scripts/create_admin.py,YOUR_EMAIL,YOUR_USERNAME,YOUR_PASSWORD"

gcloud run jobs execute create-admin --region=$REGION --wait
```

### 8.2 Load World Cup fixtures

```bash
# Log in and get your auth token
TOKEN=$(curl -s -X POST https://YOUR_BACKEND_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Sync all WC matches from football-data.org
curl -X POST "https://YOUR_BACKEND_URL/admin/sync/matches?competition_code=WC" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Phase 9 — Smoke Test

- [ ] Frontend loads at Cloud Run URL
- [ ] Can register a new user account
- [ ] Can log in
- [ ] Matches are visible (after sync)
- [ ] Can create a tournament and get an invite code
- [ ] Can submit a prediction on a match
- [ ] Admin login works

---

## Appendix

### Cost breakdown

| Service | Details | ~Cost/6 weeks |
|---|---|---|
| Cloud Run (backend) | Scales to zero, free tier covers 20 users easily | $0 |
| Cloud Run (frontend) | Same | $0 |
| Compute Engine VM | e2-micro, 20GB disk — free tier if not already used | $0–$6 |
| Artifact Registry | < 0.5GB images | $0 |
| **Total** | | **$0–$6** |

With $300 GCP free credit or the free-tier e2-micro: **$0**.

### Managing the database VM

```bash
# SSH into the VM
gcloud compute ssh worldcup-db-vm --zone=$ZONE

# Check postgres container is running
docker ps

# View postgres logs
docker logs postgres

# Stop / start / restart the container
docker stop postgres
docker start postgres
docker restart postgres

# Connect to the database directly (from inside the VM)
docker exec -it postgres psql -U worldcup -d worldcup
```

### Updating env vars after deploy

Since env vars live in Cloud Run, you can update them anytime without touching the code:

```bash
# Update a single env var
gcloud run services update backend \
  --region=$REGION \
  --update-env-vars="FOOTBALL_API_KEY=new-key-here"

# Update CORS if frontend URL ever changes
gcloud run services update backend \
  --region=$REGION \
  --update-env-vars="CORS_ORIGINS=https://new-frontend-url.run.app"
```

> Use `--update-env-vars` (not `--set-env-vars`) when updating manually — it merges rather than replacing everything.

### Useful commands

```bash
# View live backend logs
gcloud run services logs tail backend --region=$REGION

# View live frontend logs
gcloud run services logs tail frontend --region=$REGION

# List all Cloud Run services
gcloud run services list --region=$REGION

# Check VM status
gcloud compute instances describe worldcup-db-vm --zone=$ZONE
```

### Environment variables reference

| Variable | Where set | Purpose |
|---|---|---|
| `DATABASE_URL` | Cloud Run (manual) | PostgreSQL connection string |
| `JWT_SECRET` | Cloud Run (manual) | Signs auth tokens |
| `FOOTBALL_API_KEY` | Cloud Run (manual) | football-data.org API access |
| `CORS_ORIGINS` | Cloud Run (manual) | Allowed frontend origins |
| `ENVIRONMENT` | Cloud Run (manual) | Set to `production` |
| `ALLOW_ADMIN_MATCH_UPDATES` | Cloud Run (manual) | `false` in production |
| `NEXT_PUBLIC_API_URL` | Cloud Run build arg | Backend URL baked into frontend bundle |
| `BACKEND_URL` | Cloud Run (manual) | Internal backend reference for frontend |
| `NODE_ENV` | Cloud Run (manual) | Set to `production` |

### Deleting everything after the World Cup

```bash
# Delete Cloud Run services
gcloud run services delete backend --region=$REGION --quiet
gcloud run services delete frontend --region=$REGION --quiet

# Delete the database VM (this deletes all data)
gcloud compute instances delete worldcup-db-vm --zone=$ZONE --quiet

# Delete the firewall rule
gcloud compute firewall-rules delete allow-postgres --quiet

# Delete Artifact Registry repo
gcloud artifacts repositories delete worldcup-images \
  --location=$REGION --quiet
```
