from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app.extensions import db
from app.models.booking import STATUS_CONFIRMED, STATUS_PENDING, Booking
from app.models.payment import METHOD_MPESA, STATUS_PAID, VALID_METHODS, Payment
from app.models.receipt import Receipt
from app.routes.bookings import _can_view
from app.utils.decorators import admin_required
from app.utils.kenya import (
    generate_mock_mpesa_receipt,
    generate_mock_transaction_id,
    normalize_kenyan_phone,
)

payments_bp = Blueprint("payments", __name__, url_prefix="/api")


def _paid_total(booking):
    # Queried fresh rather than via the booking.payments relationship, whose
    # in-session collection cache can go stale within a request that both reads
    # it early (e.g. via _outstanding_balance) and adds a new payment afterwards.
    total = (
        db.session.query(db.func.coalesce(db.func.sum(Payment.amount), 0))
        .filter(Payment.booking_id == booking.id, Payment.status == STATUS_PAID)
        .scalar()
    )
    return float(total)


def _outstanding_balance(booking):
    amount_due = float(booking.total_price) + float(booking.late_fee)
    return round(amount_due - _paid_total(booking), 2)


def _confirm_payment(payment, recorded_by_id):
    """Mark a payment paid, flip the booking to confirmed once the deposit is met,
    and issue a receipt. Shared by the instant mock-M-Pesa path and the admin
    manual-confirm path."""
    payment.status = STATUS_PAID
    payment.paid_at = datetime.now(timezone.utc)
    payment.recorded_by_id = recorded_by_id
    db.session.flush()

    booking = payment.booking
    if booking.status == STATUS_PENDING and _paid_total(booking) >= float(booking.deposit_amount):
        booking.status = STATUS_CONFIRMED

    receipt = Receipt(payment_id=payment.id, issued_by_id=recorded_by_id, receipt_number="")
    db.session.add(receipt)
    db.session.flush()
    receipt.receipt_number = f"RCT-{receipt.id:06d}"
    return receipt


@payments_bp.post("/bookings/<int:booking_id>/payments")
@login_required
def create_payment(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403

    outstanding = _outstanding_balance(booking)
    if outstanding <= 0:
        return jsonify({"error": "this booking is already fully paid"}), 400

    data = request.get_json(silent=True) or {}
    errors = {}

    method = data.get("method")
    if method not in VALID_METHODS:
        errors["method"] = f"must be one of {sorted(VALID_METHODS)}"

    phone_number = None
    if method == METHOD_MPESA:
        raw_phone = (data.get("phone_number") or "").strip()
        if not raw_phone:
            errors["phone_number"] = "phone_number is required for mpesa payments"
        else:
            try:
                phone_number = normalize_kenyan_phone(raw_phone)
            except ValueError as exc:
                errors["phone_number"] = str(exc)

    try:
        amount = round(float(data.get("amount")), 2)
        if amount <= 0:
            errors["amount"] = "amount must be greater than 0"
    except (TypeError, ValueError):
        amount = None
        errors["amount"] = "amount must be a number"

    if amount is not None and not errors:
        # First payment towards a still-pending booking must cover at least the
        # deposit; later top-up payments just need to be a positive amount that
        # doesn't overshoot what's left owing.
        already_paid = any(p.status == STATUS_PAID for p in booking.payments)
        min_payable = 0.01 if already_paid else min(float(booking.deposit_amount), outstanding)
        if amount > outstanding:
            errors["amount"] = f"amount cannot exceed the outstanding balance ({outstanding})"
        elif amount < min_payable:
            errors["amount"] = f"first payment must be at least the deposit ({min_payable})"

    if errors:
        return jsonify({"errors": errors}), 400

    payment = Payment(
        booking_id=booking.id, amount=amount, method=method, phone_number=phone_number
    )

    if method == METHOD_MPESA:
        # No real Daraja/STK-push integration yet - simulate an instant successful
        # M-Pesa callback so the booking flow is testable end-to-end.
        payment.transaction_id = generate_mock_transaction_id()
        payment.mpesa_receipt = generate_mock_mpesa_receipt()
        db.session.add(payment)
        db.session.flush()
        receipt = _confirm_payment(payment, current_user.id)
        db.session.commit()
        return jsonify({"payment": payment.to_dict(), "receipt": receipt.to_dict()}), 201

    db.session.add(payment)
    db.session.commit()
    return jsonify({"payment": payment.to_dict(), "receipt": None}), 201


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

    receipt = _confirm_payment(payment, current_user.id)
    db.session.commit()
    return jsonify({"payment": payment.to_dict(), "receipt": receipt.to_dict()}), 200


@payments_bp.get("/bookings/<int:booking_id>/receipts")
@login_required
def get_booking_receipts(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403

    receipts = (
        Receipt.query.join(Payment)
        .filter(Payment.booking_id == booking.id)
        .order_by(Receipt.id.asc())
        .all()
    )
    return jsonify([r.to_dict() for r in receipts]), 200
