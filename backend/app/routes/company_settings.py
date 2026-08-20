import os
import uuid

from flask import Blueprint, current_app, jsonify, request
from flask_login import login_required
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models.company_settings import CompanySettings
from app.utils.decorators import admin_required

company_settings_bp = Blueprint("company_settings", __name__, url_prefix="/api/company-settings")

EDITABLE_FIELDS = ("name", "kra_pin", "address", "city", "phone", "email")
ALLOWED_LOGO_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


@company_settings_bp.get("")
@login_required
def get_company_settings():
    settings = CompanySettings.get_solo()
    return jsonify(settings.to_dict()), 200


@company_settings_bp.put("")
@admin_required
def update_company_settings():
    settings = CompanySettings.get_solo()
    data = request.get_json(silent=True) or {}
    errors = {}

    for field in EDITABLE_FIELDS:
        if field in data:
            setattr(settings, field, (data[field] or "").strip())

    if "vat_rate" in data:
        try:
            vat_rate = round(float(data["vat_rate"]), 2)
            if vat_rate < 0 or vat_rate > 100:
                errors["vat_rate"] = "vat_rate must be between 0 and 100"
            else:
                settings.vat_rate = vat_rate
        except (TypeError, ValueError):
            errors["vat_rate"] = "vat_rate must be a number"

    if "deposit_percentage" in data:
        try:
            deposit_percentage = round(float(data["deposit_percentage"]), 2)
            if deposit_percentage < 0 or deposit_percentage > 100:
                errors["deposit_percentage"] = "deposit_percentage must be between 0 and 100"
            else:
                settings.deposit_percentage = deposit_percentage
        except (TypeError, ValueError):
            errors["deposit_percentage"] = "deposit_percentage must be a number"

    if "driver_daily_rate" in data:
        try:
            driver_daily_rate = round(float(data["driver_daily_rate"]), 2)
            if driver_daily_rate < 0:
                errors["driver_daily_rate"] = "driver_daily_rate must be >= 0"
            else:
                settings.driver_daily_rate = driver_daily_rate
        except (TypeError, ValueError):
            errors["driver_daily_rate"] = "driver_daily_rate must be a number"

    if errors:
        return jsonify({"errors": errors}), 400

    db.session.commit()
    return jsonify(settings.to_dict()), 200


def _delete_logo_file(logo_path):
    if not logo_path:
        return
    path = os.path.join(current_app.config["COMPANY_UPLOAD_FOLDER"], logo_path)
    if os.path.isfile(path):
        os.remove(path)


@company_settings_bp.post("/logo")
@admin_required
def upload_company_logo():
    settings = CompanySettings.get_solo()

    logo = request.files.get("logo")
    if logo is None or logo.filename == "":
        return jsonify({"errors": {"logo": "no logo file provided"}}), 400

    ext = logo.filename.rsplit(".", 1)[-1].lower() if "." in logo.filename else ""
    if ext not in ALLOWED_LOGO_EXTENSIONS:
        return jsonify(
            {"errors": {"logo": f"file type must be one of {sorted(ALLOWED_LOGO_EXTENSIONS)}"}}
        ), 400

    upload_folder = current_app.config["COMPANY_UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)

    filename = secure_filename(f"logo_{uuid.uuid4().hex}.{ext}")
    logo.save(os.path.join(upload_folder, filename))

    _delete_logo_file(settings.logo_path)
    settings.logo_path = filename
    db.session.commit()

    return jsonify(settings.to_dict()), 200
