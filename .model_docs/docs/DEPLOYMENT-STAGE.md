# Stage deployment

Exact configuration and order for deploying Eduvia to **Stage** (`NODE_ENV=staging`). Production uses the
same steps with production values and `NODE_ENV=production`. Locally the API uses
`config/environments/development.json` (not in git); on the server every setting comes from the environment
variables in section 4. Hosts below are placeholders; never commit real values.

## Branch strategy

| Branch | API (GitHub Actions `deploy-api.yml`) | Frontend (Vercel) |
| --- | --- | --- |
| `dev` | every push deploys to the `staging` GitHub Environment (dev/stage Oracle server) | Preview / branch deployment with the Stage `VITE_API_URL` |
| `main` | production, **manual only**: Actions → Deploy API → Run workflow → `production` (refused from other branches; needs reviewer approval) | Production deployment with the production `VITE_API_URL` |
| feature branches (`EDUVIA-*`) | optional manual staging deploy via Run workflow → `staging` | Vercel previews |

Feature branches merge into `dev`; `dev` merges into `main` when Stage is verified.

## 1. Database (PostgreSQL)

- Create an empty database and a login role that owns it (e.g. `eduvia_stage` / `eduvia_app`).
- TLS or a private network between the API and the DB.
- The schema comes only from `npm run db:migrate` (step 6). Don't restore dev/test dumps into Stage.

## 2. Cloudflare R2

- Bucket: one per environment (e.g. `eduvia-stage`), **private** (no public access, no custom domain).
- API token: "Object Read & Write" scoped to that bucket only → `CLOUDFLARE_R2_ACCESS_KEY_ID` /
  `CLOUDFLARE_R2_SECRET_ACCESS_KEY`.
- Endpoint: `https://<account-id>.r2.cloudflarestorage.com`.
- CORS policy (R2 → bucket → Settings → CORS policy). Uploads are presigned PUTs that sign the
  `Content-Type` and `Content-Length`; downloads/previews are presigned GETs:

```json
[
  {
    "AllowedOrigins": ["https://<stage-portal-host>"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

  Add `http://localhost:5173` only on the dev bucket, never on Stage/production.

## 3. Resend

- Verify the sending domain (SPF/DKIM DNS records) in Resend.
- `EMAIL_FROM` must be an address on that verified domain; `EMAIL_FROM_NAME=Eduvia`.
- Create a sending-only API key → `RESEND_API_KEY`.

## 4. API host environment

Set these variables in `APP_DIR/.env` on the server (`chmod 600`, never in git). This list is the
reference; there is no template file. **Required** ones are checked at startup: with `NODE_ENV=staging` or
`production` the API refuses to start if one is missing or unsafe (`config/runtime.js`).

| Variable | Required | Stage value |
| --- | --- | --- |
| `NODE_ENV` | yes | `staging` |
| `PORT`, `IP_ADDRESS` | no | host's port, `0.0.0.0` |
| `APP_VERSION`, `LOG_LEVEL` | no | release label; `info` (trace, debug, info, warn, error) |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` | yes | step 1 |
| `JWT_SECRET` | yes | `openssl rand -base64 48` (≥ 32 chars, not the default; Stage and production must differ) |
| `FRONT_END_URL` | yes | `https://<stage-portal-host>` (https, not localhost) |
| `ALLOWED_ORIGINS` | yes | `https://<stage-portal-host>` (comma-separate extra origins; https only, no path) |
| `RESEND_API_KEY`, `EMAIL_FROM` | yes | step 3 (sender on a domain verified in Resend) |
| `EMAIL_FROM_NAME` | no | sender display name |
| `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET` | yes | step 2 |
| `CLOUDFLARE_R2_ENDPOINT` | yes | `https://<account-id>.r2.cloudflarestorage.com` |
| `CLOUDFLARE_R2_PUBLIC_BASE_URL` | no | empty (private bucket, presigned URLs) |
| `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN`, `TRUST_PROXY` | no | empty (defaults below) |

Defaults in `staging`/`production` (config/runtime.js):

- Refresh cookie `eduvia_refresh`: `HttpOnly; Secure; SameSite=None; Path=/api/auth`, 7 days, no Domain.
  `SameSite=None` without `Secure` is refused, and `COOKIE_SECURE=false` is refused in these environments.
