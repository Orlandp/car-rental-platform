from datetime import date, datetime, time, timedelta, timezone

from flask import Blueprint, Response, jsonify, request
from flask_login import current_user, login_required

from app.extensions import db
from app.models.booking import (
    ACTIVE_STATUSES,
    CANCELLATION_WINDOW_HOURS,
    LATE_FEE_MULTIPLIER,
    STATUS_CANCELLED,
    STATUS_COMPLETED,
    STATUS_CONFIRMED,
    STATUS_PENDING,
    VALID_STATUSES,
    Booking,
)
from app.models.company_settings import CompanySettings
from app.models.invoice import Invoice
from app.models.payment import STATUS_PAID, STATUS_REFUNDED, Payment
from app.models.user import RENTER_ROLES, VERIFICATION_VERIFIED, User
from app.models.vehicle import Vehicle
from app.utils.decorators import admin_required
from app.utils.pdf import render_invoice_pdf

bookings_bp = Blueprint("bookings", __name__, url_prefix="/api/bookings")

MAX_RENTAL_DAYS = 90


def _parse_date(value, field_name, errors):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        errors[field_name] = "must be a date in YYYY-MM-DD format"
        return None


def _has_overlap(vehicle_id, start_date, end_date, exclude_booking_id=None):
    query = Booking.query.filter(
        Booking.vehicle_id == vehicle_id,
        Booking.status.in_(ACTIVE_STATUSES),
        Booking.start_date < end_date,
        Booking.end_date > start_date,
    )
    if exclude_booking_id:
        query = query.filter(Booking.id != exclude_booking_id)
    return query.first() is not None


def _build_booking(data, *, client_id, created_by_id, allow_price_override=False):
    errors = {}

    vehicle = None
    vehicle_id = data.get("vehicle_id")
    if not vehicle_id:
        errors["vehicle_id"] = "vehicle_id is required"
    else:
        # Lock the vehicle row for the rest of this transaction so two concurrent
        # bookings for the same vehicle/date-range can't both pass the overlap
        # check before either commits (closes the check-then-insert race).
        vehicle = Vehicle.query.with_for_update().get(vehicle_id)
        if vehicle is None:
            errors["vehicle_id"] = "vehicle not found"

    start_date = _parse_date(data.get("start_date"), "start_date", errors)
    end_date = _parse_date(data.get("end_date"), "end_date", errors)

    if start_date and end_date and end_date <= start_date:
        errors["end_date"] = "end_date must be after start_date"

    if start_date and start_date < date.today():
        errors["start_date"] = "start_date cannot be in the past"

    if start_date and end_date and end_date > start_date and (end_date - start_date).days > MAX_RENTAL_DAYS:
        errors["end_date"] = f"rental period cannot exceed {MAX_RENTAL_DAYS} days"

    if errors:
        return None, errors

    if _has_overlap(vehicle.id, start_date, end_date):
        return None, {"vehicle_id": "vehicle is already booked for those dates"}

    days = (end_date - start_date).days
    settings = CompanySettings.get_solo()

    with_driver = bool(data.get("with_driver"))
    driver_rate = float(settings.driver_daily_rate) if with_driver else 0.0

    total_price = round(days * (float(vehicle.price_per_day) + driver_rate), 2)

    override = data.get("total_price")
    if allow_price_override and override not in (None, ""):
        try:
            total_price = round(float(override), 2)
            if total_price < 0:
                return None, {"total_price": "total_price must be >= 0"}
        except (TypeError, ValueError):
            return None, {"total_price": "total_price must be a number"}

    deposit_amount = round(total_price * float(settings.deposit_percentage) / 100, 2)

    booking = Booking(
        vehicle_id=vehicle.id,
        client_id=client_id,
        created_by_id=created_by_id,
        start_date=start_date,
        end_date=end_date,
        total_price=total_price,
        deposit_amount=deposit_amount,
        with_driver=with_driver,
        driver_rate=driver_rate,
        guest_name=data.get("guest_name"),
        guest_phone=data.get("guest_phone"),
        guest_email=data.get("guest_email"),
    )
    return booking, None


