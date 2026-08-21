from datetime import datetime, timezone

from flask import Blueprint, Response, jsonify, request
from flask_login import current_user, login_required

from app.extensions import db
from app.models.booking import STATUS_CONFIRMED, STATUS_PENDING, Booking
from app.models.company_settings import CompanySettings
from app.models.invoice import Invoice
from app.models.payment import (
    METHOD_MPESA,
    STATUS_FAILED,
    STATUS_PAID,
    STATUS_PENDING as PAYMENT_STATUS_PENDING,
    VALID_METHODS,
    Payment,
)
from app.models.receipt import Receipt
from app.routes.bookings import _can_view
from app.utils.decorators import admin_required
from app.utils.pdf import render_receipt_pdf
from app.utils.kenya import normalize_kenyan_phone
from app.utils.mpesa import MpesaError, initiate_stk_push, parse_stk_callback

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
    and issue a receipt. Shared by the M-Pesa STK callback (recorded_by_id=None)
    and the admin manual-confirm path."""
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
        db.session.add(payment)
        db.session.flush()
        try:
            stk_response = initiate_stk_push(
                phone_number=phone_number,
                amount=amount,
                account_reference=booking.reference or f"BK{booking.id}",
                transaction_desc=f"Rental {booking.reference or booking.id}",
            )
        except MpesaError as exc:
            payment.status = STATUS_FAILED
            payment.result_desc = str(exc)
            db.session.commit()
            return jsonify({"error": f"M-Pesa request failed: {exc}"}), 502

        payment.merchant_request_id = stk_response.get("MerchantRequestID")
        payment.checkout_request_id = stk_response.get("CheckoutRequestID")
        db.session.commit()
        # Payment stays "pending" until Safaricom POSTs the result to
        # /api/mpesa/callback (see mpesa_callback below) - the frontend polls
        # GET /bookings/<id>/payments until this row's status changes.
        return jsonify({"payment": payment.to_dict(), "receipt": None}), 201

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


@payments_bp.post("/mpesa/callback")
def mpesa_callback():
    """Safaricom POSTs here with the STK push result - no auth (Safaricom isn't
    a logged-in user), matched back to our Payment row via checkout_request_id.

    Always acknowledge with ResultCode 0 even when we ignore the payload (e.g.
    unknown checkout_request_id, already-processed payment) - returning an
    error here just makes Safaricom retry the same callback repeatedly.
    """
    payload = request.get_json(silent=True) or {}
    result = parse_stk_callback(payload)
    checkout_request_id = result["checkout_request_id"]

    if not checkout_request_id:
        return jsonify({"ResultCode": 0, "ResultDesc": "ignored - no CheckoutRequestID"}), 200

    payment = Payment.query.filter_by(checkout_request_id=checkout_request_id).first()
    if payment is None or payment.status != PAYMENT_STATUS_PENDING:
        return jsonify({"ResultCode": 0, "ResultDesc": "ignored"}), 200

    if result["result_code"] == 0:
        if result["mpesa_receipt"]:
            payment.mpesa_receipt = result["mpesa_receipt"]
        # No admin/staff involved - confirmed automatically by Safaricom's callback.
        _confirm_payment(payment, recorded_by_id=None)
    else:
        payment.status = STATUS_FAILED
        payment.result_desc = result["result_desc"]

    db.session.commit()
    return jsonify({"ResultCode": 0, "ResultDesc": "ok"}), 200


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


@payments_bp.get("/receipts/<int:receipt_id>/pdf")
@login_required
def get_receipt_pdf(receipt_id):
    receipt = Receipt.query.get_or_404(receipt_id)
    booking = receipt.payment.booking
    if not _can_view(booking):
        return jsonify({"error": "forbidden"}), 403

    company = CompanySettings.get_solo()
    invoice = Invoice.query.filter_by(booking_id=booking.id).first()
    pdf_bytes = render_receipt_pdf(receipt, receipt.payment, booking, company, invoice)

    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{receipt.receipt_number}.pdf"'
        },
    )
