import hashlib
import re
from datetime import datetime, timedelta

from app.extensions import db
from app.models.email_change_token import EmailChangeToken
from app.models.user import User
from tests.conftest import create_encoder


EMAIL_CHANGE_URL_RE = re.compile(
    r"confirm-email-change\?token=([A-Za-z0-9_.-]+)"
)


def _capture_email(monkeypatch):
    sent = []

    def fake_send_email(to, subject, html, text):
        sent.append({"to": to, "subject": subject, "html": html, "text": text})
        return True

    monkeypatch.setattr("app.blueprints.auth_api.send_email", fake_send_email)
    return sent


def _login(client, email="encoder@pangasin.gov.ph"):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": "temporary1"},
    )


def _token_from(sent):
    match = EMAIL_CHANGE_URL_RE.search(sent[0]["text"])
    assert match, sent[0]["text"]
    return match.group(1)


def test_email_change_requires_password_and_valid_unique_email(
    client, monkeypatch
):
    monkeypatch.setattr("app.blueprints.auth_api.send_email", lambda *args: True)
    create_encoder(email="encoder@pangasin.gov.ph", password="temporary1")
    create_encoder(email="taken@example.com")
    assert _login(client).status_code == 200

    wrong_password = client.post(
        "/api/auth/email-change-request",
        json={"email": "new@example.com", "current_password": "wrongpass"},
    )
    invalid_email = client.post(
        "/api/auth/email-change-request",
        json={"email": "not-an-email", "current_password": "temporary1"},
    )
    duplicate_email = client.post(
        "/api/auth/email-change-request",
        json={"email": "TAKEN@example.com", "current_password": "temporary1"},
    )

    assert wrong_password.status_code == 400
    assert invalid_email.status_code == 400
    assert duplicate_email.status_code == 409


def test_email_changes_only_after_confirmation_and_reset_uses_new_email(
    app, client, monkeypatch
):
    app.config["RATE_LIMIT_ENABLED"] = False
    encoder = create_encoder(
        email="encoder@pangasin.gov.ph",
        password="temporary1",
    )
    sent = _capture_email(monkeypatch)
    assert _login(client).status_code == 200

    requested = client.post(
        "/api/auth/email-change-request",
        json={
            "email": "encoder.real@example.com",
            "current_password": "temporary1",
        },
    )
    assert requested.status_code == 200
    assert sent[0]["to"] == "encoder.real@example.com"
    assert "encoder.real@example.com" not in sent[0]["text"].split(
        "confirm-email-change?token="
    )[-1]
    assert "expires in 30 minutes" in requested.get_json()["message"]
    assert db.session.get(User, encoder.id).email == "encoder@pangasin.gov.ph"

    token = _token_from(sent)
    stored_token = EmailChangeToken.query.one()
    assert stored_token.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert stored_token.token_hash != token
    assert stored_token.current_email == "encoder@pangasin.gov.ph"
    assert stored_token.new_email == "encoder.real@example.com"
    confirmed = client.post(
        "/api/auth/email-change/confirm",
        json={"token": token},
    )
    assert confirmed.status_code == 200
    assert confirmed.get_json()["email"] == "encoder.real@example.com"
    assert db.session.get(User, encoder.id).email == "encoder.real@example.com"

    reused = client.post(
        "/api/auth/email-change/confirm",
        json={"token": token},
    )
    assert reused.status_code == 400

    old_login = client.post(
        "/api/auth/login",
        json={"email": "encoder@pangasin.gov.ph", "password": "temporary1"},
    )
    new_login = client.post(
        "/api/auth/login",
        json={"email": "encoder.real@example.com", "password": "temporary1"},
    )
    assert old_login.status_code == 401
    assert new_login.status_code == 200

    reset = client.post(
        "/api/auth/password-reset-request",
        json={"email": "encoder.real@example.com"},
    )
    assert reset.status_code == 200
    assert sent[1]["to"] == "encoder.real@example.com"


def test_email_change_confirmation_rejects_invalid_token(client):
    response = client.post(
        "/api/auth/email-change/confirm",
        json={"token": "not-a-valid-token"},
    )

    assert response.status_code == 400


def test_email_change_confirmation_rejects_expired_token(
    app, client, monkeypatch
):
    app.config["RATE_LIMIT_ENABLED"] = False
    encoder = create_encoder(
        email="encoder@pangasin.gov.ph",
        password="temporary1",
    )
    sent = _capture_email(monkeypatch)
    assert _login(client).status_code == 200
    client.post(
        "/api/auth/email-change-request",
        json={
            "email": "encoder.real@example.com",
            "current_password": "temporary1",
        },
    )
    token = _token_from(sent)
    stored_token = EmailChangeToken.query.one()
    stored_token.expires_at = datetime.utcnow() - timedelta(minutes=1)
    db.session.commit()

    response = client.post(
        "/api/auth/email-change/confirm",
        json={"token": token},
    )

    assert response.status_code == 400
    assert db.session.get(User, encoder.id).email == "encoder@pangasin.gov.ph"
