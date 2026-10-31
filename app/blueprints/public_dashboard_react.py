# WHAT: I-serve ang pre-built React bundle (app/static/react) at ang SPA routes.
# WHY: Ang frontend ay naka-build na; ito ang naghahatid ng index.html at assets.
import os
from flask import Blueprint, redirect, url_for, send_from_directory

public_dashboard_react_bp = Blueprint("public_dashboard_react", __name__)

REACT_BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "react")


def _serve_react():
    return send_from_directory(REACT_BUILD_DIR, "index.html")


# WHAT: `/` belongs to monitoring_bp (the branded splash), so this blueprint
#       only owns the SPA entry points. Registering `/` here too made routing
#       depend on blueprint registration order.
@public_dashboard_react_bp.route("/admin")
@public_dashboard_react_bp.route("/encoder")
@public_dashboard_react_bp.route("/login")
@public_dashboard_react_bp.route("/forgot-password")
@public_dashboard_react_bp.route("/reset-password")
@public_dashboard_react_bp.route("/public-dashboard")
def dashboard():
    return _serve_react()


@public_dashboard_react_bp.route("/<path:path>")
def catch_all(path):
    if path.startswith("api/") or path == "api":
        return redirect(url_for("public_dashboard_react.dashboard"))
    if path:
        file_path = os.path.join(REACT_BUILD_DIR, path)
        if os.path.isfile(file_path):
            response = send_from_directory(REACT_BUILD_DIR, path)
            response.headers["Access-Control-Allow-Origin"] = "*"
            return response
    response = _serve_react()
    return response


@public_dashboard_react_bp.after_request
def _add_cors_headers(response):
    """Vite adds `crossorigin` to module scripts in production builds. Browsers
    require Access-Control-Allow-Origin for cross-origin (CORS) script requests,
    even same-origin when the crossorigin attribute is present. Without it the
    JS bundle is blocked and the page shows a white screen."""
    response.headers.setdefault("Access-Control-Allow-Origin", "*")
    return response

