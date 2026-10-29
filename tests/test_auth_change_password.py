from app.extensions import db
from app.models.municipality import Municipality
from app.models.user import User
from tests.conftest import create_encoder


def _login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_login_and_me_include_must_change_password(client):
    create_encoder(
        email="new.encoder@example.com",
        password="temporary1",
        must_change_password=True,
    )

    response = _login(client, "new.encoder@example.com", "temporary1")

    assert response.status_code == 200
    assert response.get_json()["must_change_password"] is True

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.get_json()["must_change_password"] is True


def test_other_api_is_blocked_until_password_is_changed(client):
    create_encoder(
        email="new.encoder@example.com",
        password="temporary1",
        must_change_password=True,
    )
    _login(client, "new.encoder@example.com", "temporary1")

    blocked = client.get("/api/encoder/barangays")

    assert blocked.status_code == 403
    assert blocked.get_json()["code"] == "password_change_required"


def test_change_password_rejects_wrong_current_password(client):
    create_encoder(
        email="new.encoder@example.com",
        password="temporary1",
        must_change_password=True,
    )
    _login(client, "new.encoder@example.com", "temporary1")

    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong", "new_password": "brandnew1"},
    )

    assert response.status_code == 400


def test_change_password_rejects_short_or_same_password(client):
    create_encoder(
        email="new.encoder@example.com",
        password="temporary1",
        must_change_password=True,
    )
    _login(client, "new.encoder@example.com", "temporary1")

    short = client.post(
        "/api/auth/change-password",
        json={"current_password": "temporary1", "new_password": "abc"},
    )
    same = client.post(
        "/api/auth/change-password",
        json={"current_password": "temporary1", "new_password": "temporary1"},
    )

    assert short.status_code == 400
    assert same.status_code == 400


def test_change_password_clears_flag_and_unblocks_api(client):
    municipality = Municipality(
        name="Test Municipality", latitude=16.0, longitude=120.0, status="active"
    )
    db.session.add(municipality)
    db.session.commit()
    create_encoder(
        email="new.encoder@example.com",
        password="temporary1",
        must_change_password=True,
        municipality_id=municipality.id,
    )
    _login(client, "new.encoder@example.com", "temporary1")

    response = client.post(
        "/api/auth/change-password",
        json={"current_password": "temporary1", "new_password": "brandnew1"},
    )

    assert response.status_code == 200
    assert client.get("/api/auth/me").get_json()["must_change_password"] is False

    stored = User.query.filter_by(email="new.encoder@example.com").one()
    assert stored.must_change_password is False
    assert stored.check_password("brandnew1")
    assert not stored.check_password("temporary1")

    # The account can now use its normal encoder endpoints.
    assert client.get("/api/encoder/barangays").status_code == 200


def test_inactive_user_session_is_rejected_and_logged_out(client):
    encoder = create_encoder(email="encoder@example.com", password="encoderpass")
    _login(client, "encoder@example.com", "encoderpass")

    encoder.status = "inactive"
    db.session.commit()

    response = client.get("/api/auth/me")

    assert response.status_code == 403
    assert "inactive" in response.get_json()["error"]
    assert client.get("/api/auth/me").status_code == 401
