# Post-Deploy Runbook — Go Live & Admin Setup

Everything here assumes Phase 1–8 of `DEPLOYMENT.md` is complete and both Cloud Run services are running.

---

## Part 1 — Restrict registration with an invite code

The registration page requires an invite code before anyone can create an account. Only people you give the code to can sign up — the site URL can be shared freely.

If `INVITE_CODE` is not set, registration is open (safe for local dev). In production you must set it.

### 1.1 Set the invite code on Cloud Run

```bash
gcloud run services update backend \
  --region=$REGION \
  --update-env-vars="INVITE_CODE=your-secret-code-here"
```

Pick something short and memorable to share with your group (e.g. `worldcup2026`). This triggers a new revision — the backend redeploys in ~30 seconds.

### 1.2 Share the code with your players

Send them the frontend URL and the invite code. They'll see an **Invite Code** field at the top of the registration form. Wrong code → `403 Invalid invite code`.

### 1.3 Rotate the code (optional)

If you want to cut off new signups (e.g. tournament has started), change the code to something only you know or set it to a random string:

```bash
gcloud run services update backend \
  --region=$REGION \
  --update-env-vars="INVITE_CODE=$(openssl rand -hex 8)"
```

Existing accounts are unaffected — only new registrations need the code.

---

## Part 2 — Share the website

Your frontend Cloud Run URL already works publicly (Cloud Run was created with "Allow unauthenticated invocations"). The invite code gates who can register, not who can load the page.

### 2.1 Get your public URL

```bash
gcloud run services describe frontend \
  --region=$REGION \
  --format='value(status.url)'
```

It looks like: `https://frontend-xxxxxxxxxx-uc.a.run.app`

Send this URL + the invite code to your group.

### 2.2 Optional — use a custom domain

If you want a friendlier URL (e.g. `worldcup.yourdomain.com`):

1. Go to [Cloud Run](https://console.cloud.google.com/run) → **frontend** → **Manage Custom Domains**
2. Click **Add Mapping** and follow the steps to verify your domain and add the DNS record your registrar requires
3. Google provisions a free TLS certificate automatically — no extra setup needed

> Skip this if you're fine with the `.run.app` URL.

---

## Part 3 — Make your user an admin

The script handles two cases: it creates the user if they don't exist, or promotes an existing account to admin without touching the password.

### 3.1 If you already registered via the website (promote existing account)

```bash
export REGION="us-central1"        # your region
export PROJECT_ID="your-project-id"
export DB_HOST="34.123.45.67"      # VM external IP from Phase 2.5
export DB_PASSWORD="YOUR_DB_PASSWORD"
export YOUR_EMAIL="your@email.com"

gcloud run jobs create make-admin \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/worldcup-images/backend:latest \
  --region=$REGION \
  --service-account=backend-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="DATABASE_URL=postgresql+psycopg2://worldcup:$DB_PASSWORD@$DB_HOST:5432/worldcup,JWT_SECRET=placeholder" \
  --command=python \
  --args="scripts/create_admin.py,$YOUR_EMAIL,unused,$DB_PASSWORD"

gcloud run jobs execute make-admin --region=$REGION --wait
```

The script detects your account already exists and promotes it. Username and password args are ignored for existing users.

### 3.2 If you haven't registered yet (create admin account directly)

```bash
gcloud run jobs create make-admin \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/worldcup-images/backend:latest \
  --region=$REGION \
  --service-account=backend-sa@$PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="DATABASE_URL=postgresql+psycopg2://worldcup:$DB_PASSWORD@$DB_HOST:5432/worldcup,JWT_SECRET=placeholder" \
  --command=python \
  --args="scripts/create_admin.py,YOUR_EMAIL,YOUR_USERNAME,YOUR_PASSWORD"

gcloud run jobs execute make-admin --region=$REGION --wait
```

### 3.3 Verify it worked

```bash
gcloud compute ssh worldcup-db-vm --zone=$ZONE
docker exec -it postgres psql -U worldcup -d worldcup \
  -c "SELECT email, username, is_admin FROM users WHERE email='YOUR_EMAIL';"
```

You should see `is_admin | t` in the output.

### 3.4 Re-running the job later

If you need to promote another user in the future, update the job's args and re-execute:

```bash
gcloud run jobs update make-admin \
  --region=$REGION \
  --args="scripts/create_admin.py,OTHER_EMAIL,unused,unused"

gcloud run jobs execute make-admin --region=$REGION --wait
```

---

## Quick checklist

- [ ] `INVITE_CODE` env var set on the backend Cloud Run service
- [ ] Frontend URL loads and shows the login page with an **Invite Code** field
- [ ] Registration fails with a wrong code, succeeds with the correct one
- [ ] Admin job completed with `Created admin user` or `Promoted existing user to admin`
- [ ] Admin account can log in and sees the admin panel
