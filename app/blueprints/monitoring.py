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
  <title>PangAsin</title>
  <link rel="icon" type="image/png" href="/static/brand/asin_center_logo.png">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { min-height: 100vh; margin: 0; }
    .brand-logo { width: min(180px, 32vw); height: min(180px, 32vw); object-fit: contain; animation: logo-breathe 2.4s ease-in-out infinite; }
    @keyframes logo-breathe { 0%, 100% { transform: scale(0.94); } 50% { transform: scale(1.06); } }
    @media (prefers-reduced-motion: reduce) { .brand-logo { animation: none; } }
  </style>
</head>
<body class="landing-splash text-center d-flex flex-column justify-content-center align-items-center" style="min-height:100vh;">
  <img class="brand-logo" src="/static/brand/asin_center_logo.png" alt="ASIN Center logo">
  <script>
    setTimeout(function(){ window.location.href = "/public-dashboard"; }, 3000);
  </script>
</body>
</html>"""


@monitoring_bp.route("/")
def landing():
    return _LANDING_HTML, 200, {"Content-Type": "text/html; charset=utf-8"}
