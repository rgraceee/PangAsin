import hashlib
import re
import secrets
from datetime import datetime, timedelta

from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.password_reset_token import PasswordResetToken
from tests.conftest import create_encoder


RESET_URL_RE = re.compile(r"reset-password\?token=([A-Za-z0-9_\-]+)")


def _capture_email(monkeypatch):
    sent = []

    def fake_send_email(to, subject, html, text):
        sent.append({"to": to, "subject": subject, "html": html, "text": text})
        return True

    monkeypatch.setattr("app.blueprints.auth_api.send_email", fake_send_email)
    return sent


def _request_reset(client, email):
    return client.post(
        "/api/auth/password-reset-request",
        json={"email": email},
    )


def _extract_token(sent):
    match = RESET_URL_RE.search(sent[-1]["text"])
    assert match, sent[-1]["text"]
    return match.group(1)


def test_reset_request_is_generic_and_stores_only_a_hash(
    app, client, monkeypatch
):
    app.config["RATE_LIMIT_ENABLED"] = False
    create_encoder(email="encoder@example.com", password="oldpass1")
    sent = _capture_email(monkeypatch)

    unknown = _request_reset(client, "unknown@example.com")
    assert unknown.status_code == 200
    assert unknown.get_json()["message"] == (
        "If that email is registered, a reset link has been sent."
    )
    assert PasswordResetToken.query.count() == 0

    known = _request_reset(client, "encoder@example.com")
    assert known.status_code == 200
    assert known.get_json() == unknown.get_json()
    assert len(sent) == 1
    assert sent[0]["to"] == "encoder@example.com"

    raw_token = _extract_token(sent)
    stored = PasswordResetToken.query.one()
    assert stored.token_hash == hashlib.sha256(raw_token.encode()).hexdigest()
    assert stored.token_hash != raw_token
    assert stored.used_at is None
    assert stored.expires_at > datetime.utcnow()
    assert AuditLog.query.filter_by(action="auth.password.reset_request").count() == 2


def test_reset_link_works_once_and_changes_the_password(app, client, monkeypatch):
    app.config["RATE_LIMIT_ENABLED"] = False
    user = create_encoder(email="encoder@example.com", password="oldpass1")
    sent = _capture_email(monkeypatch)
    other_session = app.test_client()
    assert (
        other_session.post(
            "/api/auth/login",
            json={"email": "encoder@example.com", "password": "oldpass1"},
        ).status_code
        == 200
    )

    assert _request_reset(client, "encoder@example.com").status_code == 200
    raw_token = _extract_token(sent)

    checked = client.get(
        "/api/auth/password-reset/validate",
        query_string={"token": raw_token},
    )
    assert checked.status_code == 200
    assert checked.get_json()["valid"] is True

    reset = client.post(
        "/api/auth/password-reset/confirm",
        json={
            "token": raw_token,
            "new_password": "newpass123",
            "confirm_password": "newpass123",
        },
    )
    assert reset.status_code == 200, reset.get_json()

    db.session.refresh(user)
    assert user.check_password("newpass123")
    assert not user.check_password("oldpass1")
    assert user.session_version == 1
    assert PasswordResetToken.query.one().used_at is not None
    assert AuditLog.query.filter_by(
        action="auth.password.reset_complete"
    ).count() == 1
    assert other_session.get("/api/auth/me").status_code == 401

    reused = client.get(
        "/api/auth/password-reset/validate",
        query_string={"token": raw_token},
    )
    assert reused.status_code == 400
    assert reused.get_json()["code"] == "used_token"

    login = client.post(
        "/api/auth/login",
        json={"email": "encoder@example.com", "password": "newpass123"},
    )
    assert login.status_code == 200


def test_expired_and_inactive_accounts_cannot_reset(app, client, monkeypatch):
    app.config["RATE_LIMIT_ENABLED"] = False
    sent = _capture_email(monkeypatch)

    active = create_encoder(email="active@example.com", password="oldpass1")
    raw_token = secrets.token_urlsafe(32)
    db.session.add(
        PasswordResetToken(
            user_id=active.id,
            token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
            expires_at=datetime.utcnow() - timedelta(minutes=1),
        )
    )
    db.session.commit()

    expired = client.get(
        "/api/auth/password-reset/validate",
        query_string={"token": raw_token},
    )
    assert expired.status_code == 400
    assert expired.get_json()["code"] == "expired_token"

    inactive = create_encoder(
        email="inactive@example.com",
        password="oldpass1",
        status="inactive",
    )
    assert _request_reset(client, "inactive@example.com").status_code == 200
    assert len(sent) == 0
    assert PasswordResetToken.query.filter_by(user_id=inactive.id).count() == 0

    blocked_login = client.post(
        "/api/auth/login",
        json={"email": "inactive@example.com", "password": "oldpass1"},
    )
    assert blocked_login.status_code == 403

    inactive_raw = secrets.token_urlsafe(32)
    db.session.add(
        PasswordResetToken(
            user_id=inactive.id,
            token_hash=hashlib.sha256(inactive_raw.encode()).hexdigest(),
            expires_at=datetime.utcnow() + timedelta(minutes=30),
        )
    )
    db.session.commit()

    blocked_reset = client.post(
        "/api/auth/password-reset/confirm",
        json={
            "token": inactive_raw,
            "new_password": "newpass123",
            "confirm_password": "newpass123",
        },
    )
    assert blocked_reset.status_code == 403
    assert blocked_reset.get_json()["code"] == "inactive_account"


def test_email_failure_does_not_break_the_generic_response(
    app, client, monkeypatch
):
    app.config["RATE_LIMIT_ENABLED"] = False
    create_encoder(email="encoder@example.com", password="oldpass1")

    def fail_send(*args, **kwargs):
        raise RuntimeError("SMTP unavailable")

    monkeypatch.setattr("app.blueprints.auth_api.send_email", fail_send)

    response = _request_reset(client, "encoder@example.com")

    assert response.status_code == 200
    assert response.get_json()["message"] == (
        "If that email is registered, a reset link has been sent."
    )


def test_email_helper_uses_flask_mail_without_real_smtp(app):
    from app.services.email import send_email

    app.extensions["mail"].suppress = True
    app.extensions["mail"].default_sender = "PangAsin <test@example.com>"

    with app.app_context():
        assert send_email(
            "encoder@example.com",
            "Reset your PangAsin password",
            "<p>Reset link</p>",
            "Reset link",
        ) is True


def test_reset_request_rate_limit_is_five_per_window(app, client):
    app.config["RATE_LIMIT_ENABLED"] = True
    app.config["PASSWORD_RESET_RATE_LIMIT"] = 5
    app.config["PASSWORD_RESET_RATE_WINDOW"] = 3600

    for _ in range(5):
        assert _request_reset(client, "unknown@example.com").status_code == 200

    blocked = _request_reset(client, "unknown@example.com")
    assert blocked.status_code == 429
    assert blocked.get_json()["code"] == "rate_limited"
