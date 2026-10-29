import os
from dotenv import load_dotenv

load_dotenv()

database_url = os.environ.get("DATABASE_URL")
if database_url and database_url.startswith("postgresql+psycopg://"):
    database_url = database_url.replace(
        "postgresql+psycopg://", "postgresql+psycopg2://", 1
    )
elif database_url and database_url.startswith("postgresql://"):
    database_url = database_url.replace(
        "postgresql://", "postgresql+psycopg2://", 1
    )
elif database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg2://", 1)


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "you-will-never-guess"
    FLASK_ENV = os.environ.get("FLASK_ENV") or "development"
    SQLALCHEMY_DATABASE_URI = database_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Supabase's connection pooler closes idle connections. Ping before
    # reusing a pooled connection and recycle them to avoid "server closed
    # the connection unexpectedly" errors.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
        "pool_size": 5,
        "max_overflow": 5,
    }

    # WHAT: Lightweight in-process abuse protection.
    # WHY: Login attempts are cheap to retry and expensive to hash; admin
    #      writes are destructive. Limits are per IP (login) or per user
    #      (admin writes) inside a sliding window.
    RATE_LIMIT_ENABLED = os.environ.get("RATE_LIMIT_ENABLED", "1").lower() not in (
        "0",
        "false",
        "no",
    )
    LOGIN_RATE_LIMIT = int(os.environ.get("LOGIN_RATE_LIMIT", "10"))
    LOGIN_RATE_WINDOW = int(os.environ.get("LOGIN_RATE_WINDOW", "60"))
    ADMIN_WRITE_RATE_LIMIT = int(os.environ.get("ADMIN_WRITE_RATE_LIMIT", "120"))
    ADMIN_WRITE_RATE_WINDOW = int(os.environ.get("ADMIN_WRITE_RATE_WINDOW", "60"))
    MAX_GEOJSON_BYTES = int(os.environ.get("MAX_GEOJSON_BYTES", str(5 * 1024 * 1024)))


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
