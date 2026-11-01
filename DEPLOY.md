# PangAsin Deployment Guide

Production deployment checklist for the PangAsin salt production monitoring
system (Flask backend + React frontend, served by Flask).

## Prerequisites

- Python 3.11+
- Node.js 18+ (only to rebuild the React frontend)
- PostgreSQL database (Supabase recommended) with `DATABASE_URL`
- SMTP credentials for password-reset email (MAIL_USERNAME / MAIL_PASSWORD)
- A terminal with access to the server

---

## 1. Prepare the environment

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL, SECRET_KEY, MAIL_*, FRONTEND_URL
```

**Never commit `.env`** — it contains secrets. Add it to `.gitignore`.

Required variables:

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Or `sqlite:///./pangasin.db` for local |
| `SECRET_KEY` | `replace-with-a-long-random-string` | Generate with `openssl rand -hex 32` |
| `FLASK_ENV` | `production` | Set to `production` to disable debug |
| `FRONTEND_URL` | `https://pangasin.example.org` | Used in reset links |
| `MAIL_SERVER` | `smtp.gmail.com` | SMTP host |
| `MAIL_PORT` | `587` | SMTP port |
| `MAIL_USE_TLS` | `true` | Usually true for port 587 |
| `MAIL_USERNAME` | `app@gmail.com` | SMTP username |
| `MAIL_PASSWORD` | `16-char-app-password` | Google App Password, not account password |
| `MAIL_DEFAULT_SENDER` | `PangAsin <app@gmail.com>` | From address |

Optional overrides (defaults applied if unset):

| Variable | Default | Notes |
|----------|---------|-------|
| `PASSWORD_RESET_TOKEN_MINUTES` | `30` | Reset link validity |
| `PASSWORD_RESET_RATE_LIMIT` | `5` | Reset requests per hour per email/IP |
| `PASSWORD_RESET_RATE_WINDOW` | `3600` | Rate window in seconds |
| `LOGIN_RATE_LIMIT` | `10` | Login attempts per window |
| `LOGIN_RATE_WINDOW` | `60` | Login rate window in seconds |
| `ADMIN_WRITE_RATE_LIMIT` | `120` | Admin writes per window |
| `ADMIN_WRITE_RATE_WINDOW` | `60` | Admin write rate window |
| `RATE_LIMIT_ENABLED` | `1` | Set `0` to disable |

---

## 2. Install dependencies

```bash
python -m venv venv
# Linux/macOS:
source venv/bin/activate
# Windows:
venv\Scripts\activate

pip install -r requirements.txt
```

The React frontend is pre-built and served by Flask from `app/static/react/`.
Rebuild it only if you change frontend source:

```bash
cd frontend
npm install
npm run build   # outputs to app/static/react/
cd ..
```

---

## 3. Run migrations (on a copy first)

**Never run migrations directly on the production database without testing.**

### Test on a copy

1. Back up the existing production-like database (e.g. `pg_dump` for PostgreSQL,
   or copy the `.db` file for SQLite).
2. Restore the backup to a staging/copy database.
3. Point a test `.env` at the copy database.
4. Run:

```bash
set FLASK_APP=run.py
flask db upgrade
```

5. Verify the app starts and all routes respond. Check that existing data is
   intact (municipalities, users, production records).

### Production

Once verified on the copy, run the same `flask db upgrade` against the
production `DATABASE_URL`.

---

## 4. Create the first SuperAdmin

**No hardcoded credentials.** The first account is created via CLI:

```bash
flask create-superadmin
```

You will be prompted for:

- Email address (e.g. `superadmin@pangasin.gov.ph`)
- Full name

The command generates a **one-time temporary password**, prints it once, and
audit-logs the creation. Share the password with the SuperAdmin out-of-band
(e.g. in person, secure messenger). The SuperAdmin must change it on first
login.

Refusal conditions:

- Duplicate email → command exits, no account created.
- Missing email or name → command exits, no account created.

---

## 5. SMTP setup

1. Set `MAIL_*` variables in `.env`.
2. For Gmail, use a **Google App Password** (not your account password).
3. After deployment, log in as SuperAdmin and go to **Configuration > SMTP**.
4. Click **"Send test email"** to verify delivery.
5. Check the server logs if the test fails (SMTP errors are logged, not shown
   to the user — this avoids leaking provider details).

---

## 6. Backup & rollback

### Backup

SuperAdmin can download a consistent database backup from
**Configuration > Export & Backup**:

- SQLite: uses the SQLite backup API (consistent copy, not a raw file copy).
- PostgreSQL: uses `pg_dump`.

Every backup/download is audit-logged.

CSV exports (production records, salt farmers, audit log, login history) use
explicit column allowlists — no password hashes or credentials are ever
included.

### Rollback

1. Restore the database from the pre-migration backup.
2. Redeploy the previous application code version.
3. `flask db downgrade` is supported by Alembic but restoring from backup is
   safer and faster.

---

## 7. Post-deploy checklist

Test each item before announcing the system is live:

### Role-based access (each role)

| Check | Expected |
|-------|----------|
| Anonymous user hits `/api/superadmin/*` | 404 (not 403) |
| Encoder hits `/api/superadmin/*` | 404 |
| Admin hits `/api/superadmin/*` | 404 |
| SuperAdmin hits `/api/admin/users` | 404 (superadmin excluded from admin user mgmt) |
| SuperAdmin hits `/api/superadmin/users` | 200 (full user list) |
| Login with wrong password 5× | Account locked per `lockout_attempts` setting |

### Password & lockout

| Check | Expected |
|-------|----------|
| Change password below `min_password_length` | Rejected |
| Forgot-password link expires after `forgot_password_validity_minutes` | Expired error |
| Forgot-password requests above `request_limit_per_hour` | Rate-limited (429) |
| Password reset invalidates all existing sessions | Must sign in again |

### SuperAdmin functions

| Check | Expected |
|-------|----------|
| Edit approved production record without reason (≥10 chars) | Rejected (400) |
| Edit with reason | Saved, audit log shows old/new values + reason |
| Soft-delete a record | Hidden from dashboards, forecasts, exports |
| Restore from trash | Visible again |
| Permanent delete without typing "DELETE" | Rejected |
| Permanent delete with "DELETE" | Removed permanently |
| Run forecast | Completes, audit-logged |
| Reset content to default | Restores bundled wording, `last_updated` changes |

### Email

| Check | Expected |
|-------|----------|
| SMTP test email | Delivered to SuperAdmin inbox |
| Forgot-password email | Delivered with reset link |
| `MAIL_PASSWORD` in API response | Never shown (only `smtp_configured` boolean) |

### Content

| Check | Expected |
|-------|----------|
| Edit Privacy Policy | Public `/privacy` page updates |
| Reset Privacy Policy to default | Bundled wording restored |
| `<script>` tag in edited content | Stripped server-side (no XSS) |

---

## 8. Security notes

- Debug mode is disabled when `FLASK_ENV=production`.
- Password hashes use werkzeug's `generate_password_hash` (bcrypt-compatible).
- Password reset tokens are SHA-256 hashed, single-use, and time-limited.
- Session version increments on password reset → all existing sessions invalidated.
- Rate limiting applies to login, password reset, and admin write endpoints.
- CSV cells starting with `=`, `+`, `-`, `@` are prefixed with `'` to prevent
  CSV injection.
- No 2FA, custom role editor, forecast scheduling, or maintenance mode —
  these are out of scope.

---

## Support

Contact the ASIN Center system administrator at Pangasinan State University
for deployment issues.
