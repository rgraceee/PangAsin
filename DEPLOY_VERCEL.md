# PangAsin on Vercel

Full-stack deployment: one Vercel Function runs Flask and serves the React
build. PostgreSQL stays on Supabase (external).

## Prerequisites

- Vercel account + Vercel CLI (`npx vercel`)
- Supabase `DATABASE_URL` (the Tokyo pooler host already used locally)
- Node 18+ / Python 3.12+ only for local builds and tests

## 1. Deploy

Vercel deploys the **working tree** when using the CLI. Commit first if you
prefer a Git-based deploy.

```powershell
npx vercel login
npx vercel link          # create/link the project
npx vercel --prod
```

The first deploy may fail on database access until the environment variables
below are set. That is expected.

## 2. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, then
redeploy (`npx vercel --prod`).

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase pooler URL, port **6543**, `?sslmode=require` |
| `SECRET_KEY` | long random string |
| `FLASK_ENV` | `production` |
| `FRONTEND_URL` | `https://<your-project>.vercel.app` (no trailing slash) |
| `REPORTS_DIR` | `/tmp/reports` |
| `DB_POOL_SIZE` | `2` |
| `DB_MAX_OVERFLOW` | `2` |
| `MAIL_*` | only if password-reset email is needed |

`MAIL_SERVER`, `MAIL_PORT`, `MAIL_USE_TLS`, `MAIL_USERNAME`,
`MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER`.

## 3. Do not run migrations

The live Supabase database is already migrated. Its Alembic revision
(`20261102e003`) is not present in this repository, so `flask db upgrade`
will fail with "Can't locate revision". Deploying does not require it.

## 4. Post-deploy checklist

- [ ] `/` landing page loads
- [ ] `/login` loads CSS/JS (no white screen)
- [ ] SuperAdmin login works
- [ ] Public dashboard and maps render
- [ ] Add Municipality auto-detects the bundled boundary
- [ ] Create + download a report
- [ ] Run a forecast
- [ ] Password-reset link uses the Vercel URL (requires `MAIL_*`)

## 5. Known limitations on Vercel

- **GeoJSON upload** (Edit Municipality) fails: the filesystem is read-only.
  Add Municipality and all maps are unaffected.
- **Report files** live in `/tmp`; they are regenerated on download after a
  cold start or redeploy.
- **Rate limiting** is in-process, so each instance has its own counters.
  `ProxyFix` is enabled so limits key on the real client IP.
- **Request bodies** over ~4.5 MB are rejected.
- **Forecasts** must finish within `maxDuration` (300 s).
- **Backups** use the SQLAlchemy logical-dump fallback (no `pg_dump`).
- Vercel Hobby is non-commercial; use Pro for a real production deployment.

## Configuration files

| File | Purpose |
|---|---|
| `index.py` | Flask entrypoint (`app = create_app()`) |
| `vercel.json` | Build command, Tokyo region, included files, 300 s duration |
| `.python-version` | Pins Python 3.12 (numpy 1.26 has no 3.13 wheels) |
| `.vercelignore` | Keeps `venv/`, `node_modules/`, tests, and secrets out of the upload |
