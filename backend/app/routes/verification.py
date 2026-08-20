import os
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_login import current_user, login_required

from app.extensions import db
from app.models.user import (
    VERIFICATION_PENDING,
    VERIFICATION_REJECTED,
    VERIFICATION_VERIFIED,
    User,
)
from app.utils.decorators import admin_required
from app.utils.kenya import validate_kenyan_dl_number, validate_kenyan_id_number

verification_bp = Blueprint("verification", __name__, url_prefix="/api")

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
ADMIN_SETTABLE_STATUSES = {VERIFICATION_VERIFIED, VERIFICATION_REJECTED}


def _save_verification_image(file_storage, user_id, kind):
    ext = file_storage.filename.rsplit(".", 1)[-1].lower() if "." in file_storage.filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return None, f"file type must be one of {sorted(ALLOWED_IMAGE_EXTENSIONS)}"

    folder = os.path.join(current_app.config["VERIFICATION_UPLOAD_FOLDER"], f"user_{user_id}")
    os.makedirs(folder, exist_ok=True)
    filename = f"{kind}_{uuid.uuid4().hex}.{ext}"
    file_storage.save(os.path.join(folder, filename))
    return filename, None


def _delete_verification_image(user_id, filename):
    if not filename:
        return
    path = os.path.join(current_app.config["VERIFICATION_UPLOAD_FOLDER"], f"user_{user_id}", filename)
    if os.path.isfile(path):
        os.remove(path)


@verification_bp.get("/users/me/verification")
@login_required
def get_my_verification():
    return jsonify(current_user.to_verification_dict()), 200


@verification_bp.post("/users/me/verification")
@login_required
def submit_verification():
    dl_number = (request.form.get("driver_license_number") or "").strip()
    id_number = (request.form.get("national_id_number") or "").strip()
    dl_image = request.files.get("driver_license_image")
    id_image = request.files.get("national_id_image")

    errors = {}
    if not dl_number:
        errors["driver_license_number"] = "driver_license_number is required"
    else:
        try:
            dl_number = validate_kenyan_dl_number(dl_number)
        except ValueError as exc:
            errors["driver_license_number"] = str(exc)

    if not id_number:
        errors["national_id_number"] = "national_id_number is required"
    else:
        try:
            id_number = validate_kenyan_id_number(id_number)
        except ValueError as exc:
            errors["national_id_number"] = str(exc)

    if dl_image is None or dl_image.filename == "":
        errors["driver_license_image"] = "driver_license_image is required"
    if id_image is None or id_image.filename == "":
        errors["national_id_image"] = "national_id_image is required"
    if errors:
        return jsonify({"errors": errors}), 400

    dl_filename, dl_error = _save_verification_image(dl_image, current_user.id, "dl")
    if dl_error:
        return jsonify({"errors": {"driver_license_image": dl_error}}), 400

    id_filename, id_error = _save_verification_image(id_image, current_user.id, "id")
    if id_error:
        return jsonify({"errors": {"national_id_image": id_error}}), 400

    _delete_verification_image(current_user.id, current_user.driver_license_image_path)
    _delete_verification_image(current_user.id, current_user.national_id_image_path)

    current_user.driver_license_number = dl_number
    current_user.national_id_number = id_number
    current_user.driver_license_image_path = dl_filename
    current_user.national_id_image_path = id_filename
    current_user.verification_status = VERIFICATION_PENDING
    current_user.verification_notes = None
    current_user.verification_submitted_at = datetime.now(timezone.utc)
    current_user.verified_at = None
    current_user.verified_by_id = None
    db.session.commit()

    return jsonify(current_user.to_verification_dict()), 200


def _verification_image_path(user, kind):
    filename = user.driver_license_image_path if kind == "driver-license" else user.national_id_image_path
    if not filename:
        return None
    return os.path.join(current_app.config["VERIFICATION_UPLOAD_FOLDER"], f"user_{user.id}"), filename


@verification_bp.get("/users/<int:user_id>/verification/<kind>-image")
@login_required
def get_verification_image(user_id, kind):
    if kind not in ("driver-license", "national-id"):
        return jsonify({"error": "not found"}), 404
    if user_id != current_user.id and not current_user.is_admin:
        return jsonify({"error": "forbidden"}), 403

    user = User.query.get_or_404(user_id)
    result = _verification_image_path(user, kind)
    if result is None:
        return jsonify({"error": "no image on file"}), 404
    folder, filename = result
    return send_from_directory(folder, filename)


@verification_bp.get("/admin/verifications")
@admin_required
def list_verifications():
    query = User.query.filter(User.verification_submitted_at.isnot(None))
    status = request.args.get("status")
    if status:
        query = query.filter_by(verification_status=status)
    users = query.order_by(User.verification_submitted_at.desc()).all()
    return jsonify(
        [{**u.to_dict(), **u.to_verification_dict()} for u in users]
    ), 200


@verification_bp.patch("/users/<int:user_id>/verification")
@admin_required
def review_verification(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}

    status = data.get("status")
    if status not in ADMIN_SETTABLE_STATUSES:
        return jsonify({"errors": {"status": f"must be one of {sorted(ADMIN_SETTABLE_STATUSES)}"}}), 400

    user.verification_status = status
    user.verification_notes = (data.get("notes") or "").strip() or None
    user.verified_at = datetime.now(timezone.utc)
    user.verified_by_id = current_user.id
    db.session.commit()

    return jsonify({**user.to_dict(), **user.to_verification_dict()}), 200
