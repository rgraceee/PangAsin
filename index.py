# WHAT: Vercel entrypoint. Vercel looks for a Flask instance named `app` in
#       index.py / app.py / server.py / main.py / wsgi.py at the project root.
# WHY: The app uses a factory (create_app), so expose the instance here instead
#      of renaming run.py (which local tooling already relies on).
from app import create_app

app = create_app()
