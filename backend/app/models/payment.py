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
VALID_STATUSES = {STATUS_PENDING, STATUS_PAID, STATUS_FAILED}


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("bookings.id"), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    method = db.Column(db.String(20), nullable=False)
    # Only used for method="mpesa" for now; will feed the Daraja STK Push once that's wired in.
    phone_number = db.Column(db.String(20), nullable=True)
    status = db.Column(db.String(20), nullable=False, default=STATUS_PENDING)
    paid_at = db.Column(db.DateTime, nullable=True)
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
            "status": self.status,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "recorded_by_id": self.recorded_by_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
