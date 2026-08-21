from datetime import datetime, timezone

from app.extensions import db

METHOD_CASH = "cash"
METHOD_BANK_TRANSFER = "bank_transfer"
METHOD_CARD = "card"
METHOD_MPESA = "mpesa"
METHOD_OTHER = "other"
VALID_METHODS = {METHOD_CASH, METHOD_BANK_TRANSFER, METHOD_CARD, METHOD_MPESA, METHOD_OTHER}

STATUS_PENDING = "pending"
STATUS_PAID = "paid"
STATUS_FAILED = "failed"
STATUS_REFUNDED = "refunded"
VALID_STATUSES = {STATUS_PENDING, STATUS_PAID, STATUS_FAILED, STATUS_REFUNDED}


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    method = db.Column(db.String(20), nullable=False)
    # Only used for method="mpesa". Stored normalized (254XXXXXXXXX) via
    # app.utils.kenya.normalize_kenyan_phone.
    phone_number = db.Column(db.String(20), nullable=True)
    transaction_id = db.Column(db.String(40), nullable=True)
    # Populated once Safaricom's STK callback (or an admin's manual confirm)
    # marks this paid.
    mpesa_receipt = db.Column(db.String(20), nullable=True)
    # Set when initiate_stk_push() succeeds; the STK callback is matched back to
    # this payment by checkout_request_id (see app.utils.mpesa).
    merchant_request_id = db.Column(db.String(60), nullable=True)
    checkout_request_id = db.Column(db.String(60), nullable=True, index=True)
    # Safaricom's ResultDesc on a failed/cancelled STK push (e.g. "Request
    # cancelled by user"), so the client/admin can see why it didn't go through.
    result_desc = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), nullable=False, default=STATUS_PENDING)
    paid_at = db.Column(db.DateTime, nullable=True)
    refunded_at = db.Column(db.DateTime, nullable=True)
    recorded_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    booking = db.relationship("Booking", backref="payments")
    recorded_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "amount": float(self.amount),
            "method": self.method,
            "phone_number": self.phone_number,
            "transaction_id": self.transaction_id,
            "mpesa_receipt": self.mpesa_receipt,
            "checkout_request_id": self.checkout_request_id,
            "result_desc": self.result_desc,
            "status": self.status,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "refunded_at": self.refunded_at.isoformat() if self.refunded_at else None,
            "recorded_by_id": self.recorded_by_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
