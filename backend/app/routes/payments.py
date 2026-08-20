from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app.extensions import db
from app.models.booking import STATUS_CONFIRMED, STATUS_PENDING, Booking
from app.models.payment import METHOD_MPESA, STATUS_PAID, VALID_METHODS, Payment
from app.models.receipt import Receipt
from app.routes.bookings import _can_view
from app.utils.decorators import admin_required

payments_bp = Blueprint("payments", __name__, url_prefix="/api")


def _outstanding_balance(booking):
    paid_total = sum(
        float(p.amount) for p in booking.payments if p.status == STATUS_PAID
    )
    amount_due = float(booking.total_price) + float(booking.late_fee)
    return round(amount_due - paid_total, 2)


@payments_bp.post("/bookings/<int:booking_id>/payments")
@login_required
def create_payment(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    errors = {}

    method = data.get("method")
    if method not in VALID_METHODS:
        errors["method"] = f"must be one of {sorted(VALID_METHODS)}"

    phone_number = (data.get("phone_number") or "").strip() or None
    if method == METHOD_MPESA and not phone_number:
        errors["phone_number"] = "phone_number is required for mpesa payments"

    try:
        amount = round(float(data.get("amount")), 2)
        if amount <= 0:
            errors["amount"] = "amount must be greater than 0"
    except (TypeError, ValueError):
        amount = None
        errors["amount"] = "amount must be a number"

    if not errors:
        outstanding = _outstanding_balance(booking)
        if amount != outstanding:
            errors["amount"] = f"amount must equal the outstanding balance ({outstanding})"

    if errors:
        return jsonify({"errors": errors}), 400

    payment = Payment(
        booking_id=booking.id, amount=amount, method=method, phone_number=phone_number
    )
    db.session.add(payment)
    db.session.commit()
    return jsonify(payment.to_dict()), 201


@payments_bp.get("/bookings/<int:booking_id>/payments")
@login_required
def list_booking_payments(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403
    return jsonify([p.to_dict() for p in booking.payments]), 200


@payments_bp.get("/payments")
@admin_required
def list_payments():
    query = Payment.query
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    payments = query.order_by(Payment.id.desc()).all()
    return jsonify([p.to_dict() for p in payments]), 200


@payments_bp.patch("/payments/<int:payment_id>/confirm")
@admin_required
def confirm_payment(payment_id):
    payment = Payment.query.get_or_404(payment_id)
    if payment.status == STATUS_PAID:
        return jsonify({"error": "payment already confirmed"}), 409

    payment.status = STATUS_PAID
    payment.paid_at = datetime.now(timezone.utc)
    payment.recorded_by_id = current_user.id

    booking = payment.booking
    if booking.status == STATUS_PENDING:
        booking.status = STATUS_CONFIRMED

    receipt = Receipt(payment_id=payment.id, issued_by_id=current_user.id, receipt_number="")
    db.session.add(receipt)
    db.session.flush()
    receipt.receipt_number = f"RCT-{receipt.id:06d}"

    db.session.commit()
    return jsonify({"payment": payment.to_dict(), "receipt": receipt.to_dict()}), 200


@payments_bp.get("/bookings/<int:booking_id>/receipt")
@login_required
def get_booking_receipt(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403

    receipt = (
        Receipt.query.join(Payment)
        .filter(Payment.booking_id == booking.id, Payment.status == STATUS_PAID)
        .first()
    )
    if receipt is None:
        return jsonify({"error": "no receipt yet for this booking"}), 404
    return jsonify(receipt.to_dict()), 200
