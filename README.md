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
backend/               Express API (auth, chat, documents, CGM)
  src/routes/          auth.routes.ts, chat.routes.ts, document.routes.ts, cgm.routes.ts
  src/services/        auth.service.ts, user.service.ts, cgm.service.ts, …
  src/utils/jwt.ts     Token signing and verification
  src/utils/cgmWorkbook.ts  Streaming .xlsx reader (time + mg/dL only)
web/                   Vite + React client
  src/lib/api.ts       fetch wrapper, Bearer header, error unwrapping
  src/lib/tokens.ts    localStorage token store
  src/lib/wallClock.ts Zone-free timestamp helpers for CGM data
  src/data/            TanStack Query hooks (auth.ts, documents.ts, cgm.ts)
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

| Method | Path                     | Auth   | Purpose                                    |
| ------ | ------------------------ | ------ | ------------------------------------------ |
| POST   | `/api/cgm/uploads`       | bearer | Upload an `.xlsx` export; returns **202**   |
| GET    | `/api/cgm/uploads`       | bearer | List uploads and their ingest status        |
| GET    | `/api/cgm/uploads/:id`   | bearer | One upload — poll this while it parses      |
| DELETE | `/api/cgm/uploads/:id`   | bearer | Delete an upload and the readings it added  |
| GET    | `/api/cgm/readings`      | bearer | One page of readings, in time order         |
| PATCH  | `/api/cgm/readings/:id`  | bearer | Set a reading's comment                     |

The backend also serves `/api/chat` and `/api/documents`, and a liveness probe at `/health` (outside `/api`); the web client does not call those two.

## CGM exports

`/cgm` ingests the `.xlsx` a Glunovo-style sensor app exports and charts it.

A reading is four fields, and nothing else is kept:

```ts
{ id: string; mgDl: number; timeStamp: string; comment: string }
```

1. **Only the time and mg/dL columns are read.** The readings sheet is found by its header row (`Time` plus `mg/dL`), not by name or position, and the two columns are matched by title — so a blank spacer column, an unused column, a reordered export, or a renamed sheet all pass through. The other sheets (`Carb`, `Insulin`, `Sport`, `Medication`, `BG`, `AlarmAlert`) are ignored.
2. **`mgDl` defaults to 0.** A blank cell, or a row recorded while the sensor was still warming up, is stored as `0`.
3. **`comment` is the user's.** It is never read from a file, and a re-upload never touches one.
4. **Upload is asynchronous.** The file is spooled to disk and `POST /api/cgm/uploads` returns `202` immediately with the row in `processing`. Parsing streams the workbook and commits in batches of 1000, so a 12 MB file (200k readings) lands in ~11 s without holding anything large in memory. The client polls the upload until it reads `ready` or `failed`.
5. **Re-uploading is safe.** `cgm_readings` is unique on `(user_id, recorded_at)` and inserts are `ON CONFLICT DO NOTHING`, so overlapping exports add only their new tail — comments on the readings they share stay put.
6. **Timestamps carry no time zone**, because the export carries none. They are stored as `timestamp` — the device's own wall clock — and travel as plain `YYYY-MM-DDTHH:MM:SS` text so no layer can shift 16:01 into another zone. See `web/src/lib/wallClock.ts`.
7. **Reads are paged.** `GET /api/cgm/readings?page=1&pageSize=200&order=asc` returns `{ readings, page, pageSize, total, totalPages }`, sorted by time. `pageSize` caps at 1000. The `(user_id, recorded_at)` unique index serves the sort and the offset, so a page costs about the same at page 1 or page 999 (~180-240 ms over 200k readings).

The chart is [TanStack Charts](https://tanstack.com/charts) (`@tanstack/charts`), plotting the current page. Its x axis is a d3 `scaleTime` rather than a compact point scale, so a gap in the sensor's record takes up its real width.

Two settings are optional in `backend/.env`: `MAX_CGM_UPLOAD_BYTES` (default 100 MiB) and `CGM_UPLOAD_DIR` (defaults to the OS temp directory — set it if that is a small tmpfs).

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
