# Plan: Build the Admin (ASIN Center) side of PangAsin

## Goal
Add the missing Admin role experience to PangAsin so the ASIN Center staff can
manage users, oversee production submissions, run the **Approve / Reject** review
queue, and view an executive dashboard. The Encoder and Guest/Public sides already
exist and must continue to work.

## Scope & status
- **In scope:** shared login, `/admin/*` frontend + `app/blueprints/admin_api.py`,
  the encoder `submit` (draft→pending) bridge, derived `registered_producers`,
  and the 6 admin screens (5 real + stubs).
- **Explicitly out of scope (flagged):** wiring the Public Dashboard to live DB
  data (it stays on mock data — known gap), implementing a real "Return" action
  (enum value left in schema, UI/logic deliberately omitted), and building the
  Module 4.2 forecasting engine (does not exist — see Decisions).

## Decisions / assumptions
1. **Module 4.2 engine does not exist in this repo.** The brief says the Executive
   Dashboard's *insight callout* "reads from Module 4.2 engine, does not compute
   its own." No such module/service/CLI is present (`app/services` and
   `app/forms` are empty; README states "no trained forecasting model yet").
   → **Decision:** KPIs + trend/comparison/efficiency/contribution charts come
   from a new `GET /api/admin/stats` computed from the DB (mirror of
   `encoder_api.stats`, but cross-municipality). The *insight callout* is a
   clearly-labeled stub that reads from a **pluggable contract**
   `GET /api/admin/insight` returning `{ insight, methodology, generated_at,
   source }` — implementable now as a DB-derived summary, swappable for the real
   Module 4.2 HTTP service later. Documented as a risk + integration point.
2. **No "Return" action.** `returned` stays in the `record_status_enum`. The
   Validation Queue offers **Approve** and **Reject** only. `returned` rows (if
   any appear later) are treated as `rejected` for queueing.
