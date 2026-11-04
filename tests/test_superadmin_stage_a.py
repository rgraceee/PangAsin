from app.extensions import db
from app.models.login_events import LoginEvent
from app.models.user import User
from tests.conftest import create_encoder


def _create_user(role, email, password="pass1234", status="active"):
    user = User(name=f"Test {role}", email=email, role=role, status=status)
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


def test_superadmin_api_allows_only_superadmin(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "superadmin@example.com")
    superadmin_id = User.query.filter_by(role="superadmin").one().id

    assert admin_client.get("/api/superadmin/users").status_code == 404

    encoder = app.test_client()
    create_encoder(email="encoder-guard@example.com", password="pass1234")
    assert _login(encoder, "encoder-guard@example.com", "pass1234").status_code == 200
    assert encoder.get("/api/superadmin/users").status_code == 404

    superadmin = app.test_client()
    assert _login(superadmin, "superadmin@example.com", "pass1234").status_code == 200
    assert superadmin.get("/api/superadmin/users").status_code == 200
    assert superadmin.get(f"/api/admin/users/{superadmin_id}").status_code == 404


def test_five_failures_lock_account_with_generic_errors(app, client):
    app.config["RATE_LIMIT_ENABLED"] = False
    user = create_encoder(email="lockout@example.com", password="rightpass")

    for _ in range(5):
        response = _login(client, "lockout@example.com", "wrongpass")
        assert response.status_code == 401
        assert response.get_json()["error"] == "Invalid email or password."

    db.session.refresh(user)
    assert user.locked_until is not None
    assert user.is_locked()

    locked = _login(client, "lockout@example.com", "rightpass")
    assert locked.status_code == 401
    assert locked.get_json()["error"] == "Invalid email or password."

    unknown = _login(client, "missing@example.com", "whatever")
    assert unknown.status_code == 401
    assert unknown.get_json()["error"] == locked.get_json()["error"]

    attempts = LoginEvent.query.filter_by(email="lockout@example.com").all()
    assert len(attempts) == 6
    assert all(event.success is False for event in attempts)


def test_force_logout_invalidates_existing_session(app, client):
    app.config["RATE_LIMIT_ENABLED"] = False
    user = create_encoder(email="logout@example.com", password="pass1234")
    assert _login(client, "logout@example.com", "pass1234").status_code == 200
    assert client.get("/api/auth/me").status_code == 200

    superadmin = _superadmin_client(app)
    response = superadmin.post(
        f"/api/superadmin/users/{user.id}/force-logout",
        json={"reason": "Security incident response"},
    )
    assert response.status_code == 200

    expired = client.get("/api/auth/me")
    assert expired.status_code == 401
    assert expired.get_json()["code"] == "session_expired"


def test_deactivated_user_cannot_log_in(app, client):
    app.config["RATE_LIMIT_ENABLED"] = False
    create_encoder(email="inactive@example.com", password="pass1234", status="inactive")

    response = _login(client, "inactive@example.com", "pass1234")
    assert response.status_code == 403

    assert LoginEvent.query.filter_by(email="inactive@example.com", success=False).count() == 1


def test_admin_cannot_see_or_touch_a_superadmin(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    _create_user("superadmin", "hidden@example.com")
    superadmin = User.query.filter_by(role="superadmin").one()

    listed = admin_client.get("/api/admin/users").get_json()["users"]
    assert all(user["role"] != "superadmin" for user in listed)
    assert admin_client.get("/api/admin/users?role=superadmin").get_json()["users"] == []

    assert admin_client.get(f"/api/admin/users/{superadmin.id}").status_code == 404
    assert admin_client.patch(
        f"/api/admin/users/{superadmin.id}", json={"status": "inactive"}
    ).status_code == 404
    assert admin_client.patch(
        f"/api/admin/users/{superadmin.id}", json={"password": "newpass1"}
    ).status_code == 404
    assert admin_client.patch(
        f"/api/admin/users/{superadmin.id}", json={"role": "admin"}
    ).status_code == 404


def test_admin_cannot_promote_to_superadmin(app, admin_client):
    app.config["RATE_LIMIT_ENABLED"] = False
    encoder = create_encoder(email="promote@example.com", password="pass1234")

    response = admin_client.patch(
        f"/api/admin/users/{encoder.id}", json={"role": "superadmin"}
    )
    assert response.status_code == 400
    db.session.refresh(encoder)
    assert encoder.role == "encoder"


def test_superadmin_cannot_deactivate_self_or_last_active_superadmin(app):
    app.config["RATE_LIMIT_ENABLED"] = False
    superadmin = _superadmin_client(app)
    me = User.query.filter_by(role="superadmin").one()

    self_response = superadmin.post(f"/api/superadmin/users/{me.id}/deactivate")
    assert self_response.status_code == 400

    other = _create_user("superadmin", "second-superadmin@example.com")
    assert superadmin.post(
        f"/api/superadmin/users/{other.id}/deactivate",
        json={"reason": "Duplicate administrator account"},
    ).status_code == 200

    last = superadmin.post(f"/api/superadmin/users/{me.id}/deactivate")
    assert last.status_code == 400
