# Deploying Orin

| Piece | Where | Why |
| --- | --- | --- |
| `apps/ui` (Next.js) | Vercel | Static + serverless route handlers that proxy to the API |
| `apps/orin-backend` (Express) | GCP Cloud Run `orin-api` | Long AI requests (up to 180 s), needs secrets |
| `apps/ws` (WebSocket) | GCP Cloud Run `orin-ws` | Long-lived connections, in-memory rooms → single instance |
| PostgreSQL | Neon | Serverless Postgres; Prisma uses `@prisma/adapter-neon` |
| Rate limits | Upstash Redis | Not implemented yet — see "Where rate limits go" |

Keep the API, the database and Vercel's functions in one region. This guide
uses Singapore everywhere: Cloud Run `asia-southeast1`, Neon
`aws-ap-southeast-1`, Vercel `sin1` (already set in `vercel.json`).

## How auth crosses origins

The browser talks only to the Vercel origin. Next route handlers under
`apps/ui/src/app/api/**` forward requests to the API with the `orin_token`
cookie turned into a `Bearer` header. The WebSocket server is a different
origin, so the httpOnly cookie is never sent to it; instead the client calls
`POST /api/orin/ws-ticket`, receives a 60-second ticket minted by the API
(`POST /auth/ws-ticket`), and opens `wss://…/?ticket=…`. The WS server verifies
the ticket and uses it as the bearer token when it asks the API whether the
user may join the project room. The ticket is a query parameter, so it shows
up in Cloud Run request logs; it is single-purpose and expires after 60 s.
Once you add a custom domain nothing changes.

`JWT_SECRET` must therefore be identical on `orin-api` and `orin-ws`. Vercel
does not need it.

## 0. Prerequisites (once)

```bash
# gcloud: https://cloud.google.com/sdk/docs/install-sdk#rpm (adds the Google repo, then `sudo dnf install google-cloud-cli`)
bun add -g vercel
gcloud auth login
gcloud config set project <GCP_PROJECT_ID>   # billing must be enabled
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

Generate the two secrets and keep them somewhere safe:

```bash
openssl rand -base64 48   # JWT_SECRET  (≥ 32 chars)
openssl rand -base64 32   # SECRETS_ENCRYPTION_KEY (base64 32-byte key)
```

## 1. Neon

1. Create a project in region `aws-ap-southeast-1` (Singapore).
2. Copy both connection strings from the dashboard:
   - **Pooled** (`…-pooler.…neon.tech`) → `DATABASE_URL` for the API.
   - **Direct** (no `-pooler`) → `DIRECT_URL`, used only for migrations.
3. Apply the committed migrations from your machine:

```bash
DIRECT_URL="postgresql://…direct…" \
  bunx prisma migrate deploy --config packages/db/prisma.config.ts
```

Repeat step 3 whenever `packages/db/prisma/migrations` changes, before
deploying the API that depends on it.

## 2. GCP: registry and secrets

```bash
export PROJECT=$(gcloud config get-value project)
export REGION=asia-southeast1
export REPO=$REGION-docker.pkg.dev/$PROJECT/orin

gcloud artifacts repositories create orin --repository-format=docker --location=$REGION
gcloud auth configure-docker $REGION-docker.pkg.dev

printf '%s' "<pooled neon url>"        | gcloud secrets create DATABASE_URL --data-file=-
printf '%s' "<jwt secret>"             | gcloud secrets create JWT_SECRET --data-file=-
printf '%s' "<encryption key>"         | gcloud secrets create SECRETS_ENCRYPTION_KEY --data-file=-
printf '%s' "<smtp username>"           | gcloud secrets create SMTP_USER --data-file=-
printf '%s' "<smtp password>"           | gcloud secrets create SMTP_PASS --data-file=-

# Let Cloud Run's default service account read them
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
```

## 3. Cloud Run: `orin-api`

Build from the repo root (the Dockerfiles need the whole workspace):

```bash
export TAG=$(git rev-parse --short HEAD)
docker build -f apps/orin-backend/Dockerfile -t $REPO/api:$TAG .
docker push $REPO/api:$TAG

gcloud run deploy orin-api \
  --image $REPO/api:$TAG --region $REGION --allow-unauthenticated \
  --port 8080 --memory 512Mi --cpu 1 --timeout 300 --min-instances 0 --max-instances 3 \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,SECRETS_ENCRYPTION_KEY=SECRETS_ENCRYPTION_KEY:latest,SMTP_USER=SMTP_USER:latest,SMTP_PASS=SMTP_PASS:latest \
  --set-env-vars NODE_ENV=production,FRONTEND_URL=https://<vercel-project>.vercel.app,SMTP_HOST=<smtp-host>,SMTP_PORT=587,SMTP_FROM=<verified-sender-email>,SMTP_SECURE=false

export API_URL=$(gcloud run services describe orin-api --region $REGION --format='value(status.url)')
gcloud run services update orin-api --region $REGION --update-env-vars BACKEND_URL=$API_URL
curl -s $API_URL/health
```

Notes:
- The API uses provider keys saved by each user in the Settings page. Do not
  configure your own `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, or other provider
  key on the server. `AI_PROVIDER` can be omitted in production; explicitly
  setting `AI_PROVIDER=local` is blocked outside development.
- `--timeout 300` covers the 180 s chat/generate proxies.
- `FRONTEND_URL` only matters for CORS and OAuth redirects; fix it after step 5
  if the Vercel URL differs.

## 4. Cloud Run: `orin-ws`

