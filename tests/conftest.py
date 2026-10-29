import pytest

from app import create_app
from app.extensions import db
from app.models.user import User


class TestConfig:
    TESTING = True
    SECRET_KEY = "test-secret"
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = False


@pytest.fixture
def app(tmp_path):
    class Config(TestConfig):
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{tmp_path / 'pangasin-test.db'}"

    application = create_app(Config)
    with application.app_context():
        db.create_all()

        admin = User(
            name="Test Admin",
            email="admin@example.com",
            role="admin",
            status="active",
        )
        admin.set_password("adminpass")
        db.session.add(admin)
        db.session.commit()

        yield application

        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def admin_client(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "adminpass"},
    )
    assert response.status_code == 200, response.get_json()
    return client


def create_encoder(
    *,
    email,
    name="Test Encoder",
    municipality_id=None,
    password="encoderpass",
    status="active",
    must_change_password=False,
):
    user = User(
        name=name,
        email=email,
        role="encoder",
        municipality_id=municipality_id,
        status=status,
        must_change_password=must_change_password,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return user
