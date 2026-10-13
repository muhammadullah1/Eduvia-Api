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
