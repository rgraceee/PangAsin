# WHAT: Serve ang landing page.
# WHY: Simpleng entry point para sa una mong makita.
#
# NOTE: The landing HTML is inlined here instead of using
#       render_template("public/landing.html"). Vercel's Python function bundle
#       includes imported .py modules, but it does NOT bundle nested data files
#       such as app/templates/public/landing.html (includeFiles globs do not
#       recurse, so the file is missing on the serverless function and
#       render_template() raises TemplateNotFound -> 500). Embedding the HTML
#       keeps the landing page returning 200 and redirecting to the dashboard.
from flask import Blueprint

monitoring_bp = Blueprint("monitoring", __name__)

_LANDING_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PangAsin - Loading</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="text-center d-flex flex-column justify-content-center align-items-center" style="min-height:100vh;">
  <div class="mb-4">
    <div class="display-4 fw-bold">PangAsin</div>
  </div>
  <p class="lead text-muted">Loading application...</p>
  <script>
    setTimeout(function(){ window.location.href = "/public-dashboard"; }, 3000);
  </script>
</body>
</html>"""


@monitoring_bp.route("/")
def landing():
    return _LANDING_HTML, 200, {"Content-Type": "text/html; charset=utf-8"}
