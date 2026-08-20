import os
import uuid
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models.booking import ACTIVE_STATUSES, Booking
from app.models.vehicle import VALID_CATEGORIES, VALID_FEATURES, VALID_STATUSES, VALID_TYPES, Vehicle
from app.utils.decorators import admin_required
from app.utils.kenya import KENYA_LOCATIONS

vehicles_bp = Blueprint("vehicles", __name__, url_prefix="/api/vehicles")

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}


@vehicles_bp.get("")
def list_vehicles():
    query = Vehicle.query

    vehicle_type = request.args.get("type")
    if vehicle_type:
        query = query.filter_by(type=vehicle_type)

    category = request.args.get("category")
    if category:
        query = query.filter_by(category=category)

    location = request.args.get("location")
    if location:
        query = query.filter_by(location=location)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    min_price = request.args.get("min_price")
    if min_price:
        try:
            query = query.filter(Vehicle.price_per_day >= float(min_price))
        except ValueError:
            return jsonify({"errors": {"min_price": "must be a number"}}), 400

    max_price = request.args.get("max_price")
    if max_price:
        try:
            query = query.filter(Vehicle.price_per_day <= float(max_price))
        except ValueError:
            return jsonify({"errors": {"max_price": "must be a number"}}), 400

    available_from = request.args.get("available_from")
    available_to = request.args.get("available_to")
    if available_from or available_to:
        if not (available_from and available_to):
            return jsonify(
                {"errors": {"available_from": "available_from and available_to must be given together"}}
            ), 400
        try:
            start = datetime.strptime(available_from, "%Y-%m-%d").date()
            end = datetime.strptime(available_to, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"errors": {"available_from": "must be a date in YYYY-MM-DD format"}}), 400
        if end <= start:
            return jsonify({"errors": {"available_to": "must be after available_from"}}), 400

        booked_vehicle_ids = (
            db.session.query(Booking.vehicle_id)
            .filter(
                Booking.status.in_(ACTIVE_STATUSES),
                Booking.start_date < end,
                Booking.end_date > start,
            )
            .subquery()
        )
        query = query.filter(Vehicle.id.notin_(booked_vehicle_ids))

    vehicles = query.order_by(Vehicle.id.desc()).all()

    # Feature filter (?features=heated_seats,sunroof) - matched in Python since a plain
    # JSON column (portable across Postgres/SQLite) doesn't have containment operators
    # the way JSONB would; fleet sizes here don't make that a real cost.
    features_param = request.args.get("features")
    if features_param:
        wanted = {f.strip() for f in features_param.split(",") if f.strip()}
        vehicles = [v for v in vehicles if wanted.issubset(set(v.features or []))]

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

    if "category" in data and data.get("category") not in VALID_CATEGORIES:
        errors["category"] = f"category must be one of {sorted(VALID_CATEGORIES)}"

    if "location" in data and data.get("location") not in KENYA_LOCATIONS:
        errors["location"] = f"location must be one of {KENYA_LOCATIONS}"

    if not partial or "price_per_day" in data:
        try:
            if float(data.get("price_per_day")) < 0:
                errors["price_per_day"] = "price_per_day must be >= 0"
        except (TypeError, ValueError):
            errors["price_per_day"] = "price_per_day must be a number"

    if "status" in data and data.get("status") not in VALID_STATUSES:
        errors["status"] = f"status must be one of {sorted(VALID_STATUSES)}"

    if "features" in data:
        features = data.get("features")
        if not isinstance(features, list) or not all(isinstance(f, str) for f in features):
            errors["features"] = "features must be a list of strings"
        else:
            unknown = set(features) - VALID_FEATURES
            if unknown:
                errors["features"] = f"unknown feature(s): {sorted(unknown)}"

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
        category=data.get("category"),
        location=data.get("location"),
        make=data.get("make"),
        model=data.get("model"),
        year=data.get("year"),
        license_plate=data.get("license_plate"),
        price_per_day=data["price_per_day"],
        status=data.get("status", "available"),
        description=data.get("description"),
        image_url=data.get("image_url"),
        features=data.get("features") or [],
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
        "category",
        "location",
        "make",
        "model",
        "year",
        "license_plate",
        "price_per_day",
        "status",
        "description",
        "image_url",
        "features",
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
