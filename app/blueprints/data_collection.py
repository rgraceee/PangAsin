from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.forms.production import ProductionRecordForm
from app.forms.upload import UploadForm
from app.models.production_record import ProductionRecord
from app.extensions import db
from datetime import datetime

encoder_bp = Blueprint("encoder", __name__)


def encoder_required():
    if not current_user.is_authenticated or current_user.role != "encoder":
        flash("Encoder access required.", "danger")
        return False
    return True


@encoder_bp.before_request
def require_encoder():
    if not encoder_required():
        return redirect(url_for("monitoring.landing"))


@encoder_bp.route("/encoder/home")
@login_required
def home():
    records = ProductionRecord.query.filter_by(submitted_by=current_user.id).order_by(ProductionRecord.created_at.desc()).all()
    pending = sum(1 for r in records if r.status == "pending")
    approved = sum(1 for r in records if r.status == "approved")
    rejected = sum(1 for r in records if r.status in ("rejected", "returned"))
    return render_template("encoder/home.html", records=records, pending=pending, approved=approved, rejected=rejected)


@encoder_bp.route("/encoder/submit", methods=["GET", "POST"])
@login_required
def submit():
    form = ProductionRecordForm()
    if form.validate_on_submit():
        is_draft = form.save_draft.data and not form.submit.data
        record = ProductionRecord(
            municipality_id=current_user.municipality_id,
            submitted_by=current_user.id,
            period_type=form.period_type.data,
            record_date=form.record_date.data,
            barangay=form.barangay.data,
            production_volume=form.production_volume.data,
            production_method=form.production_method.data,
            production_area=form.production_area.data,
            num_salt_beds=form.num_salt_beds.data,
            producer_age=form.producer_age.data,
            producer_gender=form.producer_gender.data,
            status="draft" if is_draft else "pending",
            submitted_at=datetime.utcnow() if not is_draft else None,
        )
        db.session.add(record)
        db.session.commit()
        flash("Record saved." if is_draft else "Record submitted for validation.", "success")
        return redirect(url_for("encoder.home"))
    return render_template("encoder/submit_form.html", form=form, title="Submit Record")


@encoder_bp.route("/encoder/records/<int:id>/edit", methods=["GET", "POST"])
@login_required
def edit_record(id):
    record = ProductionRecord.query.get_or_404(id)
    if record.submitted_by != current_user.id or record.status not in ("rejected", "returned"):
        flash("You cannot edit this record.", "danger")
        return redirect(url_for("encoder.submissions"))
    form = ProductionRecordForm(obj=record)
    if form.validate_on_submit():
        record.period_type = form.period_type.data
        record.record_date = form.record_date.data
        record.barangay = form.barangay.data
        record.production_volume = form.production_volume.data
        record.production_method = form.production_method.data
        record.production_area = form.production_area.data
        record.num_salt_beds = form.num_salt_beds.data
        record.producer_age = form.producer_age.data
        record.producer_gender = form.producer_gender.data
        record.status = "pending"
        record.submitted_at = datetime.utcnow()
        record.reviewer_comment = None
        record.reviewed_by = None
        record.reviewed_at = None
        db.session.commit()
        flash("Record resubmitted for validation.", "success")
        return redirect(url_for("encoder.submissions"))
    return render_template("encoder/submit_form.html", form=form, title="Edit Record", record=record)


@encoder_bp.route("/encoder/submissions")
@login_required
def submissions():
    status_filter = request.args.get("status")
    query = ProductionRecord.query.filter_by(submitted_by=current_user.id)
    if status_filter:
        query = query.filter_by(status=status_filter)
    records = query.order_by(ProductionRecord.created_at.desc()).all()
    return render_template("encoder/submissions.html", records=records, status_filter=status_filter)


@encoder_bp.route("/encoder/upload", methods=["GET", "POST"])
@login_required
def upload():
    form = UploadForm()
    if form.validate_on_submit():
        flash("Upload preview would be shown here in a full implementation.", "info")
        return redirect(url_for("encoder.home"))
    return render_template("encoder/upload.html", form=form)
