# Deploying to Railway

The repo is one GitHub project but **three Railway services**: a Postgres database,
the Express API in `backend/`, and the static Vite build of `web/`.

| Service  | Railway **Root Directory** | Config file          | Public? |
| -------- | -------------------------- | -------------------- | ------- |
| Postgres | –                          | –                    | no      |
| `api`    | `backend`                  | `backend/railway.json` | yes   |
| `web`    | `/` (leave empty)          | `railway.json`         | yes   |

> The web service **must** build from the repo root. `web/` is an npm workspace and
> has no lockfile of its own — pointing Railway at `web/` would make `npm ci` fail.
> `backend/` has its own `package.json` and lockfile, so it builds from `backend`.

Each service picks up the `railway.json` sitting at its own root directory, so the
build and start commands are already committed. You only set the root directory and
the variables.

## 1. Database

New Project → **Add service → Database → Postgres**.

The migrations need the `pgcrypto` and `vector` (pgvector) extensions. Railway's
Postgres image ships pgvector; if the API's first deploy fails with
`extension "vector" is not available`, delete the database and add the
**pgvector** template instead (Add service → Template → search "pgvector").

## 2. API service

Add service → **GitHub repo** → this repo. Then in its **Settings**:

- **Root Directory**: `backend`
- **Networking → Public Networking**: *Generate Domain* (port `4000` is irrelevant —
  Railway injects `PORT` and the app reads it)

**Variables** (Variables tab → *Raw Editor* makes this one paste):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
JWT_SECRET=<paste a long random string>
JWT_EXPIRES_IN=1d
OPENAI_API_KEY=<your key>
CORS_ORIGIN=https://<the web service domain from step 3>
```

Generate a secret with `openssl rand -base64 48` (or `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`).

Every one of `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` and `OPENAI_API_KEY` is
required — `backend/src/config/env.ts` exits on startup if any is missing. Do **not**
set `PORT`; Railway provides it.

If you named the database service something other than `Postgres`, change the
reference to match (`${{<service-name>.DATABASE_URL}}`).

The start command is `npm run migrate:prod && npm start`, so migrations run against
the compiled `dist/db/migrations` on every boot before the server listens. The
healthcheck hits `/health`.

## 3. Web service

Add service → **GitHub repo** → the same repo again. In its **Settings**:

- **Root Directory**: leave empty (repo root)
- **Networking → Public Networking**: *Generate Domain*

**Variables**:

```
VITE_API_URL=https://<the api service domain from step 2>
```

`VITE_API_URL` is baked in at **build** time (`web/src/lib/api.ts` reads
`import.meta.env.VITE_API_URL`), so changing it needs a redeploy, not a restart.

## 4. The one ordering trap

The two domains reference each other, so:

1. Generate both domains first (steps 2 and 3).
2. Set `CORS_ORIGIN` on the API to the web domain — no trailing slash.
3. Set `VITE_API_URL` on the web service to the API domain — no trailing slash.
4. Redeploy **both**. The web build only picks up `VITE_API_URL` on a fresh build.

## Verifying

```bash
curl https://<api-domain>/health              # {"status":"ok"}
curl https://<api-domain>/api/auth/me         # {"error":"..."} — 401, which means it is alive
```

Then open the web domain and register an account. If login fails with a network
error, open devtools: a CORS message means `CORS_ORIGIN` does not exactly match the
web origin; a request going to the web domain's own `/api` means `VITE_API_URL` was
missing at build time.

## Notes

- **Uploads are ephemeral.** CGM workbooks are spooled to the OS temp directory
  while they parse, and Railway wipes the filesystem on every deploy. Parsed
  readings live in Postgres, so this only matters for an upload in flight during a
  redeploy. Set `CGM_UPLOAD_DIR` to a mounted volume if you want them to survive.
- **Rate limiting** keys off `X-Forwarded-For`; `app.set("trust proxy", 1)` in
  `backend/src/app.ts` is what makes that correct behind Railway's proxy.
- **Rolling back a migration** is manual: `railway run --service api npm run migrate:down`
  from a local checkout with the Railway CLI.
