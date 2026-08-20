import os

from sqlalchemy.pool import StaticPool

basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

DEFAULT_SECRET_KEY = "dev-secret-key"


class Config:
    ENV = os.environ.get("FLASK_ENV", "development")
    SECRET_KEY = os.environ.get("SECRET_KEY", DEFAULT_SECRET_KEY)
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(basedir, 'dev.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")

    # Used to build password-reset links; point this at the deployed frontend in production.
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Session cookie carries only a session id (server-side session), no JWT.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    # Cookies can't survive plain HTTP in production - require HTTPS by default
    # once FLASK_ENV=production; explicit SESSION_COOKIE_SECURE always wins.
    SESSION_COOKIE_SECURE = os.environ.get(
        "SESSION_COOKIE_SECURE", "true" if ENV == "production" else "false"
    ).lower() == "true"

    UPLOAD_FOLDER = os.path.join(basedir, "app", "static", "uploads", "vehicles")
    COMPANY_UPLOAD_FOLDER = os.path.join(basedir, "app", "static", "uploads", "company")
    # Deliberately OUTSIDE app/static - identity documents must never be reachable by a
    # guessed URL. Only served through the authenticated routes in app/routes/verification.py.
    VERIFICATION_UPLOAD_FOLDER = os.path.join(basedir, "private_uploads", "verification")
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB


class TestConfig(Config):
    TESTING = True
    SECRET_KEY = "test-secret-key"
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    SESSION_COOKIE_SECURE = False
    # In-memory sqlite defaults to a fresh DB per connection; StaticPool pins it to
    # one connection for the life of the test process so all requests see the same data.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    }
