from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.forms.user import UserForm
from app.models.user import User
from app.extensions import db

admin_access_bp = Blueprint("admin_access", __name__)


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        flash("Admin access required.", "danger")
        return False
    return True


@admin_access_bp.before_request
def require_admin():
    if not admin_required():
        return redirect(url_for("monitoring.landing"))


from app.services.decision_support_rules import get_insights


@admin_access_bp.route("/admin/dashboard")
@login_required
def dashboard():
    insights = get_insights()
    return render_template("admin/dashboard.html", insights=insights)


@admin_access_bp.route("/admin/users")
@login_required
def users_list():
    users = User.query.order_by(User.created_at.desc()).all()
    return render_template("admin/users_list.html", users=users)


@admin_access_bp.route("/admin/users/new", methods=["GET", "POST"])
@login_required
def user_new():
    form = UserForm()
    if form.validate_on_submit():
        user = User(
            name=form.name.data,
            email=form.email.data,
            role=form.role.data,
            municipality_id=form.municipality_id.data if form.municipality_id.data != 0 else None,
            status=form.status.data,
        )
        if form.password.data:
            user.set_password(form.password.data)
        else:
            flash("Password is required for new users.", "warning")
            return render_template("admin/user_form.html", form=form, title="New User")
        db.session.add(user)
        db.session.commit()
        flash("User created successfully.", "success")
        return redirect(url_for("admin_access.users_list"))
    return render_template("admin/user_form.html", form=form, title="New User")


@admin_access_bp.route("/admin/users/<int:id>/edit", methods=["GET", "POST"])
@login_required
def user_edit(id):
    user = User.query.get_or_404(id)
    form = UserForm(obj=user)
    if form.validate_on_submit():
        user.name = form.name.data
        user.email = form.email.data
        user.role = form.role.data
        user.municipality_id = form.municipality_id.data if form.municipality_id.data != 0 else None
        user.status = form.status.data
        if form.password.data:
            user.set_password(form.password.data)
        db.session.commit()
        flash("User updated successfully.", "success")
        return redirect(url_for("admin_access.users_list"))
    return render_template("admin/user_form.html", form=form, title="Edit User", user=user)


@admin_access_bp.route("/admin/users/<int:id>/toggle-status", methods=["POST"])
@login_required
def toggle_status(id):
    user = User.query.get_or_404(id)
    user.status = "inactive" if user.status == "active" else "active"
    db.session.commit()
    flash(f"User {user.name} is now {user.status}.", "info")
    return redirect(url_for("admin_access.users_list"))