3. **Single shared login.** One `Login.jsx` at route `#/login`, role-agnostic
   `POST /api/auth/login`, branches client-side: admin → `/admin`, encoder →
   `/encoder`. "Reached only by typing it directly" = no link points to `#/login`
   from the Public Dashboard (the public dashboard has no login link today — keep
   it that way; the encoder's old `#/encoder/login` becomes `#/login`).
4. **`registered_producers` is derived.** Column stays; it is set server-side to
   `male_producers + female_producers` on create + update. Removed from all
   input forms and from API input validation; shown read-only where useful. The
   existing "male+female ≠ registered" mismatch warning is deleted entirely.
5. **Admin can only manage encoders (+ view admins).** Admin CRUD on Users is
   restricted to creating/editing `encoder` accounts (with a municipality). No
   admin-creates-admin flow (avoids privilege escalation surface). Admins can
   activate/deactivate encoders.
6. **Auth gating idiom is preserved** from the encoder side:
   `@login_required` + `if current_user.role != "admin": return ...,403` on each
   admin endpoint, and a role-scoped `GET /api/admin/me` for the client-side
   `<RequireAdmin>` guard (mirroring `GET /api/encoder/me`).
7. **Git state caveat (pre-existing, not built here):** migrations and most app
   code are currently untracked/modified in the working tree. The builder should
   commit the baseline encoder work *before* adding admin code, and commit the
   migration files (they are gitignored today — see Risks).

## Routing map
Frontend (HashRouter, `App.jsx`):
```
/                      -> GuestDashboard  (unchanged)
/login                 -> Login          (NEW shared; was #/encoder/login)
/encoder               -> RequireAuth(encoder) -> EncoderLayout
  /encoder              ... index, records, records/new, records/:id/edit
/admin                 -> RequireAdmin -> AdminLayout
  /admin                ... index (Executive Dashboard)
  /admin/users          ... User Management
  /admin/validation     ... Validation Queue
  /admin/data-quality   ... Data Quality Dashboard
  /admin/municipalities ... (stub) Municipality Analytics
  /admin/trends         ... (stub) Trends & Analysis
  /admin/comparison     ... (stub) Municipality Comparison
  /admin/supply-demand  ... (stub) Supply & Demand Analytics
  /admin/forecast       ... (stub) Forecasting Dashboard
  /admin/forecast/insights ... (stub) Forecast Insights
  /admin/reports        ... (stub) Reports & Export
  /admin/reports/preview  ... (stub) Report Preview
```
Backend:
```
POST /api/auth/login      304 /api/auth/me, /api/auth/logout (existing, role-agnostic)
GET  /api/encoder/me      (exists)
PATCH /api/encoder/records/<id>/submit   NEW  (draft -> pending bridge)
POST /api/encoder/records  (MODIFIED: derived registered_producers)
PUT  /api/encoder/records/<id>  (MODIFIED: derived registered_producers)
GET  /api/admin/me        NEW  (admin profile / guard)
GET  /api/admin/municipalities   NEW
GET  /api/admin/users        NEW  (+ create/edit/activate-deactivate helpers below)
POST /api/admin/users       NEW  (create encoder)
PATCH /api/admin/users/<id>  NEW  (edit fields, toggle status, reset password)
GET  /api/admin/records     NEW  (cross-municipality; filters: status, municipality_id, barangay_id, date range)
GET  /api/admin/records/<id>  NEW  (full detail incl. submitter/reviewer)
PATCH /api/admin/records/<id>/review  NEW  (status=approved|rejected + reviewer_comment)
GET  /api/admin/stats       NEW  (province KPIs + by-municipality aggregates)
GET  /api/admin/insight     NEW  (stub: returns {insight, methodology, generated_at, source})
GET  /api/admin/data-quality NEW (completeness + quality scores)
```

## Backend tasks
### B1. `app/blueprints/admin_api.py` (NEW)
- Blueprint `admin_api_bp`, register in `create_app` with `url_prefix="/api/admin"`.
  (Note: existing `encoder_api_bp`/`auth_api_bp` bake their prefix into the
  `Blueprint(...)` constructor; do the same for consistency —
  `url_prefix="/api/admin"`.)
- Guard helper: `require_admin = lambda: current_user.role != "admin"` (reuse the
  inline idiom from `encoder_api`).
- Reuse serialization shape. Define a local `_serialize(record)` mirroring
  `encoder_api._serialize` but adding `municipality_name`, `barangay` name,
  `submitter` name/email, `reviewer` name, `status`, `reviewer_comment`,
  `submitted_at`, `reviewed_at`, `reviewed_by` (names resolved).
- Endpoints implement with `db.session` patterns already used; wrap writes in
  try/except IntegrityError/exception like `encoder_api`.
- `/api/admin/records` list filters: `status`, `municipality_id`, `barangay_id`,
  `q` (barangay name search), `start`/`end` (record_date range), pagination
  (`page`/`limit` — encoder has none, add it since admin sees everything).
- `/api/admin/records/<id>/review`: only move `pending` (or `draft`?) → accept
  pending. Set `status`, `reviewed_by=current_user.id`, `reviewed_at=utcnow()`,
  `reviewer_comment`. Return serialized record. (Per decision: Approve/Reject
  only; no `returned`.)
- `/api/admin/stats`: mirror `encoder_api.stats` but aggregate across ALL
  municipalities: totals + list of `{municipality_id, municipality_name,
  productionMT, record_count, registered_producers, by_barangay[...]}`. Add
  `pending_validation_count` for the KPI.
- `/api/admin/data-quality`: for each municipality, over its records
  (all statuses), compute per-field completeness and a composite **quality
  score = weighted mean of field-completeness rates**. Document formula in-code:
  weights = production_volume(0.20), num_salt_beds(0.10),
  area_per_salt_bed(0.10), registered/male/female(0.35), record_date(0.05),
  notes(0.05), barangay_id(0.15). Expose `completeness{field}` + `quality_score`.
- `/api/admin/users`: list all users with `{id,name,email,role,municipality_id,
  municipality_name,status,last_login}` + filters `role`, `status`,
  `municipality_id`. Create: role=encoder only, requires municipality_id.
  Edit: update `name`, `municipality_id`, `status` (active/inactive), optional
  `password` reset (calls `set_password`). No role escalation.
- `/api/admin/municipalities`: list municipalities with `{id,name,status,
  latitude,longitude,encoder_count,record_count}` (for filters + analytics).
- `/api/admin/insight`: placeholder returning `{insight:"…",methodology:"…",
  generated_at:<utcnow>, source:"module4.2-pending"}`. Real impl swaps later.

### B2. Encoder submit bridge + derived field
File: `app/blueprints/encoder_api.py`
- Add `PATCH /api/encoder/records/<id>/submit` (and `POST /.../<id>/submit` alias):
  set `status="pending"`, `submitted_at=datetime.utcnow()`, commit, return
  `_serialize(record)`. Guards: encoder-only, record belongs to
  `current_user.municipality_id`, `status in ("draft",)` (only drafts submit;
  if already pending/approved/rejected, 409). This is the draft→pending bridge.
- Modify `_allocate` so it **never copies `registered_producers` from input**.
  Instead compute it: in `create_record` and `update_record`, after `_allocate`,
  run `record.registered_producers = (record.male_producers or 0) +
  (record.female_producers or 0)` before commit.
- Modify `_validate`: drop the `registered_producers` required check and the
  male+female vs registered mismatch (the mismatch warning was frontend-only, but
  make the backend tolerant of a `registered_producers` key being sent by
  ignoring it). Keep male/female validation.
- Ensure `_serialize` still emits `registered_producers` (= derived value).

### B3. Register blueprint
File: `app/__init__.py` — add
`from app.blueprints.admin_api import admin_api_bp` and
`app.register_blueprint(admin_api_bp, url_prefix="/api/admin")`.
(Encoder already has its prefix via constructor; admin does too.)

## Frontend tasks
### F1. Shared Login (`src/components/Login.jsx` NEW; remove EncoderLogin)
- Copy `EncoderLogin.jsx`, rename to `Login.jsx`, delete the
  `if (user.role !== 'encoder')` hard reject.
- After success: `onLogin(user)` then `navigate(user.role === "admin" ? "/admin" : "/encoder")`.
- Keep the "back to public dashboard" link (it exits login → public, not INTO it;
  satisfies "never linked from public dashboard").
- Update `App.jsx`: route `#/login` → `<Login onLogin={setUser}>`; route
  `#/encoder/login` → redirect to `#/login`; remove `EncoderLogin` import.

### F2. Auth gates + AdminLayout
- `src/components/admin/RequireAdmin.jsx` (mirror `RequireAuth`): calls
  `getAdminMe()` (`/api/admin/me`); on null/failure → redirect `#/login`; while
  loading → spinner.
- `src/components/admin/AdminLayout.jsx` (mirror `EncoderLayout`): ocean navbar,
  nav **Dashboard / Validation / Users / Data Quality / Municipalities** (muni is
  stubbed link), user name/role on right, Logout. `<Outlet context={{user}} />`.
- `src/components/admin/` directory for the new screens.

### F3. Admin API client (`src/services/dataService.js`)
Add:
```
getAdminMe()         -> GET /api/admin/me
getMunicipalities()  -> GET /api/admin/municipalities
getUsers(params)     -> GET /api/admin/users
createUser(payload)  -> POST /api/admin/users
updateUser(id,payload)-> PATCH /api/admin/users/:id  (status/password/name/muni)
getAdminRecords(params)-> GET /api/admin/records
getAdminRecord(id)   -> GET /api/admin/records/:id
reviewRecord(id,{status,reviewer_comment}) -> PATCH /api/admin/records/:id/review
getAdminStats(params) -> GET /api/admin/stats
getDataQuality()     -> GET /api/admin/data-quality
getInsight()         -> GET /api/admin/insight
```
Plus `submitRecord(id)` -> `PATCH /api/encoder/records/:id/submit` (encoder side,
used from RecordList/RecordForm).

### F4. Encoder form change (derived registered_producers)
File: `frontend/src/components/encoder/ProductionRecordForm.jsx`
- Remove the `registered_producers` input field.
- Remove the `producerMismatch` warning block entirely.
- Show **Registered Producers** as a read-only derived line:
  `{Number(form.male_producers) + Number(form.female_producers)}`.
- Remove `registered_producers` from `form` state + `handleChange` target names.
- (Backend already derives it; the form just no longer sends it.)
- Add a "Submit for Review" button (status draft→pending) calling
  `submitRecord(record.id)` — on the edit/new-success view.

### F5. Screens (5 real + stubs)
All in `src/components/admin/`. Reuse React-Bootstrap + Recharts + existing
`.encoder-*`/`.status-*` CSS; add a few `.admin-*` helpers to `index.css` only
where needed (palette reuse: ocean-blue primary, gold/green/red status accents).

1. **AdminDashboard** (`dashboard`): 5 KPI cards (total volume MT, total salt
   beds, registered producers, record count, **Pending Validation** count), a
   municipality filter + year + production-method filters, a production trend
   line chart, a municipality contribution bar, an efficiency
   (volume÷beds) bar, and the **insight callout** (calls `getInsight()`).
2. **UsersManagement** (`users`): filterable table (role/status/municipality),
   Activate/Deactivate toggle, Edit modal (name, municipality, password reset),
   + Add Encoder button (modal form: name/email/municipality/status).
3. **ValidationQueue** (`validation`): filterable table (municipality/status/
   barangay/q/date range), status badge per row, detail side-drawer or modal
   (reuse encoder detail-modal shape + submitter/reviewer info), Approve/Reject
   buttons (modal asking for optional reviewer comment). Approve writes
   `status=approved`; Reject writes `status=rejected`. No "Return".
4. **DataQualityDashboard** (`data-quality`): per-municipality quality score
   cards + completeness bar chart (one series per field), overall province
   completeness, a "data issues" table (lowest-scoring municipalities).
5. **Stubs** (`municipalities`, `trends`, `comparison`, `supply-demand`,
   `forecast`, `forecast/insights`, `reports`, `reports/preview`): simple
   placeholders with a Card reading "Coming soon — <feature>" + a link back to
   dashboard. Routed but not wired to data. One shared `ComingSoon.jsx` component.

### F6. App.jsx wiring
- Add `<Route path="/admin" element={<RequireAdmin>...<AdminLayout/>...</Route>`
  with the nested routes above.
- `RequireAdmin` uses the admin `/me` guard (not the encoder one).
- Remove `EncoderLogin` import; use shared `Login`.

## Data flow (submit → review → reflect)
1. Encoder saves draft (existing create/update) → `status="draft"`.
2. NEW: Encoder clicks "Submit for Review" → `PATCH /api/encoder/records/:id/submit`
   → `status="pending"`, `submitted_at=now()`.
3. Admin opens Validation Queue → `GET /api/admin/records?status=pending` shows it
   (cross-municipality).
4. Admin Approves/Rejects → `PATCH /api/admin/records/:id/review` sets
   `status`, `reviewed_by`, `reviewed_at`, `reviewer_comment`.
5. Encoder reloads Records table → `GET /api/encoder/records` returns updated
   `status`, `reviewer_comment`, `reviewed_at` (already in `_serialize`);
   `RecordStatusBadge` + detail modal reflect it. No encoder change beyond the
   Submit button. ✓ acceptance.

## Acceptance criteria mapping
- ✅ Single shared login, role-branching (`/login` → `/admin` or `/encoder`).
- ✅ Encoder submits draft → appears in Admin Validation Queue as `pending`.
- ✅ Admin Approve/Reject only; no "Return" in UI; encoder list reflects new status.
- ✅ No "Registered Producers" input; value computed & read-only; mismatch warning
  removed.

## Known gaps / risks (do NOT silently close)
- **Public Dashboard stays on mock data.** Approved records are not yet surfaced
  to `/public-dashboard` (it imports `frontend/src/data/municipalities.js`).
  Recommended follow-up: add `GET /api/public/approved-aggregates` (no auth) and
  swap the guest dashboard to consume it. Not built here per "note as gap."
- **Module 4.2 engine absent.** Executive Dashboard insight callout is a stub
  (`GET /api/admin/insight`) pending the real engine.
- **Migrations not committed.** `.gitignore` ignores `migrations/versions/*.py`
  and `git ls-files migrations/` is empty — the baseline + 0002 rework files are
  local-only. Required for fresh DBs; commit them.
- **`run_seed.py` missing** (README references it). Seed lives in
  `app/seed/seed_demo_data.py:seed()`; run via app context (documented in README
  today but script absent).
- **Stale React build assets.** `react_app.html` references
  `index-DbnWVnM1.js` / `index-B26GKB7-.css` which don't exist on disk; on-disk
  build (`index-DnnujTj-.js` / `index-AR5W-ZqP.css`) is untracked. Run
  `vite build` from `frontend/` and sync template refs before QA.
- **Demo credentials stale.** README lists `admin@asin.edu`/`encoder1@asin.edu`;
  seed creates `admin@pangasin.gov.ph` and `<muni>.encoder@pangasin.gov.ph`.

## Validation steps
- `python -m py_compile app/blueprints/admin_api.py` and a `flask --app run.py
  shell` import smoke test of new endpoints (use the venv at `venv/`).
- Start encoder + admin sessions; verify role guards 403 each other.
- Encoder: create draft → Submit for Review → record becomes `pending`.
- Admin: Validation Queue lists it; Approve → status `approved`,
  `reviewed_by`/`reviewed_at` set; encoder list shows Approved badge + comment.
- Admin: create encoder user; deactivate; reset password.
- Frontend: `npm run dev` (Vite, proxies `/api`→localhost:5000) and verify
  `/login`, `/admin/*`, `/encoder/*` routes + role redirects.
- Lint-style: confirm no `admin` references remain in the encoder-only guard
  except the shared login branch, and no "Return" UI anywhere.

## File inventory
New:
- `app/blueprints/admin_api.py`
- `frontend/src/components/Login.jsx`
- `frontend/src/components/admin/RequireAdmin.jsx`
- `frontend/src/components/admin/AdminLayout.jsx`
- `frontend/src/components/admin/AdminDashboard.jsx`
- `frontend/src/components/admin/UsersManagement.jsx`
- `frontend/src/components/admin/ValidationQueue.jsx`
- `frontend/src/components/admin/DataQualityDashboard.jsx`
- `frontend/src/components/admin/ComingSoon.jsx`
- (admin nav stubs routed to ComingSoon)

Modified:
- `app/__init__.py` (register admin_api blueprint)
- `app/blueprints/encoder_api.py` (submit bridge + derived registered_producers)
- `app/blueprints/encoder_api.py` `/submit` route
- `frontend/src/App.jsx` (shared login + admin routes)
- `frontend/src/services/dataService.js` (admin + submit client fns)
- `frontend/src/components/encoder/ProductionRecordForm.jsx` (derived field + Submit button)
- `frontend/src/index.css` (minimal `.admin-*` helpers)
- `app/templates/react_app.html` (if rebuilt; sync asset hashes)

Deleted (cleanup):
- `frontend/src/components/encoder/EncoderLogin.jsx`
