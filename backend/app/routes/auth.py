import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required, login_user, logout_user

from app.extensions import db
from app.models.password_reset_token import PasswordResetToken
from app.models.user import ROLE_CLIENT, ROLE_COMPANY, User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.]{3,50}$")
RESET_TOKEN_TTL_MINUTES = 30


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    username = (data.get("username") or "").strip().lower()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not username or not email or not password:
        return jsonify({"error": "name, username, email and password are required"}), 400

    if not USERNAME_RE.match(username):
        return jsonify(
            {"error": "username must be 3-50 characters: letters, numbers, '.' or '_' only"}
        ), 400

    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "that username is already taken"}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "an account with this email already exists"}), 409

    # Public registration can only ever produce a client or company account.
    # Anything else submitted (e.g. "admin") is silently downgraded to client -
    # admin accounts only ever come from the `flask create-admin` CLI command.
    role = (data.get("role") or ROLE_CLIENT).strip().lower()
    if role not in (ROLE_CLIENT, ROLE_COMPANY):
        role = ROLE_CLIENT

    user = User(name=name, username=username, email=email, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    login_user(user)
    return jsonify(user.to_dict()), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(username=username).first()
    if user is None or not user.check_password(password):
        return jsonify({"error": "invalid username or password"}), 401

    login_user(user)
    return jsonify(user.to_dict()), 200


@auth_bp.post("/logout")
@login_required
def logout():
    logout_user()
    return jsonify({"message": "logged out"}), 200


@auth_bp.get("/me")
@login_required
def me():
    return jsonify(current_user.to_dict()), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "email is required"}), 400

    # Always return the same generic message, whether or not the email is
    # registered, so this endpoint can't be used to enumerate accounts.
    generic_message = {
        "message": "If an account exists for that email, a password reset link has been generated."
    }

    user = User.query.filter_by(email=email).first()
    if user is not None:
        # Invalidate any earlier unused reset requests for this user.
        PasswordResetToken.query.filter_by(user_id=user.id, used_at=None).delete()

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=_utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
        )
        db.session.add(reset_token)
        db.session.commit()

        reset_link = f"{current_app.config['FRONTEND_URL']}/reset-password?token={raw_token}"
        # No email service is wired up yet - log the link so it can be used
        # during development/testing. Swap this for a real email send later.
        current_app.logger.info("Password reset link for %s: %s", email, reset_link)
        print(f"\n[password reset] {email} -> {reset_link}\n(expires in {RESET_TOKEN_TTL_MINUTES} minutes)\n")

    return jsonify(generic_message), 200


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    password = data.get("password") or ""

    if not token or not password:
        return jsonify({"error": "token and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    reset_token = PasswordResetToken.query.filter_by(token_hash=token_hash).first()

    if reset_token is None or not reset_token.is_valid:
        return jsonify({"error": "this reset link is invalid or has expired"}), 400

    reset_token.user.set_password(password)
    reset_token.used_at = _utcnow()
    db.session.commit()

    return jsonify({"message": "your password has been reset, you can now log in"}), 200