def _issue_invoice(booking):
    vat_rate = CompanySettings.get_solo().vat_rate
    invoice = Invoice(
        booking_id=booking.id,
        amount=booking.total_price,
        vat_rate=vat_rate,
        invoice_number="",
    )
    db.session.add(invoice)
    db.session.flush()
    invoice.invoice_number = f"INV-{invoice.id:06d}"
    return invoice


def _can_view(booking):
    return current_user.is_admin or booking.client_id == current_user.id


@bookings_bp.post("")
@login_required
def create_booking():
    if current_user.verification_status != VERIFICATION_VERIFIED:
        return jsonify(
            {
                "error": "verify your driver's license and ID before booking",
                "verification_status": current_user.verification_status,
            }
        ), 403

    data = request.get_json(silent=True) or {}

    # A client verified without a driver's license on file has no legal way to drive the
    # vehicle themself - every one of their bookings must include a professional driver.
    if not current_user.driver_license_number and not data.get("with_driver"):
        return jsonify(
            {
                "error": "you have no driver's license on file, so this booking must "
                "include a professional driver",
                "errors": {"with_driver": "required — no driver's license on file"},
            }
        ), 400

    booking, errors = _build_booking(
        data, client_id=current_user.id, created_by_id=current_user.id
    )
    if errors:
        return jsonify({"errors": errors}), 400

    db.session.add(booking)
    db.session.flush()
    booking.reference = f"KR-{booking.id:06d}"
    invoice = _issue_invoice(booking)
    db.session.commit()

    return jsonify({"booking": booking.to_dict(), "invoice": invoice.to_dict()}), 201


@bookings_bp.post("/manual")
@admin_required
def create_manual_booking():
    data = request.get_json(silent=True) or {}

    client_id = data.get("client_id")
    if client_id:
        client = User.query.get(client_id)
        if client is None or client.role not in RENTER_ROLES:
            return jsonify({"errors": {"client_id": "client or company not found"}}), 400
    else:
        if not (data.get("guest_name") and data.get("guest_phone")):
            return jsonify(
                {"errors": {"guest_name": "guest_name and guest_phone are required when no client_id is given"}}
            ), 400

    booking, errors = _build_booking(
        data, client_id=client_id, created_by_id=current_user.id, allow_price_override=True
    )
    if errors:
        return jsonify({"errors": errors}), 400

    db.session.add(booking)
    db.session.flush()
    booking.reference = f"KR-{booking.id:06d}"
    invoice = _issue_invoice(booking)
    db.session.commit()

    return jsonify({"booking": booking.to_dict(), "invoice": invoice.to_dict()}), 201


@bookings_bp.get("")
@login_required
def list_bookings():
    query = Booking.query
    if not current_user.is_admin:
        query = query.filter_by(client_id=current_user.id)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    bookings = query.order_by(Booking.id.desc()).all()
    return jsonify([b.to_dict() for b in bookings]), 200


@bookings_bp.get("/<int:booking_id>")
@login_required
def get_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(booking.to_dict()), 200


@bookings_bp.patch("/<int:booking_id>")
@login_required
def update_booking_status(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}

    if "total_price" not in data and "status" not in data:
        return jsonify({"error": "status or total_price is required"}), 400

    new_total_price = None
    if "total_price" in data:
        if not current_user.is_admin:
            return jsonify({"error": "only an admin can change the agreed amount"}), 403
        try:
            new_total_price = round(float(data["total_price"]), 2)
            if new_total_price < 0:
                return jsonify({"errors": {"total_price": "total_price must be >= 0"}}), 400
        except (TypeError, ValueError):
            return jsonify({"errors": {"total_price": "total_price must be a number"}}), 400

    if "status" in data:
        new_status = data.get("status")
        if new_status not in VALID_STATUSES:
            return jsonify({"errors": {"status": f"must be one of {sorted(VALID_STATUSES)}"}}), 400

        if not current_user.is_admin:
            if new_status != STATUS_CANCELLED:
                return jsonify({"error": "clients may only cancel a booking"}), 403
            if booking.status not in (STATUS_PENDING, STATUS_CONFIRMED):
                return jsonify(
                    {"error": "this booking can no longer be cancelled"}
                ), 403
            hours_until_start = (
                datetime.combine(booking.start_date, time.min) - datetime.utcnow()
            ).total_seconds() / 3600
            if hours_until_start < CANCELLATION_WINDOW_HOURS:
                return jsonify(
                    {
                        "error": f"cancellations within {CANCELLATION_WINDOW_HOURS} hours of the "
                        "rental start are not permitted online — please contact support"
                    }
                ), 403

        if new_status == STATUS_CANCELLED and booking.status != STATUS_CANCELLED:
            booking.cancelled_at = datetime.now(timezone.utc)
            for payment in booking.payments:
                if payment.status == STATUS_PAID:
                    payment.status = STATUS_REFUNDED
                    payment.refunded_at = datetime.now(timezone.utc)

        booking.status = new_status

    if new_total_price is not None:
        booking.total_price = new_total_price
        invoice = Invoice.query.filter_by(booking_id=booking.id).first()
        if invoice:
            invoice.amount = new_total_price

    db.session.commit()
    return jsonify(booking.to_dict()), 200


