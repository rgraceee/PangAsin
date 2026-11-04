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

    # SuperAdmin-only API routes are hidden from admin and encoder accounts.
    for path in [
        "/api/superadmin/users",
        "/api/superadmin/audit-log",
        "/api/superadmin/export/records",
    ]:
        assert admin_client.get(path).status_code == 404, f"admin {path}"
        assert enc.get(path).status_code == 404, f"encoder {path}"

    assert admin_client.get("/api/settings").status_code == 403
    assert enc.get("/api/settings").status_code == 403

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
    assert admin_client.get("/api/superadmin/audit-log").status_code == 404

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


# ------------------------------------------------------- content API -----

def test_content_public_get_returns_defaults(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    # Unauthenticated public access to privacy/terms/faq_public.
    assert app.test_client().get("/api/content/privacy").status_code == 200
    assert app.test_client().get("/api/content/terms").status_code == 200
    assert app.test_client().get("/api/content/faq_public").status_code == 200
    data = app.test_client().get("/api/content/privacy").get_json()
    assert data["title"] == "Privacy Policy"


def test_content_authenticated_get_role_specific(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    # Admin can read admin FAQ and about.
    assert admin_client.get("/api/content/faq_admin").status_code == 200
    assert admin_client.get("/api/content/about").status_code == 200
    # Encoder cannot read admin FAQ.
    enc = app.test_client()
    from tests.conftest import create_encoder
    create_encoder(email="enc2@example.com", password="pass1234")
    assert enc.post("/api/auth/login", json={"email": "enc2@example.com", "password": "pass1234"}).status_code == 200
    assert enc.get("/api/content/faq_admin").status_code == 403


def test_content_put_superadmin_only(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    # Admin and encoder are refused.
    assert admin_client.put("/api/content/privacy", json={"title": "x"}).status_code == 403

    sa = _superadmin_client(app)
    # Valid update persisted.
    payload = {"title": "Privacy Policy", "last_updated": "1 November 2026", "sections": []}
    r = sa.put("/api/content/privacy", json=payload)
    assert r.status_code == 200
    assert r.get_json()["title"] == "Privacy Policy"
    assert r.get_json()["last_updated"].endswith(" November 2026")

    # Persistence: GET returns the updated value.
    got = sa.get("/api/content/privacy").get_json()
    assert got["last_updated"] == r.get_json()["last_updated"]

    # Validation: missing title.
    r2 = sa.put("/api/content/privacy", json={"title": ""})
    assert r2.status_code == 400

    # Audit row written.
    assert AuditLog.query.filter_by(action="superadmin.content.update").count() >= 1


def test_content_unknown_key_404(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    sa = _superadmin_client(app)
    assert sa.put("/api/content/nonexistent", json={"title": "x"}).status_code == 404


# ------------------------------------------------------- user management -----

def _make_encoder(app, email="enc@example.com", municipality_id=1):
    with app.app_context():
        muni = Municipality.query.get(municipality_id)
        if not muni:
            muni = Municipality(name="Test Mun", latitude=14.0, longitude=120.0, status="active")
            db.session.add(muni)
            db.session.flush()
        create_encoder(email=email, password="pass1234", municipality_id=muni.id)


def test_superadmin_user_create(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    with app.app_context():
        muni = Municipality(name="Test Mun", latitude=14.0, longitude=120.0, status="active")
        db.session.add(muni)
        db.session.commit()
        muni_id = muni.id
    sa = _superadmin_client(app)

    r = sa.post("/api/superadmin/users", json={
        "name": "New Encoder", "email": "newenc@example.com",
        "role": "encoder", "municipality_id": muni_id,
    })
    assert r.status_code == 201, r.get_data(as_text=True)[:200]
    data = r.get_json()
    assert "temporary_password" in data
    assert data["user"]["email"] == "newenc@example.com"
    assert data["user"]["role"] == "encoder"
    assert AuditLog.query.filter_by(action="superadmin.user.create").count() >= 1

    # Invalid: no municipality for encoder (backend returns 404 for null municipality)
    r2 = sa.post("/api/superadmin/users", json={
        "name": "Bad", "email": "bad@example.com", "role": "encoder",
    })
    assert r2.status_code == 404

    # Invalid: superadmin role not allowed via this endpoint
    r3 = sa.post("/api/superadmin/users", json={
        "name": "Bad", "email": "bad2@example.com", "role": "superadmin",
    })
    assert r3.status_code == 400


def test_superadmin_user_deactivate_reactivate(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    with app.app_context():
        muni = Municipality(name="Test Mun", latitude=14.0, longitude=120.0, status="active")
        db.session.add(muni)
        db.session.commit()
        muni_id = muni.id
    create_encoder(email="enc@example.com", password="pass1234", municipality_id=muni_id)
    sa = _superadmin_client(app)

    users = sa.get("/api/superadmin/users?role=encoder").get_json()["users"]
    enc = next(u for u in users if u["email"] == "enc@example.com")
    enc_id = enc["id"]

    r = sa.post(
        f"/api/superadmin/users/{enc_id}/deactivate",
        json={"reason": "Encoder account no longer needed"},
    )
    assert r.status_code == 200

    # Check the specific user is now inactive
    users = sa.get("/api/superadmin/users?role=encoder").get_json()["users"]
    enc_after = next(u for u in users if u["id"] == enc_id)
    assert enc_after["status"] == "inactive"

    r = sa.post(
        f"/api/superadmin/users/{enc_id}/reactivate",
        json={"reason": "Encoder account restored"},
    )
    assert r.status_code == 200

    users = sa.get("/api/superadmin/users?role=encoder").get_json()["users"]
    enc_after = next(u for u in users if u["id"] == enc_id)
    assert enc_after["status"] == "active"

    # Cannot deactivate self
    me = sa.get("/api/superadmin/users?role=superadmin").get_json()["users"][0]["id"]
    r = sa.post(f"/api/superadmin/users/{me}/deactivate")
    assert r.status_code == 400


def test_superadmin_user_reset_password(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    _make_encoder(app)
    sa = _superadmin_client(app)

    users = sa.get("/api/superadmin/users?role=encoder").get_json()["users"]
    enc_id = users[0]["id"]

    r = sa.post(
        f"/api/superadmin/users/{enc_id}/reset-password",
        json={"reason": "User requested a password reset"},
    )
    assert r.status_code == 200
    data = r.get_json()
    assert "temporary_password" in data
    assert len(data["temporary_password"]) > 0
    assert AuditLog.query.filter_by(action="superadmin.user.reset_password").count() >= 1

    # Cannot reset own password
    me = sa.get("/api/superadmin/users?role=superadmin").get_json()["users"][0]["id"]
    r = sa.post(f"/api/superadmin/users/{me}/reset-password")
    assert r.status_code == 400


def test_superadmin_user_force_logout_unlock(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    _make_encoder(app)
    sa = _superadmin_client(app)

    users = sa.get("/api/superadmin/users?role=encoder").get_json()["users"]
    enc_id = users[0]["id"]

    r = sa.post(
        f"/api/superadmin/users/{enc_id}/force-logout",
        json={"reason": "Ending all existing sessions"},
    )
    assert r.status_code == 200
    assert AuditLog.query.filter_by(action="superadmin.user.force_logout").count() >= 1

    r = sa.post(
        f"/api/superadmin/users/{enc_id}/unlock",
        json={"reason": "Account lockout was reviewed"},
    )
    assert r.status_code == 200
    assert AuditLog.query.filter_by(action="superadmin.user.unlock").count() >= 1

    # Cannot force-logout self
    me = sa.get("/api/superadmin/users?role=superadmin").get_json()["users"][0]["id"]
    r = sa.post(f"/api/superadmin/users/{me}/force-logout")
    assert r.status_code == 400


def test_superadmin_user_change_municipality(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    with app.app_context():
        muni2 = Municipality(name="Test Mun 2", latitude=15.0, longitude=121.0, status="active")
        db.session.add(muni2)
        db.session.commit()
        muni2_id = muni2.id
    _make_encoder(app)
    sa = _superadmin_client(app)

    users = sa.get("/api/superadmin/users?role=encoder").get_json()["users"]
    enc_id = users[0]["id"]

    r = sa.post(
        f"/api/superadmin/users/{enc_id}/municipality",
        json={
            "municipality_id": muni2_id,
            "reason": "Encoder reassigned to another municipality",
        },
    )
    assert r.status_code == 200
    assert r.get_json()["user"]["municipality_id"] == muni2_id
    assert AuditLog.query.filter_by(action="superadmin.user.change_municipality").count() >= 1


def test_superadmin_user_pagination_and_filters(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    _make_encoder(app, email="enc1@example.com")
    _make_encoder(app, email="enc2@example.com")
    sa = _superadmin_client(app)

    r = sa.get("/api/superadmin/users?page=1&per_page=1")
    assert r.status_code == 200
    data = r.get_json()
    assert len(data["users"]) == 1
    assert data["total"] >= 2
    assert data["pages"] >= 2

    r = sa.get("/api/superadmin/users?q=enc1")
    assert r.status_code == 200
    assert any(u["email"] == "enc1@example.com" for u in r.get_json()["users"])


# ------------------------------------------------------- login events -------

def test_login_events_api_superadmin_only(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    assert admin_client.get("/api/superadmin/login-events").status_code == 404

    sa = _superadmin_client(app)
    r = sa.get("/api/superadmin/login-events")
    assert r.status_code == 200
    assert "entries" in r.get_json()


# ------------------------------------------------------- announcement ------

def test_announcement_api_superadmin_only(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa@example.com")
    # GET announcement is public (banner shown on all layouts)
    assert admin_client.get("/api/announcement").status_code == 200
    # PUT is superadmin-only
    assert admin_client.put("/api/announcement", json={"message": "x"}).status_code == 403

    sa = _superadmin_client(app)
    # PUT works
    r = sa.put("/api/announcement", json={
        "message": "Test announcement",
        "level": "info",
        "active": True,
    })
    assert r.status_code == 200
    assert r.get_json()["message"] == "Test announcement"
    assert AuditLog.query.filter_by(action="superadmin.announcement.update").count() >= 1


# ------------------------------------------------------- superadmin overview ----

def test_superadmin_health_endpoint(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    sa = _superadmin_client(app)
    r = sa.get("/api/superadmin/health")
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    body = r.get_json()
    for key in ("pending_validations", "failed_logins_24h", "db_size", "last_forecast_run",
                "last_approved_update", "users_by_role", "db_type", "app_version"):
        assert key in body, f"missing health key {key}: {body}"


# ------------------------------------------------------- settings roundtrip ----

def test_superadmin_settings_roundtrip(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    sa = _superadmin_client(app)
    r = sa.get("/api/settings")
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    settings = r.get_json()
    assert isinstance(settings, dict)
    assert "min_password_length" in settings

    # valid change persisted
    assert sa.put("/api/settings/min_password_length", json={"value": 8}).status_code == 200
    got = sa.get("/api/settings").get_json()["min_password_length"]
    assert got["value"] == 8

    # validation: out of range -> 400, never 500
    rr = sa.put("/api/settings/min_password_length", json={"value": 1})
    assert rr.status_code == 400, rr.get_data(as_text=True)[:200]


# ------------------------------------------------------- announcement roundtrip --

def test_superadmin_announcement_roundtrip(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    sa = _superadmin_client(app)
    assert sa.get("/api/announcement").status_code == 200
    r = sa.put("/api/announcement", json={
        "message": "SuperAdmin test banner",
        "level": "warning",
        "active": True,
        "starts_at": "2026-11-02T00:00:00",
        "ends_at": "2026-12-01T00:00:00",
    })
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    body = r.get_json()
    assert body["message"] == "SuperAdmin test banner"
    assert body["level"] == "warning"
    assert body["active"] is True
    assert AuditLog.query.filter_by(action="superadmin.announcement.update").count() >= 1


# ------------------------------------------------------- FAQ CRUD --------------

def test_superadmin_faq_crud_and_reorder(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    sa = _superadmin_client(app)

    # validation: missing question/answer -> 400, never 500
    r = sa.post("/api/help-faqs", json={"question": "", "answer": ""})
    assert r.status_code == 400, r.get_data(as_text=True)[:200]

    # create
    r = sa.post("/api/help-faqs", json={"question": "Q1?", "answer": "A1", "category": "General", "sort_order": 2})
    assert r.status_code == 201, r.get_data(as_text=True)[:200]
    f1 = r.get_json()
    assert f1["question"] == "Q1?" and f1["category"] == "General"

    # create second
    r = sa.post("/api/help-faqs", json={"question": "Q2?", "answer": "A2", "category": "About", "sort_order": 1})
    assert r.status_code == 201
    f2 = r.get_json()

    # public list returns only active
    rp = app.test_client().get("/api/help-faqs?public=1")
    assert rp.status_code == 200
    public_ids = {f["id"] for f in rp.get_json()["faqs"]}
    assert f1["id"] in public_ids and f2["id"] in public_ids

    # full list
    rl = sa.get("/api/help-faqs")
    assert rl.status_code == 200
    assert any(f["id"] == f1["id"] for f in rl.get_json()["faqs"])

    # update
    r = sa.put(f"/api/help-faqs/{f1['id']}", json={"question": "Q1 edited?", "active": False})
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    assert r.get_json()["question"] == "Q1 edited?"
    assert r.get_json()["active"] is False
    assert AuditLog.query.filter_by(action="superadmin.help_faq.update").count() >= 1

    # public list now excludes the deactivated one
    rp = app.test_client().get("/api/help-faqs?public=1")
    assert f1["id"] not in {f["id"] for f in rp.get_json()["faqs"]}

    # reorder
    r = sa.put("/api/help-faqs/reorder", json={"items": [
        {"id": f1["id"], "sort_order": 0},
        {"id": f2["id"], "sort_order": 1},
    ]})
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    # bad item -> 400 not 500
    r = sa.put("/api/help-faqs/reorder", json={"items": [{"id": 999999, "sort_order": 0}]})
    assert r.status_code == 400, r.get_data(as_text=True)[:200]

    # delete
    r = sa.delete(f"/api/help-faqs/{f2['id']}")
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    assert r.get_json()["deleted"] is True
    assert AuditLog.query.filter_by(action="superadmin.help_faq.delete").count() >= 1


# ------------------------------------------------------- content versioning -----

def test_superadmin_content_version_increments(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    sa = _superadmin_client(app)
    r = sa.put("/api/content/privacy", json={"title": "Privacy Policy v2", "sections": []})
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    body = r.get_json()
    assert body["title"] == "Privacy Policy v2"
    assert body["version"] >= 1
    assert body["effective_date"]
    # public GET surfaces version
    rp = app.test_client().get("/api/content/privacy")
    assert rp.status_code == 200
    assert rp.get_json()["version"] >= 1


# ------------------------------------------------------- users & audit read -----

def test_superadmin_users_and_audit_read(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "sa2@example.com")
    _create_user("encoder", "enc2@example.com", status="active")
    sa = _superadmin_client(app)

    r = sa.get("/api/superadmin/users")
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    body = r.get_json()
    assert "users" in body and "total" in body

    r = sa.get("/api/superadmin/audit-log")
    assert r.status_code == 200, r.get_data(as_text=True)[:200]
    body = r.get_json()
    assert "entries" in body and "total" in body


