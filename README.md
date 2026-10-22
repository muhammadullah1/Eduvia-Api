# Eduvia API

School management API for Creative Leaders School (Eduvia). Phase 1 covers academic setup, admissions, students, attendance, fees, exams/marks, and timetable.

## Stack

- Node.js (Express)
- Sequelize + PostgreSQL
- Convict config, Joi validation, JWT auth

## Roles

- `management` — school admin
- `teacher` — teaching staff
- `parent` — guardians

## Setup

```bash
npm install
# Create config/environments/development.json (this folder is not in git)
# Set db credentials, port, frontEndUrl, signInJwtSecret
npm run db:migrate
npm run dev
```

- Health: `GET /health`
- API base: `/api`
- Default dev port: `5000` (see `development.json`)

Send `platform: webApp` header on API requests (or `mobile` with a matching `version` header).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Start production server |
| `npm run db:migrate` | Run migrations |
| `npm run db:migrate:undo` | Undo last migration |
| `npm run db:migrate:status` | Migration status |

## Project layout

```
config/          Convict schema + environment JSON
constants/       Roles, statuses, enums
controllers/     Thin request handlers
services/        DB / business logic
routes/          Express routers under /api
models/          Sequelize models (auto-loaded)
validations/     Joi schemas
middlewares/     auth, validate, platform
database/migrations/
```

## File storage (Cloudflare R2)

Files never pass through the API. The browser asks `POST /api/auth/get-presigned-url`
(`{dirName, fileName, contentType}`) for a 5-minute presigned PUT, uploads directly to R2,
then saves the returned `objectKey` through the normal JSON endpoints.

- Env: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`,
  `CLOUDFLARE_R2_BUCKET` (required, else 503), `CLOUDFLARE_R2_ENDPOINT`, optional `CLOUDFLARE_R2_PUBLIC_BASE_URL`.
- Allowed folders: `avatars` (JPG/PNG) and `admissions/{applicationId}/documents` (images, PDF, Word);
  file names must be `<uuid>.<ext>`.
- **The bucket must stay private** (no public r2.dev / custom domain). Admission documents are read via
  `GET /api/applications/:id/documents/:documentId/url` (role + record checked, 5-minute signed GET);
  avatars are returned as signed `photoUrl` links (1 hour) in user responses.
- **CORS:** the bucket's CORS policy must allow `PUT` (and `GET`) with header `Content-Type` from every
  frontend origin, e.g. `http://localhost:5173` and the production portal URL.

## Production checklist (not applied anywhere yet)

Known frontend deploy: `https://eduvia-delta.vercel.app` (Vercel, `vercel.json` SPA rewrite only).
No production API URL is configured in either repo; the deployed bundle calls the relative `/api`.

- API env: `NODE_ENV=production`, `ALLOWED_ORIGINS=https://eduvia-delta.vercel.app`,
  `FRONT_END_URL=https://eduvia-delta.vercel.app`, `JWT_SECRET`, DB vars, the `CLOUDFLARE_R2_*` vars
  (leave `CLOUDFLARE_R2_PUBLIC_BASE_URL` empty: the bucket is private).
- Refresh cookie `eduvia_refresh`: httpOnly, `Secure`, `SameSite=None` (production), `Path=/api/auth`, 7 days.
  Requires HTTPS on the API.
- Frontend (Vercel env): `VITE_API_URL=<API origin>/api`. Do not set `VITE_R2_PUBLIC_BASE_URL`.
- R2 bucket CORS (Cloudflare dashboard → R2 → bucket → Settings → CORS policy):

```json
[
  {
    "AllowedOrigins": ["https://eduvia-delta.vercel.app", "http://localhost:5173"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
