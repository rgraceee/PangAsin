from flask import Blueprint, render_template

public_mock_dashboard_bp = Blueprint("public_mock_dashboard", __name__)


@public_mock_dashboard_bp.route("/public-dashboard")
def dashboard():
    return render_template("public/dashboard.html")
