# PangAsin

Salt production monitoring, forecasting, and decision support system for the ASIN Center (Pangasinan State University, DOST NICER Program).

The system runs as a **single Flask server** on port **5000**. Flask serves the pre-built React dashboard (in `app/static/react/`) directly, so no Vite dev server is needed to run the app.

## Setup

1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Copy `.env.example` to `.env` and configure your database URL:
   ```bash
   copy .env.example .env
   ```

3. Apply the database migrations:
   ```bash
   set FLASK_APP=run.py
   flask db upgrade
   ```

4. Seed the database with municipalities, barangays, demo users, and demo records:
   ```bash
   python -c "from app.seed.seed_demo_data import seed; seed()"
   ```

5. Start the server:
   ```bash
   python run.py
   ```
   The app runs at http://localhost:5000.

## Access the app

- **Public dashboard:** http://localhost:5000/public-dashboard
- **Encoder login:** http://localhost:5000/public-dashboard#/login
- **Admin login:** http://localhost:5000/public-dashboard#/login

## Demo Accounts

Seeded users are created with the pattern `admin@pangasin.gov.ph` for the administrator and `{municipality}.encoder@pangasin.gov.ph` for each municipality's encoder.

| Role | Email | Password |
|---|---|---|
| Administrator | admin@pangasin.gov.ph | admin123 |
| Encoder (Alaminos) | alaminos.encoder@pangasin.gov.ph | encoder123 |
| Encoder (Bolinao) | bolinao.encoder@pangasin.gov.ph | encoder123 |

## Project Structure

```
pangasin/
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── extensions.py
│   ├── models/
│   ├── forms/
│   ├── blueprints/
│   ├── services/
│   ├── seed/            # database seeding scripts
│   ├── templates/
│   ├── static/
│   │   └── react/       # production frontend build output
├── frontend/            # React dashboard source (optional; rebuild only)
├── migrations/
├── requirements.txt
├── .env.example
└── run.py
```

## Rebuilding the frontend (only after code changes)

The running app uses the pre-built bundle in `app/static/react/`. The React source lives in `frontend/`; to rebuild after changing it:

```bash
cd frontend
npm install
npm run build
```

`npm run build` outputs fresh assets to `app/static/react/`, which Flask serves automatically. No dev server is required to view the app.

## Notes

- Python 3.11+ is recommended. The frontend was built with Node 18+ if you need to rebuild it.
- The app runs on a **single server** (`python run.py`) — no Vite/Node dev server is needed to view the system.
- React frontend is pre-built in `app/static/react/` and served by Flask; Bootstrap is bundled in that build.
