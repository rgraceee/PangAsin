from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, current_user
from datetime import datetime
from app.forms.login import LoginForm
from app.models.user import User
from app.extensions import db

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("monitoring.landing"))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data) and user.status == "active":
            login_user(user)
            user.last_login = datetime.utcnow()
            db.session.commit()
            if user.role == "admin":
                return redirect(url_for("admin_access.dashboard"))
            if user.role == "encoder":
                return redirect(url_for("encoder.home"))
            return redirect(url_for("monitoring.landing"))
        flash("Invalid email or password, or account is inactive.", "danger")
    return render_template("auth/login.html", form=form)


@auth_bp.route("/logout")
def logout():
    logout_user()
    return redirect(url_for("monitoring.landing"))
