from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.forms.validation import ValidationForm
from app.models.production_record import ProductionRecord
from app.extensions import db

validation_bp = Blueprint("validation", __name__)


def admin_required():
    if not current_user.is_authenticated or current_user.role != "admin":
        flash("Admin access required.", "danger")
        return False
    return True


@validation_bp.before_request
def require_admin():
    if not admin_required():
        return redirect(url_for("monitoring.landing"))


@validation_bp.route("/admin/validation")
@login_required
def validation_queue():
    status_filter = request.args.get("status", "pending")
    query = ProductionRecord.query.filter_by(status=status_filter)
    records = query.order_by(ProductionRecord.created_at.desc()).all()
    return render_template("admin/validation_queue.html", records=records, status_filter=status_filter)


@validation_bp.route("/admin/validation/<int:id>", methods=["GET", "POST"])
@login_required
def validation_detail(id):
    record = ProductionRecord.query.get_or_404(id)
    form = ValidationForm()
    if form.validate_on_submit():
        if form.approve.data:
            record.status = "approved"
            record.reviewer_comment = form.reviewer_comment.data
            record.reviewed_by = current_user.id
            record.reviewed_at = db.func.now()
            flash("Record approved.", "success")
        elif form.reject.data:
            record.status = "rejected"
            record.reviewer_comment = form.reviewer_comment.data
            record.reviewed_by = current_user.id
            record.reviewed_at = db.func.now()
            flash("Record rejected.", "warning")
        elif form.return_btn.data:
            record.status = "returned"
            record.reviewer_comment = form.reviewer_comment.data
            record.reviewed_by = current_user.id
            record.reviewed_at = db.func.now()
            flash("Record returned to encoder.", "info")
        db.session.commit()
        return redirect(url_for("validation.validation_queue"))
    return render_template("admin/validation_detail.html", record=record, form=form)
