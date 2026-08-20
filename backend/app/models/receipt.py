from datetime import datetime, timezone

from app.extensions import db


class Receipt(db.Model):
    __tablename__ = "receipts"

    id = db.Column(db.Integer, primary_key=True)
    payment_id = db.Column(
        db.Integer, db.ForeignKey("payments.id"), nullable=False, unique=True
    )
    receipt_number = db.Column(db.String(20), unique=True, nullable=False)
    issued_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    issued_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    payment = db.relationship("Payment")
    issued_by = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "receipt_number": self.receipt_number,
            "payment_id": self.payment_id,
            "booking_id": self.payment.booking_id if self.payment else None,
            "amount": float(self.payment.amount) if self.payment else None,
            "issued_by_id": self.issued_by_id,
            "issued_at": self.issued_at.isoformat() if self.issued_at else None,
        }
