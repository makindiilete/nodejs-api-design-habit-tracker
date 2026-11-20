# Habit Tracker API

A REST API for tracking habits, built with Node.js, Express 5, TypeScript and PostgreSQL (via Drizzle ORM). It is my working repository for the [API Design with Node.js, v5](https://frontendmasters.com/courses/api-design-nodejs-v5) course on Frontend Masters, plus my own interview-ready notes.

[![Frontend Masters](https://static.frontendmasters.com/assets/brand/logos/full.png)](https://frontendmasters.com/courses/api-design-nodejs-v5)

## Status

Work in progress, following the course.

| Area | State |
| --- | --- |
| Express app, global middleware (helmet, cors, morgan, body parsers) | Done |
| Route structure (`/api/auth`, `/api/habits`, `/api/users`) | Done, handlers are stubs |
| Zod request validation middleware | Done, used on habit creation |
| Env loading and validation (`env.ts`) | Done |
| Database schema (Drizzle and Prisma versions) | Written, not yet wired to the routes |
| JWT auth, password hashing, real CRUD | Planned |

## Tech stack

- Node.js 23.6+ (runs TypeScript directly, no build step)
- Express 5, helmet, cors, morgan
- Zod 4 for validation
- PostgreSQL with Drizzle ORM and drizzle-kit (a Prisma schema is included for comparison)
- `jose` (JWT) and `bcrypt` (password hashing), installed for upcoming lessons
- Vitest and Supertest for tests

## Getting started

```bash
# Node.js 23.6.0 or higher is required
git clone https://github.com/makindiilete/nodejs-api-design-habit-tracker.git
cd nodejs-api-design-habit-tracker
npm install
cp .env.example .env
```

Edit `.env` and set at least `DATABASE_URL` to a Postgres connection string.

```bash
npm run dev
```

The server starts on `http://localhost:3000` (or `PORT`). Check it with:

```bash
curl http://localhost:3000/health
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the server with file watching |
| `npm start` | Start the server |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

## Configuration

Environment variables are loaded from `.env` in development and `.env.test` when `APP_STAGE=test`, then validated with Zod in `env.ts`. The app exits at startup if validation fails. See `.env.example` for the full list.

| Variable | Notes |
| --- | --- |
| `PORT` | Defaults to `3000` |
| `APP_STAGE` | `dev` (default), `test` or `production` |
| `NODE_ENV` | `development` (default), `test` or `production` |
| `DATABASE_URL` | Postgres connection string, used by `drizzle.config.ts` |

`.env.example` also lists JWT, CORS, rate limiting and logging settings. These are not validated or used yet.

## Project structure

```
src/
  index.ts          Entry point, starts the HTTP server
  server.ts         Express app and global middleware
  routes/           authRoutes, habitRoutes, userRoutes
  middleware/       validation.ts (Zod body validation)
  db/               schema.ts (Drizzle) and schema.prisma
env.ts              Env loading and validation
drizzle.config.ts   drizzle-kit configuration
docs/               Study notes, see docs/README.md
class/              Class screenshots per course section
API_DOCS.md         Planned endpoint reference
```

## API

Base URL: `http://localhost:3000/api`. `GET /health` returns a simple status message.

[`API_DOCS.md`](./API_DOCS.md) documents the planned endpoints: register and login, habit CRUD, completing a habit, habit stats, and user profile and password. Not all of them are implemented yet.

## Notes

Interview-ready notes on the topics covered (middleware, validation, status codes, relational databases, ER diagrams, Drizzle, Prisma and more) live in [`docs/`](./docs/README.md).

## Course resources

- [Course on Frontend Masters](https://frontendmasters.com/courses/api-design-nodejs-v5)
- [Course notes on Notion](https://api-design-with-node-v5.super.site/)
- The original course repository uses these branches:
  - `lesson-X` are checkpoints for starting each section.
  - `lesson-X-solution` have the completed code for each section.
  - `live-lesson-X` are the live-coded solutions, the best for debugging.
