# WHAT: Small route and role smoke check for Stage A.
# WHY: Catches a missing blueprint registration or a role guard regression
#      without touching the development database.
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models.user import User

PAGES = [
    "/",
    "/login",
    "/admin",
    "/admin/system/accounts",
    "/admin/system/activity",
    "/admin/settings/system/accounts",
    "/admin/settings/system/activity",
]


def _login(client, email, password):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )


def main():
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()

    class Config:
        TESTING = True
        SECRET_KEY = "smoke-secret"
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{tmp.name}"
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        RATE_LIMIT_ENABLED = False
        WTF_CSRF_ENABLED = False

    app = create_app(Config)
    failures = []

    with app.app_context():
        db.create_all()
        for role in ("admin", "encoder", "superadmin"):
            user = User(
                name=f"Smoke {role}",
                email=f"{role}@smoke.test",
                role=role,
                status="active",
            )
            user.set_password("smokepass")
            db.session.add(user)
        db.session.commit()
        superadmin_id = User.query.filter_by(role="superadmin").one().id

    for path in PAGES:
        response = app.test_client().get(path)
        if response.status_code != 200:
            failures.append(f"page {path} -> {response.status_code}")

    anonymous = app.test_client()
    for path in ("/api/admin/stats", "/api/superadmin/users"):
        response = anonymous.get(path)
        if response.status_code != 401:
            failures.append(f"anonymous {path} -> {response.status_code}, expected 401")

    admin = app.test_client()
    _login(admin, "admin@smoke.test", "smokepass")
    expected = {
        ("GET", "/api/admin/stats"): 200,
        ("GET", "/api/superadmin/users"): 403,
        ("GET", f"/api/admin/users/{superadmin_id}"): 404,
        ("PATCH", f"/api/admin/users/{superadmin_id}"): 404,
        ("POST", f"/api/superadmin/users/{superadmin_id}/reset-password"): 403,
    }
    for (method, path), status in expected.items():
        response = admin.open(path, method=method, json={"status": "inactive"})
        if response.status_code != status:
            failures.append(
                f"admin {method} {path} -> {response.status_code}, expected {status}"
            )
    listed = admin.get("/api/admin/users").get_json().get("users", [])
    if any(user["role"] == "superadmin" for user in listed):
        failures.append("admin user list leaked a superadmin")
    if admin.get("/api/admin/users?role=superadmin").get_json().get("users"):
        failures.append("admin superadmin role filter returned rows")

    encoder = app.test_client()
    _login(encoder, "encoder@smoke.test", "smokepass")
    for path in ("/api/admin/stats", "/api/superadmin/users"):
        response = encoder.get(path)
        if response.status_code != 403:
            failures.append(f"encoder {path} -> {response.status_code}, expected 403")

    superadmin = app.test_client()
    _login(superadmin, "superadmin@smoke.test", "smokepass")
    for path in (
        "/api/admin/stats",
        "/api/superadmin/users",
        "/api/superadmin/audit-log",
        "/api/superadmin/login-events",
    ):
        response = superadmin.get(path)
        if response.status_code != 200:
            failures.append(
                f"superadmin {path} -> {response.status_code}, expected 200"
            )

    with app.app_context():
        db.session.remove()
        db.drop_all()

    try:
        os.unlink(tmp.name)
    except OSError:
        pass

    if failures:
        print("SMOKE FAILED")
        for failure in failures:
            print(f" - {failure}")
        raise SystemExit(1)

    print(f"SMOKE OK: {len(PAGES)} pages, anonymous/admin/encoder/superadmin guards")


if __name__ == "__main__":
    main()