Rooms live in process memory, so run exactly one instance and let it hold many
sockets. Scale-to-zero is fine (an idle room is simply forgotten).

```bash
docker build -f apps/ws/Dockerfile -t $REPO/ws:$TAG .
docker push $REPO/ws:$TAG

gcloud run deploy orin-ws \
  --image $REPO/ws:$TAG --region $REGION --allow-unauthenticated \
  --port 8080 --memory 256Mi --cpu 1 \
  --min-instances 0 --max-instances 1 --concurrency 1000 --timeout 3600 --session-affinity \
  --set-secrets JWT_SECRET=JWT_SECRET:latest \
  --set-env-vars NODE_ENV=production,BACKEND_URL=$API_URL

export WS_URL=$(gcloud run services describe orin-ws --region $REGION --format='value(status.url)' | sed 's#^https://#wss://#')
echo $WS_URL
```

Cloud Run closes a WebSocket after `--timeout` (max 3600 s); the client
reconnects with a fresh ticket automatically.

## 5. Vercel: `apps/ui`

Import the repo (Root Directory = repository root; `vercel.json` already sets
the Bun install/build commands and the `sin1` function region), or from the CLI:

```bash
vercel link
vercel env add ORIN_BACKEND_URL production   # $API_URL
vercel env add NEXT_PUBLIC_WS_URL production # $WS_URL   (build-time: redeploy after changing)
vercel --prod
```

Set the same two variables for Preview if you want preview deployments to work.
Nothing else is required on Vercel. If the deployed URL is not what you gave
`FRONTEND_URL` in step 3, update it:

```bash
gcloud run services update orin-api --region $REGION --update-env-vars FRONTEND_URL=https://<real-vercel-url>
```

## 6. Verify

1. `curl $API_URL/health` → `{"status":"ok", …}`.
2. Sign up on the Vercel URL, open a project, open the Peer tab in two browsers
   — the user count should reach 2. DevTools → Network → WS should show a
   `101` upgrade to `$WS_URL/?ticket=…`.
3. `gcloud run services logs read orin-ws --region $REGION --limit 20` for
   "Project access denied" if joins fail (means `BACKEND_URL` or `JWT_SECRET`
   differs between the two services).

## 7. Optional OAuth

Add `GOOGLE_CLIENT_ID/SECRET` and/or `GITHUB_CLIENT_ID/SECRET` to `orin-api`
(`--update-env-vars` or secrets) and register the callbacks with the provider:

```text
$API_URL/auth/google/callback
$API_URL/auth/github/callback
```

## 8. Updating

```bash
export TAG=$(git rev-parse --short HEAD)
# API
docker build -f apps/orin-backend/Dockerfile -t $REPO/api:$TAG . && docker push $REPO/api:$TAG
gcloud run deploy orin-api --region $REGION --image $REPO/api:$TAG
# WS
docker build -f apps/ws/Dockerfile -t $REPO/ws:$TAG . && docker push $REPO/ws:$TAG
gcloud run deploy orin-ws --region $REGION --image $REPO/ws:$TAG
# UI: push to main (Git integration) or `vercel --prod`
```

Run the Neon migration (step 1.3) first whenever the schema changed.

## Custom domain later

Map `api.<domain>` → `orin-api` and `ws.<domain>` → `orin-ws` with
`gcloud run domain-mappings create` (or a global external load balancer), add
`app.<domain>` to the Vercel project, then update `ORIN_BACKEND_URL`,
`NEXT_PUBLIC_WS_URL` (redeploy Vercel), `FRONTEND_URL`, `BACKEND_URL` and the
OAuth callback URLs. The ticket flow keeps working unchanged.

## Where rate limits go (Upstash — not implemented yet)

Use `@upstash/ratelimit` + `@upstash/redis` (HTTP, works in Vercel functions
and in Cloud Run). Create the Redis database in the Upstash `ap-southeast-1`
region. Three places, each keyed differently:

1. **Express API, keyed by user id** — `apps/orin-backend/src/index.ts`, as a
   middleware mounted after `requireAuth` on `/chat`, `/template`, and
   `POST /auth/ws-ticket`. This is where AI cost lives, and `req.user.id` is
   already available. This is the most important one.
2. **Express API, keyed by client IP** — `POST /auth/login` and
   `POST /auth/register` (brute force / signup spam). The API only sees
   Vercel's egress IP, so have the Next proxy (`apps/ui/src/lib/orin-api.ts`
   → `orinBackendHeaders`) forward the real client IP in a header (e.g. from
   `x-forwarded-for`) together with an internal shared-secret header. In
   Express, trust the forwarded IP only when the shared secret matches;
   otherwise key on `req.ip` (with `app.set("trust proxy", true)` so Cloud
   Run's proxy address is unwrapped). Without the secret check anyone hitting
   the public Cloud Run URL could spoof the header. Doing it in Express rather
   than only on Vercel also covers direct calls to the Cloud Run URL.
3. **WebSocket server, in memory** — per-socket message rate and per-IP
   connection rate in `apps/ws/src/server.ts`. It is a single instance, so a
   local token bucket is enough; Upstash is not needed there.

An optional cheap fourth layer is Next `middleware.ts` on Vercel with the
Upstash edge client for `/api/auth/*`, which rejects before a function runs.

## Files

- `apps/orin-backend/Dockerfile`, `apps/ws/Dockerfile`, `.dockerignore`
- `vercel.json` (root) — Bun install/build and `sin1` region
- `render.yaml`, `apps/orin-backend/vercel.json` — obsolete; safe to delete
