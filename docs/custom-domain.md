# Custom Domain Setup — Cloud Run

How to point `predictorworldcup.com` at the frontend Cloud Run service. Everything here is free — you only pay for the domain name itself.

---

## Step 1 — Verify ownership in Google Search Console

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Click **Add property** → choose **Domain** (not "URL prefix")
3. Type `predictorworldcup.com` → click **Continue**
4. Google shows you a TXT record value like:
   ```
   google-site-verification=abc123xyz...
   ```
   **Leave this tab open** — you'll need to come back to click Verify.

---

## Step 2 — Add the TXT record in Namecheap

1. Go to [namecheap.com](https://namecheap.com) → log in
2. Click **Domain List** in the left sidebar
3. Find `predictorworldcup.com` → click **Manage**
4. Click the **Advanced DNS** tab at the top
5. Click **Add New Record**
6. Fill in:
   - **Type**: `TXT Record`
   - **Host**: `@`
   - **Value**: paste the full `google-site-verification=...` string from Step 1
   - **TTL**: `Automatic`
7. Click the green checkmark to save

---

## Step 3 — Verify in Search Console

1. Go back to the Search Console tab
2. Click **Verify**
3. If it fails, wait 5–10 minutes and try again (DNS takes time to propagate)

---

## Step 4 — Add the domain mapping in Cloud Run

1. Go to [console.cloud.google.com/run/domains](https://console.cloud.google.com/run/domains)
2. Click **Add Mapping**
3. **Service**: select `frontend`
4. **Domain**: select `predictorworldcup.com`
5. **Subdomain**: leave blank (for the root domain) or type `www`
6. Click **Continue** — Google shows you DNS records to add

---

## Step 5 — Add Google's DNS records in Namecheap

Go back to Namecheap → **Advanced DNS** tab. For each record Google gives you, click **Add New Record**:

**If Google gives you a CNAME** (for `www`):

| Type | Host | Value |
|------|------|-------|
| `CNAME Record` | `www` | `ghs.googlehosted.com` |

**If Google gives you A records** (for root `@`):

| Type | Host | Value |
|------|------|-------|
| `A Record` | `@` | `216.239.32.21` |
| `A Record` | `@` | `216.239.34.21` |
| `A Record` | `@` | `216.239.36.21` |
| `A Record` | `@` | `216.239.38.21` |

Add all records Google shows you, then save each one with the green checkmark.

---

## Step 6 — Wait

- DNS propagation: **10–60 minutes**
- TLS certificate: Google provisions it automatically, usually ready within the same hour
- The domain status in Cloud Run will change from **Pending** to **Active**

---

## Step 7 — Update CORS on the backend

Once the domain is active, run this so the backend accepts requests from it:

```bash
gcloud run services update backend \
  --region=us-central1 \
  --update-env-vars="CORS_ORIGINS=https://predictorworldcup.com"
```

> If you ever change the domain, run this command again with the new URL.
