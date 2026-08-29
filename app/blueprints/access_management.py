from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.forms.user import UserForm
from app.models.user import User
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality
from app.extensions import db
from app.services.insight_engine import get_insights

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


@admin_access_bp.route("/admin/dashboard")
@login_required
def dashboard():
    approved = ProductionRecord.query.filter_by(status="approved").all()
    total_production = sum(float(r.production_volume) for r in approved)
    total_salt_beds = sum(int(r.num_salt_beds) for r in approved if r.num_salt_beds)
    production_area = sum(float(r.production_area) for r in approved if r.production_area)
    active_municipalities = db.session.query(ProductionRecord.municipality_id).filter_by(status="approved").distinct().count()
    pending_validation = ProductionRecord.query.filter_by(status="pending").count()
    from app.models.forecast_run import ForecastRun
    forecast_availability = "Yes" if ForecastRun.query.count() > 0 else "No"

    from app.services.data_quality_metrics import compute_all
    metrics = compute_all()
    scores = [m["completeness_pct"] for m in metrics if m["completeness_pct"] > 0]
    data_quality_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    insights = get_insights()

    trend_labels = []
    trend_data = []
    monthly_totals = {}
    for r in approved:
        key = r.record_date.strftime("%Y-%m") if hasattr(r.record_date, 'strftime') else str(r.record_date)
        monthly_totals[key] = monthly_totals.get(key, 0) + float(r.production_volume)
    for k in sorted(monthly_totals.keys()):
        trend_labels.append(k)
        trend_data.append(round(monthly_totals[k], 2))

    municipality_labels = []
    municipality_data = []
    muni_totals = {}
    for r in approved:
        muni_totals[r.municipality_id] = muni_totals.get(r.municipality_id, 0) + float(r.production_volume)
    for mid, total in sorted(muni_totals.items(), key=lambda x: x[1], reverse=True):
        m = Municipality.query.get(mid)
        if m:
            municipality_labels.append(m.name)
            municipality_data.append(round(total, 2))

    return render_template(
        "admin/dashboard.html",
        total_production=total_production,
        total_salt_beds=total_salt_beds,
        production_area=production_area,
        active_municipalities=active_municipalities,
        pending_validation=pending_validation,
        forecast_availability=forecast_availability,
        data_quality_score=data_quality_score,
        insights=insights,
        trend_labels=trend_labels,
        trend_data=trend_data,
        municipality_labels=municipality_labels,
        municipality_data=municipality_data,
    )


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
        if form.role.data == "encoder" and not form.municipality_id.data:
            flash("Municipality is required for encoders.", "danger")
            return render_template("admin/user_form.html", form=form, title="New User")
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
        if form.role.data == "encoder" and not form.municipality_id.data:
            flash("Municipality is required for encoders.", "danger")
            return render_template("admin/user_form.html", form=form, title="Edit User", user=user)
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
