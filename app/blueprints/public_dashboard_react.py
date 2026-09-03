import os
from flask import Blueprint, Flask, redirect, url_for, send_from_directory

public_dashboard_react_bp = Blueprint("public_dashboard_react", __name__)

REACT_BUILD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "react")


@public_dashboard_react_bp.route("/public-dashboard")
def dashboard():
    return send_from_directory(REACT_BUILD_DIR, "index.html")


@public_dashboard_react_bp.route("/encoder")
def encoder_entry():
    return redirect(url_for("public_dashboard_react.dashboard") + "#/encoder/login")


@public_dashboard_react_bp.route("/login")
def login():
    return redirect(url_for("public_dashboard_react.dashboard") + "#/login")

