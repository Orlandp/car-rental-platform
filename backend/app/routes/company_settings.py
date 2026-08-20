from flask import Blueprint, jsonify, request
from flask_login import login_required

from app.extensions import db
from app.models.company_settings import CompanySettings
from app.utils.decorators import admin_required

company_settings_bp = Blueprint("company_settings", __name__, url_prefix="/api/company-settings")

EDITABLE_FIELDS = ("name", "kra_pin", "address", "city", "phone", "email")


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

    if errors:
        return jsonify({"errors": errors}), 400

    db.session.commit()
    return jsonify(settings.to_dict()), 200
