from datetime import datetime, timezone

from app.extensions import db
from app.models.company_settings import DEFAULT_VAT_RATE


class Invoice(db.Model):
    __tablename__ = "invoices"

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(
        db.Integer, db.ForeignKey("bookings.id"), nullable=False, unique=True
    )
    invoice_number = db.Column(db.String(20), unique=True, nullable=False)
    # Amount is VAT-inclusive (what the customer is actually charged).
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    # Frozen at issue time from CompanySettings.vat_rate so later rate changes
    # don't retroactively alter already-issued invoices.
    vat_rate = db.Column(db.Numeric(5, 2), nullable=False, default=DEFAULT_VAT_RATE)
    issued_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    booking = db.relationship("Booking")

    @property
    def vat_breakdown(self):
        total = float(self.amount)
        rate = float(self.vat_rate)
        subtotal = round(total / (1 + rate / 100), 2) if rate else total
        vat_amount = round(total - subtotal, 2)
        return subtotal, vat_amount, total

    def to_dict(self):
        subtotal, vat_amount, total = self.vat_breakdown
        return {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "booking_id": self.booking_id,
            "amount": total,
            "vat_rate": float(self.vat_rate),
            "subtotal": subtotal,
            "vat_amount": vat_amount,
            "total_amount": total,
            "issued_at": self.issued_at.isoformat() if self.issued_at else None,
        }
