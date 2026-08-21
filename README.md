# PangAsin

Salt production monitoring, forecasting, and decision support system for the ASIN Center (Pangasinan State University, DOST NICER Program).

## Setup

1. Clone the repository and navigate to the project directory:
   ```bash
   cd pangasin
   ```

2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` and configure your database URL:
   ```bash
   copy .env.example .env
   ```

4. Initialize the database:
   ```bash
   set FLASK_APP=run.py
   flask db init
   flask db migrate -m "initial migration"
   flask db upgrade
   ```

5. Seed the database with municipalities and demo data:
   ```bash
   python run_seed.py
   ```

6. Run the application:
   ```bash
   flask run
   ```

7. Open http://localhost:5000 in your browser.

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Administrator | admin@asin.edu | admin123 |
| Encoder (Alaminos) | encoder1@asin.edu | encoder123 |
| Encoder (Bolinao) | encoder2@asin.edu | encoder123 |

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
│   ├── templates/
│   ├── static/
│   └── seed/
├── migrations/
├── requirements.txt
├── .env.example
└── run.py
```

## Notes

- This is a skeleton phase — no custom styling, no trained forecasting model, and no real municipal data yet.
- Default Bootstrap components are used throughout (via CDN).
- Chart.js and Leaflet.js are included via CDN for charts and maps.
- PostgreSQL is the target database. For local development without PostgreSQL, the app falls back to SQLite.
