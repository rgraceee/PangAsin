import io
import json
from datetime import date

from app.extensions import db
from app.models.user import User
from app.models.production_record import ProductionRecord
from app.models.municipality import Municipality
from app.models.barangay import Barangay
from app.models.site_content import SiteContent
from app.models.system_setting import SystemSetting
from app.models.audit_log import AuditLog
from tests.conftest import create_encoder


def _create_user(role, email, password="pass1234", status="active", municipality_id=None):
    user = User(name=f"Test {role}", email=email, role=role, status=status, municipality_id=municipality_id)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return user


def _login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def _superadmin_client(app):
    _create_user("superadmin", "superadmin@example.com")
    client = app.test_client()
    assert _login(client, "superadmin@example.com", "pass1234").status_code == 200
    return client


def _admin_client(app):
    client = app.test_client()
    assert _login(client, "admin@example.com", "adminpass").status_code == 200
    return client


def _make_record(app):
    with app.app_context():
        muni = Municipality(name="Test Municipality", latitude=14.0, longitude=120.0, status="active")
        db.session.add(muni)
        db.session.flush()
        brgy = Barangay(name="Test Barangay", municipality_id=muni.id)
        db.session.add(brgy)
        db.session.flush()
        rec = ProductionRecord(
            municipality_id=muni.id, barangay_id=brgy.id, record_date=date(2026, 1, 15),
            production_volume_mt=10.0, num_salt_beds=1, production_method="solar",
            status="approved", submitted_by=1,
        )
        db.session.add(rec)
        db.session.commit()
        return rec.id


# ---------------------------------------------------------------- guards ----

def test_superadmin_endpoints_403_for_admin_and_encoder(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "superadmin@example.com")
    create_encoder(email="enc@example.com", password="pass1234")

    enc = app.test_client()
    assert _login(enc, "enc@example.com", "pass1234").status_code == 200

    # SuperAdmin-only endpoints must refuse admin and encoder.
    for path in [
        "/api/superadmin/users",
        "/api/superadmin/audit-log",
        "/api/superadmin/export/records",
        "/api/settings",
    ]:
        assert admin_client.get(path).status_code == 403, f"admin {path}"
        assert enc.get(path).status_code == 403, f"encoder {path}"

    # Privacy GET stays public; PUT is superadmin-only.
    assert admin_client.get("/api/content/privacy").status_code == 200
    r = admin_client.put("/api/content/privacy", json={"title": "x"})
    assert r.status_code == 403
    r = enc.put("/api/content/privacy", json={"title": "x"})
    assert r.status_code == 403


def test_superadmin_can_read_own_endpoints(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    sa = _superadmin_client(app)
    assert sa.get("/api/superadmin/users").status_code == 200
    assert sa.get("/api/superadmin/audit-log").status_code == 200
    assert sa.get("/api/settings").status_code == 200
    assert sa.get("/api/content/privacy").status_code == 200
    assert sa.get("/api/announcement").status_code == 200


# ---------------------------------------------------------- light admin mgmt -

def test_admin_user_management_encoders_only(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    create_encoder(email="enc@example.com", password="pass1234")

    data = admin_client.get("/api/admin/users").get_json()["users"]
    roles = {u["role"] for u in data}
    assert "superadmin" not in roles
    assert "admin" not in roles
    assert any(u["email"] == "enc@example.com" for u in data)


# --------------------------------------------------------- audit log API ----

def test_audit_log_api_superadmin_only(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    assert admin_client.get("/api/superadmin/audit-log").status_code == 403

    sa = _superadmin_client(app)
    assert sa.get("/api/superadmin/audit-log").status_code == 200


# --------------------------------------------------------- soft-delete -----

def test_soft_deleted_record_vanishes_everywhere(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    rec_id = _make_record(app)
    _create_user("superadmin", "sa@example.com")
    _create_user("admin", "admin2@example.com")
    create_encoder(email="enc@example.com", password="pass1234", municipality_id=1)

    sa = _superadmin_client(app)
    assert sa.post(f"/api/superadmin/records/{rec_id}/soft-delete", json={"reason": "duplicate entry, please remove"}).status_code == 200

    # vanishes from admin records API
    assert admin_client.get("/api/admin/records").get_json()["records"] == []
    # vanishes from public API
    assert app.test_client().get("/api/public/dashboard").status_code == 200
    # audit row written
    assert AuditLog.query.filter_by(action="superadmin.record.soft_delete").count() == 1

    # restore brings it back
    assert sa.post(f"/api/superadmin/records/{rec_id}/restore").status_code == 200
    assert len(admin_client.get("/api/admin/records").get_json()["records"]) == 1


def test_soft_delete_requires_long_reason(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    rec_id = _make_record(app)
    _create_user("superadmin", "sa@example.com")

    sa = _superadmin_client(app)
    r = sa.post(f"/api/superadmin/records/{rec_id}/soft-delete", json={"reason": "short"})
    assert r.status_code == 400


# ------------------------------------------------------- content settings ----

def test_content_put_superadmin_only(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    assert admin_client.put("/api/content/privacy", json={"title": "x"}).status_code == 403

    sa = _superadmin_client(app)
    r = sa.put("/api/content/privacy", json={"title": "Privacy Policy", "last_updated": "1 November 2026", "sections": []})
    assert r.status_code == 200
    assert r.get_json()["title"] == "Privacy Policy"

    # validation: missing title
    r2 = sa.put("/api/content/privacy", json={"title": ""})
    assert r2.status_code == 400


def test_content_missing_key_returns_default(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    sa = _superadmin_client(app)
    data = sa.get("/api/content/privacy").get_json()
    assert data["title"] == "Privacy Policy"
    assert data["last_updated"] == "30 October 2026"


def test_settings_read_and_validation(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    sa = _superadmin_client(app)

    r = sa.get("/api/settings").get_json()
    keys = set(r.keys())
    assert "min_password_length" in keys
    mp = r["min_password_length"]
    assert mp["value"] == 6

    # validation: too small
    rr = sa.put("/api/settings/min_password_length", json={"value": 1})
    assert rr.status_code == 400

    # valid change persisted and audited
    assert sa.put("/api/settings/min_password_length", json={"value": 8}).status_code == 200
    mp2 = r["min_password_length"] if False else sa.get("/api/settings").get_json()["min_password_length"]
    assert mp2["value"] == 8
    assert AuditLog.query.filter_by(action="superadmin.setting.update").count() >= 1


def test_csv_export_no_password_hashes(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    _create_user("admin", "admin2@example.com")
    create_encoder(email="enc@example.com", password="pass1234")

    sa = _superadmin_client(app)
    r = sa.get("/api/superadmin/export/records")
    assert r.status_code == 200
    text = r.data.decode("utf-8")
    assert "password" not in text.lower()
    assert "hash" not in text.lower()