- `trust proxy` = 1 hop (the platform's load balancer terminates TLS).
- The API must be served over **HTTPS**.

Startup validation: with `NODE_ENV=staging|production` the API (and `sequelize` CLI, which loads the same
config) exits immediately with `Eduvia API can't start in staging: - Missing: …` if any of the DB vars,
`JWT_SECRET`, `FRONT_END_URL`, `ALLOWED_ORIGINS`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`,
`CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_ENDPOINT`, `RESEND_API_KEY` or `EMAIL_FROM` is missing, if `JWT_SECRET` is the
default or shorter than 32 characters, or if `FRONT_END_URL`/`ALLOWED_ORIGINS` are not https or point to localhost.

Node ≥ 18 (`engines`, CI uses 20), health check `GET /health`. The server keeps settings only in
`APP_DIR/.env` (never in GitHub). The workflow uploads the code with rsync, runs `npm ci`, migrations and
`npm prune --omit=dev`, reloads pm2 (`ecosystem.config.js`, 2 cluster instances, so reloads have no downtime)
and polls `/health`.

### GitHub setup (Settings → Environments)

- Environments `staging` and `production`. `production`: required reviewer, deployment branches limited to `main`.
- Secrets per environment: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` (private key of a deploy-only
  ed25519 key), `SERVER_KNOWN_HOSTS` (`ssh-keyscan -H <host>` output, fingerprint checked).
- Variables per environment: `APP_DIR`, `PM2_APP_NAME`, `API_HEALTH_URL` (`https://<api-host>/health`),
  optional `SERVER_PORT` (default 22).
- Branch protection on `dev` and `main`: pull request + passing "Lint and test" check.

### Oracle server prerequisites

- Node 20 + npm, `npm i -g pm2`, `pm2 startup` (start on reboot).
- Deploy user with the deploy public key in `~/.ssh/authorized_keys`; `APP_DIR` owned by it.
- `APP_DIR/.env` with the variables from section 4 (`chmod 600`), `NODE_ENV=staging` on the stage server.
- PostgreSQL reachable from the VM, database created.
- nginx/Caddy HTTPS reverse proxy (Let's Encrypt) to the app `PORT`, forwarding `X-Forwarded-*`;
  Oracle security list / NSG and the VM firewall open on 80/443 only.

## 5. Frontend (Vercel)

Project env (Preview/Production scope as used for Stage):

| Variable | Value |
| --- | --- |
| `VITE_API_URL` | `https://<stage-api-host>/api` (required: the build fails without it) |
| `VITE_R2_PUBLIC_BASE_URL` | not set (private bucket) |

Build `npm run build`, output `dist`; `vercel.json` already rewrites all paths to `index.html`.

## 6. Deploy sequence

1. Create the DB, R2 bucket + CORS, Resend domain + key (steps 1–3).
2. Set the API env (step 4) and deploy the API (push to `dev`, or Run workflow → `staging`). Confirm boot logs show
   `Eduvia API listening` and no `can't start` error.
3. Migrations run in the workflow; to check or run them by hand on the server (same `.env`):
   ```bash
   npm run db:migrate          # applies 60 files, one per table
   npm run db:migrate:status   # expect 60 "up", 0 "down"
   ```
4. On staging deploys only, the workflow runs the dev seed after migrating
   (`database/seeders/20261031120000-eduvia-base-school.js`). It needs no env vars: the school and
   logins are hardcoded dev-only values, and the initial passwords are in that file (not in docs).
   It is idempotent (skips when `office@dev.geteduvia.site` exists, even soft-deleted) and refuses
   to run with `NODE_ENV=production`. It creates "Eduvia Dev School" and 12 staff logins on
   `dev.geteduvia.site`: `admin1-3@`, `operations1-3@`, `accountant1-3@`, `teacher1-3@`.
   To run it by hand on the server (sequelize-cli is a dev package the deploy prunes):
   ```bash
   cd "$APP_DIR" && npm ci && npx --no-install sequelize db:seed --seed 20261031120000-eduvia-base-school.js && npm prune --omit=dev
   ```
5. Set `VITE_API_URL` on Vercel (step 5) and redeploy the frontend.
6. Smoke tests (below).

## 7. Smoke tests

1. `curl -i https://<stage-api-host>/health` → `200`.
2. CORS preflight from the portal origin:
   `curl -i -X OPTIONS https://<stage-api-host>/api/auth/login -H "Origin: https://<stage-portal-host>" -H "Access-Control-Request-Method: POST"`
   → `Access-Control-Allow-Origin: https://<stage-portal-host>` and `Access-Control-Allow-Credentials: true`.
   The same request with `Origin: https://evil.example.com` must not get the allow-origin header.
3. Sign in on the portal as the seeded super admin. In DevTools → Network → `login` response:
   `Set-Cookie: eduvia_refresh=…; Path=/api/auth; HttpOnly; Secure; SameSite=None`.
4. Reload the page after the 15-minute access token or clear it: `POST /api/auth/refresh` returns `200`
   (cookie sent cross-site), and sign-out clears the cookie.
5. Upload a student photo / document, then open it: PUT to R2 succeeds (no CORS error), the presigned GET loads.
6. Trigger a password-reset / invite email and confirm it arrives from `EMAIL_FROM` with links to `FRONT_END_URL`.
7. `npm run db:migrate:status` still shows 60 up.
