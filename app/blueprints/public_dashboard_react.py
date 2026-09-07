import os
from flask import Blueprint, Flask, redirect, url_for, send_from_directory

public_dashboard_react_bp = Blueprint("public_dashboard_react", __name__)

REACT_BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "react")


def _serve_react():
    return send_from_directory(REACT_BUILD_DIR, "index.html")


@public_dashboard_react_bp.route("/")
@public_dashboard_react_bp.route("/admin")
@public_dashboard_react_bp.route("/encoder")
@public_dashboard_react_bp.route("/login")
@public_dashboard_react_bp.route("/public-dashboard")
def dashboard():
    return _serve_react()


@public_dashboard_react_bp.route("/", defaults={"path": ""})
@public_dashboard_react_bp.route("/<path:path>")
def catch_all(path):
    if path.startswith("api/") or path == "api":
        return redirect(url_for("public_dashboard_react.dashboard"))
    if path:
        file_path = os.path.join(REACT_BUILD_DIR, path)
        if os.path.isfile(file_path):
            return send_from_directory(REACT_BUILD_DIR, path)
    return _serve_react()

