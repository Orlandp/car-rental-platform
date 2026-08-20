import os
import uuid

from flask import Blueprint, current_app, jsonify, request
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models.vehicle import VALID_STATUSES, VALID_TYPES, Vehicle
from app.utils.decorators import admin_required

vehicles_bp = Blueprint("vehicles", __name__, url_prefix="/api/vehicles")

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}


@vehicles_bp.get("")
def list_vehicles():
    query = Vehicle.query

    vehicle_type = request.args.get("type")
    if vehicle_type:
        query = query.filter_by(type=vehicle_type)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    vehicles = query.order_by(Vehicle.id.desc()).all()
    return jsonify([v.to_dict() for v in vehicles]), 200


@vehicles_bp.get("/<int:vehicle_id>")
def get_vehicle(vehicle_id):
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    return jsonify(vehicle.to_dict()), 200


def _validate_vehicle_payload(data, partial=False):
    errors = {}

    if not partial or "name" in data:
        if not (data.get("name") or "").strip():
            errors["name"] = "name is required"

    if not partial or "type" in data:
        if data.get("type") not in VALID_TYPES:
            errors["type"] = f"type must be one of {sorted(VALID_TYPES)}"

    if not partial or "price_per_day" in data:
        try:
            if float(data.get("price_per_day")) < 0:
                errors["price_per_day"] = "price_per_day must be >= 0"
        except (TypeError, ValueError):
            errors["price_per_day"] = "price_per_day must be a number"

    if "status" in data and data.get("status") not in VALID_STATUSES:
        errors["status"] = f"status must be one of {sorted(VALID_STATUSES)}"

    return errors


@vehicles_bp.post("")
@admin_required
def create_vehicle():
    data = request.get_json(silent=True) or {}
    errors = _validate_vehicle_payload(data)
    if errors:
        return jsonify({"errors": errors}), 400

    vehicle = Vehicle(
        name=data["name"].strip(),
        type=data["type"],
        make=data.get("make"),
        model=data.get("model"),
        year=data.get("year"),
        license_plate=data.get("license_plate"),
        price_per_day=data["price_per_day"],
        status=data.get("status", "available"),
        description=data.get("description"),
        image_url=data.get("image_url"),
    )
    db.session.add(vehicle)
    db.session.commit()
    return jsonify(vehicle.to_dict()), 201


@vehicles_bp.patch("/<int:vehicle_id>")
@admin_required
def update_vehicle(vehicle_id):
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    data = request.get_json(silent=True) or {}

    errors = _validate_vehicle_payload(data, partial=True)
    if errors:
        return jsonify({"errors": errors}), 400

    for field in (
        "name",
        "type",
        "make",
        "model",
        "year",
        "license_plate",
        "price_per_day",
        "status",
        "description",
        "image_url",
    ):
        if field in data:
            setattr(vehicle, field, data[field])

    db.session.commit()
    return jsonify(vehicle.to_dict()), 200


@vehicles_bp.delete("/<int:vehicle_id>")
@admin_required
def delete_vehicle(vehicle_id):
    vehicle = Vehicle.query.get_or_404(vehicle_id)
    db.session.delete(vehicle)
    db.session.commit()
    return jsonify({"message": "vehicle deleted"}), 200


def _delete_uploaded_file(image_url):
    if not image_url or not image_url.startswith("/static/uploads/vehicles/"):
        return
    filename = image_url.rsplit("/", 1)[-1]
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
    if os.path.isfile(path):
        os.remove(path)


@vehicles_bp.post("/<int:vehicle_id>/image")
@admin_required
def upload_vehicle_image(vehicle_id):
    vehicle = Vehicle.query.get_or_404(vehicle_id)

    image = request.files.get("image")
    if image is None or image.filename == "":
        return jsonify({"errors": {"image": "no image file provided"}}), 400

    ext = image.filename.rsplit(".", 1)[-1].lower() if "." in image.filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify(
            {"errors": {"image": f"file type must be one of {sorted(ALLOWED_IMAGE_EXTENSIONS)}"}}
        ), 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    filename = secure_filename(f"vehicle_{vehicle.id}_{uuid.uuid4().hex}.{ext}")
    image.save(os.path.join(upload_folder, filename))

    _delete_uploaded_file(vehicle.image_url)
    vehicle.image_url = f"/static/uploads/vehicles/{filename}"
    db.session.commit()

    return jsonify(vehicle.to_dict()), 200
