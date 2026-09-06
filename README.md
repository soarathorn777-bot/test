# TR — TanStack + Express + Prisma + Postgres starter

A minimal full-stack boilerplate with users and authentication, and nothing else.

- **Frontend** — Vite + React 19, TanStack Router (file-based, code-split) and TanStack Query
- **Backend** — Express 5, Prisma 6, Zod validation
- **Database** — Postgres 17 in Docker
- **Auth** — bcrypt password hashing, short-lived JWT access token + rotating refresh sessions, both held in `localStorage` and sent as `Authorization: Bearer`

## Quick start

```bash
npm install
npm run db:up          # start Postgres (host port 5433)
npm run db:migrate     # apply migrations
npm run db:seed --workspace server   # optional demo users
npm run dev            # api on :4000, web on :5173
```

Open http://localhost:5173.

Seeded accounts: `admin@example.com` / `password123` and `user@example.com` / `password123`.

> **npm 12 note:** dependency install scripts are blocked by default. The approvals Prisma and esbuild need are already recorded in the root `package.json` under `allowScripts`. If you bump those packages, re-approve with `npm install-scripts approve prisma @prisma/client @prisma/engines esbuild`.

## Layout

```
docker-compose.yml     Postgres service
server/                Express API
  prisma/schema.prisma User + Session models
  src/env.ts           Zod-validated environment
  src/lib/tokens.ts    Access-token signing, refresh rotation/revocation
  src/middleware/      attachUser / requireAuth, error handler
  src/routes/          auth.ts, users.ts
web/                   Vite + React client
  src/lib/api.ts       fetch wrapper, Bearer header, auto-refresh + replay on 401
  src/lib/tokens.ts    localStorage token store
  src/lib/auth.ts      TanStack Query hooks for the session
  src/routes/          file-based routes; `_authed.tsx` guards its children
```

## How auth works

1. `register` / `login` verify credentials, then return two tokens in the JSON body: `accessToken` (JWT, 15 min) and `refreshToken` (opaque random, 30 days). The client stores both in `localStorage` under `auth.accessToken` / `auth.refreshToken`.
2. Every request carries `Authorization: Bearer <accessToken>`; the server reads nothing else.
3. Only a SHA-256 HMAC of each refresh token is stored, as a `Session` row — the raw value never reaches the database.
4. `POST /api/auth/refresh` takes `{ refreshToken }` in the body, **revokes it**, and issues a replacement pair. Presenting an already-revoked token is treated as theft: every session for that user is revoked immediately.
5. `web/src/lib/api.ts` retries a 401 once through `/api/auth/refresh`, and concurrent 401s share a single refresh call. A failed refresh clears the stored tokens.
6. Changing a password revokes every session, and the client clears its stored tokens.

> **Security note:** `localStorage` is readable by any script running on the page, so an XSS flaw exposes both tokens — including the 30-day refresh token. `HttpOnly` cookies prevent that. Keep the CSP tight and audit third-party scripts.

## API

| Method | Path                      | Auth   | Purpose                            |
| ------ | ------------------------- | ------ | ---------------------------------- |
| GET    | `/api/health`             | –      | Liveness                           |
| POST   | `/api/auth/register`      | –      | Create account, start session      |
| POST   | `/api/auth/login`         | –      | Start session                      |
| POST   | `/api/auth/refresh`       | body   | Rotate tokens                      |
| POST   | `/api/auth/logout`        | body   | Revoke this session                |
| POST   | `/api/auth/logout-all`    | yes    | Revoke every session               |
| GET    | `/api/auth/me`            | yes    | Current user                       |
| GET    | `/api/users/me`           | yes    | Current user                       |
| PATCH  | `/api/users/me`           | yes    | Update name / email                |
| POST   | `/api/users/me/password`  | yes    | Change password, revoke sessions   |

Errors are uniform: `{ "error": { "code", "message", "details"? } }`.

## Scripts

| Command              | Effect                                     |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | API and web together                       |
| `npm run build`      | Typecheck and build both                   |
| `npm run typecheck`  | Types only                                 |
| `npm run db:up/down` | Start / stop Postgres                      |
| `npm run db:reset`   | Destroy the volume and start fresh         |
| `npm run db:migrate` | `prisma migrate dev`                       |
| `npm run db:studio`  | Prisma Studio                              |

## Before deploying

- Replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `server/.env` — the committed values are development placeholders:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- Set `NODE_ENV=production` and put the API behind TLS — bearer tokens travel in plain headers.
- Set `CORS_ORIGIN` to your real frontend origin.
- Run `prisma migrate deploy` rather than `migrate dev`.
- Add a periodic job to delete `sessions` rows past `expiresAt`.
