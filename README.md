# TR — TanStack + Express + Postgres

A React client wired to the `backend/` API.

- **Frontend** — Vite + React 19, TanStack Router (file-based, code-split) and TanStack Query
- **Backend** — Express 4, `pg` + node-pg-migrate, Zod validation (`backend/`)
- **Database** — Postgres in Docker (the backend's migrations require the `pgvector` and `pgcrypto` extensions)
- **Auth** — bcrypt password hashing, a single JWT held in `localStorage` and sent as `Authorization: Bearer`

## Quick start

```bash
npm install
npm install --prefix backend
npm run db:up          # start Postgres (host port 5433)
npm run db:migrate     # apply backend migrations
npm run dev            # api on :4000, web on :5173
```

Open http://localhost:5173.

## Layout

```
docker-compose.yml     Postgres service
backend/               Express API (auth, chat, documents)
  src/routes/          auth.routes.ts, chat.routes.ts, document.routes.ts
  src/services/        auth.service.ts, user.service.ts, …
  src/utils/jwt.ts     Token signing and verification
web/                   Vite + React client
  src/lib/api.ts       fetch wrapper, Bearer header, error unwrapping
  src/lib/tokens.ts    localStorage token store
  src/lib/auth.ts      TanStack Query hooks for the session
  src/routes/          file-based routes; `_authed.tsx` guards its children
```

## How auth works

1. `register` / `login` verify credentials and return `{ user, token }`. The client stores the JWT in `localStorage` under `auth.token`.
2. Every request carries `Authorization: Bearer <token>`; the server reads nothing else.
3. There is **no refresh endpoint** — the token is stateless and lives for `JWT_EXPIRES_IN` (default `1d`). When it expires the client clears it on the next 401 and the user signs in again.
4. `POST /api/auth/logout` requires the bearer token but does not revoke anything server-side; signing out is a client-side token clear.
5. Errors come back as `{ "error": "message" }`, with `{ "details": { field: [...] } }` added on validation failures.

> **Security note:** `localStorage` is readable by any script running on the page, so an XSS flaw exposes the token. `HttpOnly` cookies prevent that. Keep the CSP tight and audit third-party scripts.

Because the Vite dev server proxies `/api` to the API, the browser sees one origin and there is no CORS preflight. `CORS_ORIGIN` is configured in `backend/.env` for when the two are deployed to separate hosts.

## API used by the web client

| Method | Path                 | Auth   | Purpose                       |
| ------ | -------------------- | ------ | ----------------------------- |
| POST   | `/api/auth/register` | –      | Create account, return token  |
| POST   | `/api/auth/login`    | –      | Return token                  |
| GET    | `/api/auth/me`       | bearer | Current user                  |
| POST   | `/api/auth/logout`   | bearer | Acknowledge sign-out          |

The backend also serves `/api/chat` and `/api/documents`, and a liveness probe at `/health` (outside `/api`); the web client does not call them.

## Scripts

| Command              | Effect                                     |
| -------------------- | ------------------------------------------ |
| `npm run dev`        | API and web together                       |
| `npm run build`      | Build both                                 |
| `npm run db:up/down` | Start / stop Postgres                      |
| `npm run db:reset`   | Destroy the volume and start fresh         |
| `npm run db:migrate` | `node-pg-migrate up`                       |

## Before deploying

- Replace `JWT_SECRET` in `backend/.env` — the committed value is a development placeholder:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- Set `NODE_ENV=production` and put the API behind TLS — bearer tokens travel in plain headers.
- Set `CORS_ORIGIN` to your real frontend origin.
