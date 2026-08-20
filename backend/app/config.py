import os

basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")
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

    UPLOAD_FOLDER = os.path.join(basedir, "app", "static", "uploads", "vehicles")
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB
