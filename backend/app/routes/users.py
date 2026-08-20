from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.user import VALID_ROLES, User
from app.routes.auth import USERNAME_RE
from app.utils.decorators import admin_required

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.get("")
@admin_required
def list_users():
    query = User.query
    role = request.args.get("role")
    if role:
        query = query.filter_by(role=role)
    users = query.order_by(User.id.asc()).all()
    return jsonify([u.to_dict() for u in users]), 200


def _validate_user_payload(data, partial=False):
    errors = {}

    if not partial or "name" in data:
        if not (data.get("name") or "").strip():
            errors["name"] = "name is required"

    if not partial or "username" in data:
        username = (data.get("username") or "").strip().lower()
        if not USERNAME_RE.match(username):
            errors["username"] = "username must be 3-50 characters: letters, numbers, '.' or '_' only"

    if not partial or "email" in data:
        if not (data.get("email") or "").strip():
            errors["email"] = "email is required"

    if not partial or "role" in data:
        if data.get("role") not in VALID_ROLES:
            errors["role"] = f"role must be one of {sorted(VALID_ROLES)}"

    password = data.get("password")
    if not partial and not password:
        errors["password"] = "password is required"
    elif password and len(password) < 6:
        errors["password"] = "password must be at least 6 characters"

    return errors


@users_bp.post("")
@admin_required
def create_user():
    data = request.get_json(silent=True) or {}
    errors = _validate_user_payload(data)
    if errors:
        return jsonify({"errors": errors}), 400

    username = data["username"].strip().lower()
    email = data["email"].strip().lower()

    if User.query.filter_by(username=username).first():
        return jsonify({"errors": {"username": "that username is already taken"}}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"errors": {"email": "an account with this email already exists"}}), 409

    user = User(name=data["name"].strip(), username=username, email=email, role=data["role"])
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@users_bp.patch("/<int:user_id>")
@admin_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    errors = _validate_user_payload(data, partial=True)
    if errors:
        return jsonify({"errors": errors}), 400

    if "username" in data:
        username = data["username"].strip().lower()
        existing = User.query.filter_by(username=username).first()
        if existing and existing.id != user.id:
            return jsonify({"errors": {"username": "that username is already taken"}}), 409
        user.username = username

    if "email" in data:
        email = data["email"].strip().lower()
        existing = User.query.filter_by(email=email).first()
        if existing and existing.id != user.id:
            return jsonify({"errors": {"email": "an account with this email already exists"}}), 409
        user.email = email

    if "name" in data:
        user.name = data["name"].strip()

    if "role" in data:
        user.role = data["role"]

    if data.get("password"):
        user.set_password(data["password"])

    db.session.commit()
    return jsonify(user.to_dict()), 200
