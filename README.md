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
# Create config/environments/development.json (not in git) with your local db credentials,
# port, FRONT_END_URL and JWT_SECRET
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
database/migrations/          001–060, one migration per table, queryInterface style (see .model_docs/MIGRATIONS.md)
database/seeders/             Dev-only base school + staff logins (staging only; never production)
```

## File storage (Cloudflare R2)

Files never pass through the API. The browser asks `POST /api/auth/get-presigned-url`
(`{dirName, fileName, contentType, contentLength}`) for a 5-minute presigned PUT, uploads directly to R2,
then saves the returned `objectKey` through the normal JSON endpoints. R2 has no presigned POST, so
Content-Type and the exact Content-Length are signed: the API refuses to sign a file over the folder's
limit (images 2 MB, admission documents 10 MB) and R2 rejects (403) a body of any other size or type.
Images are checked again (HEAD) before a record points at them.

- Env: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`,
  `CLOUDFLARE_R2_BUCKET` (required, else 503), `CLOUDFLARE_R2_ENDPOINT`, optional `CLOUDFLARE_R2_PUBLIC_BASE_URL`.
- Allowed folders: `avatars` (JPG/PNG) and `admissions/{applicationId}/documents` (images, PDF, Word);
  file names must be `<uuid>.<ext>`.
- **The bucket must stay private** (no public r2.dev / custom domain). Admission documents are read via
  `GET /api/applications/:id/documents/:documentId/url` (role + record checked, 5-minute signed GET);
  avatars are returned as signed `photoUrl` links (1 hour) in user responses.
- **CORS:** the bucket's CORS policy must allow `PUT` (and `GET`) with header `Content-Type` from every
  frontend origin, e.g. `http://localhost:5173` and the production portal URL.

## Staging / production

Every setting comes from the server environment; the variables are listed in `.model_docs/docs/DEPLOYMENT-STAGE.md` (config, R2 CORS,
deploy sequence, migrate, seed, smoke tests). With `NODE_ENV=staging` or `production` the API exits at startup
with the list of missing or unsafe variables; the refresh cookie is `Secure; SameSite=None` and `trust proxy`
is on by default in both.
