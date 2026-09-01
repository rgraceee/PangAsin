from flask import Blueprint, render_template

monitoring_bp = Blueprint("monitoring", __name__)


@monitoring_bp.route("/")
def landing():
    return render_template("public/landing.html")