@bookings_bp.patch("/<int:booking_id>/return")
@admin_required
def return_booking(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if booking.status == STATUS_CANCELLED:
        return jsonify({"error": "a cancelled booking cannot be marked as returned"}), 400

    data = request.get_json(silent=True) or {}
    errors = {}

    return_date = _parse_date(
        data.get("actual_return_date") or date.today().isoformat(),
        "actual_return_date",
        errors,
    )
    if errors:
        return jsonify({"errors": errors}), 400

    if "late_fee" in data:
        try:
            late_fee = round(float(data["late_fee"]), 2)
            if late_fee < 0:
                errors["late_fee"] = "late_fee must be >= 0"
        except (TypeError, ValueError):
            errors["late_fee"] = "late_fee must be a number"
        if errors:
            return jsonify({"errors": errors}), 400
    else:
        late_days = max(0, (return_date - booking.end_date).days)
        late_fee = round(late_days * float(booking.vehicle.price_per_day) * LATE_FEE_MULTIPLIER, 2)

    booking.actual_return_date = return_date
    booking.late_fee = late_fee
    booking.status = STATUS_COMPLETED
    db.session.commit()
    return jsonify(booking.to_dict()), 200


@bookings_bp.get("/<int:booking_id>/invoice")
@login_required
def get_invoice(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403

    invoice = Invoice.query.filter_by(booking_id=booking.id).first()
    if invoice is None:
        return jsonify({"error": "invoice not found"}), 404
    return jsonify(invoice.to_dict()), 200


@bookings_bp.patch("/<int:booking_id>/invoice")
@admin_required
def update_invoice(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    invoice = Invoice.query.filter_by(booking_id=booking.id).first()
    if invoice is None:
        return jsonify({"error": "invoice not found"}), 404

    data = request.get_json(silent=True) or {}
    errors = {}

    if "vat_rate" in data:
        try:
            vat_rate = round(float(data["vat_rate"]), 2)
            if vat_rate < 0 or vat_rate > 100:
                errors["vat_rate"] = "vat_rate must be between 0 and 100"
        except (TypeError, ValueError):
            errors["vat_rate"] = "vat_rate must be a number"

    if "amount" in data:
        try:
            amount = round(float(data["amount"]), 2)
            if amount < 0:
                errors["amount"] = "amount must be >= 0"
        except (TypeError, ValueError):
            errors["amount"] = "amount must be a number"

    if errors:
        return jsonify({"errors": errors}), 400

    if "vat_rate" in data:
        invoice.vat_rate = vat_rate
    if "amount" in data:
        invoice.amount = amount
        booking.total_price = amount

    db.session.commit()
    return jsonify(invoice.to_dict()), 200


@bookings_bp.get("/<int:booking_id>/invoice/pdf")
@login_required
def get_invoice_pdf(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403

    invoice = Invoice.query.filter_by(booking_id=booking.id).first()
    if invoice is None:
        return jsonify({"error": "invoice not found"}), 404

    company = CompanySettings.get_solo()
    pdf_bytes = render_invoice_pdf(invoice, booking, company)

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'
        },
    )
