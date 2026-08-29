from flask import Blueprint, render_template

public_dashboard_react_bp = Blueprint("public_dashboard_react", __name__)


@public_dashboard_react_bp.route("/public-dashboard")
def dashboard():
    return render_template("react_app.html")
