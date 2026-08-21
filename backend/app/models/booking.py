from datetime import datetime, timezone

from app.extensions import db
from app.models.payment import STATUS_PAID

STATUS_PENDING = "pending"
STATUS_CONFIRMED = "confirmed"
STATUS_CANCELLED = "cancelled"
STATUS_COMPLETED = "completed"
VALID_STATUSES = {STATUS_PENDING, STATUS_CONFIRMED, STATUS_CANCELLED, STATUS_COMPLETED}

ACTIVE_STATUSES = {STATUS_PENDING, STATUS_CONFIRMED}

# Multiplier applied to the vehicle's daily rate for each day a car comes back late.
LATE_FEE_MULTIPLIER = 1.5

# A customer may only self-cancel a booking at least this many hours before start_date.
CANCELLATION_WINDOW_HOURS = 24


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    # Human-readable booking code, e.g. "KR-000042" - set right after insert once the id exists.
    reference = db.Column(db.String(20), unique=True, nullable=True, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    guest_name = db.Column(db.String(120))
    guest_phone = db.Column(db.String(40))
    guest_email = db.Column(db.String(255))

    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    total_price = db.Column(db.Numeric(10, 2), nullable=False)
    # 30% of total_price by default (CompanySettings.deposit_percentage), frozen at booking
    # time so a later percentage change doesn't retroactively alter an existing booking.
    deposit_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default=STATUS_PENDING)

    with_driver = db.Column(db.Boolean, nullable=False, default=False)
    # Daily driver rate snapshotted from CompanySettings.driver_daily_rate at booking time.
    driver_rate = db.Column(db.Numeric(10, 2), nullable=False, default=0)

    actual_return_date = db.Column(db.Date, nullable=True)
    late_fee = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    cancelled_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    vehicle = db.relationship("Vehicle")
    client = db.relationship("User", foreign_keys=[client_id])
    created_by = db.relationship("User", foreign_keys=[created_by_id])

    def to_dict(self):
        amount_due = float(self.total_price) + float(self.late_fee)
        paid_amount = round(
            sum(float(p.amount) for p in self.payments if p.status == STATUS_PAID), 2
        )
        return {
            "id": self.id,
            "reference": self.reference,
            "vehicle": {
                "id": self.vehicle.id,
                "name": self.vehicle.name,
                "type": self.vehicle.type,
                "price_per_day": float(self.vehicle.price_per_day),
            }
            if self.vehicle
            else None,
            "client": self.client.to_dict() if self.client else None,
            "guest_name": self.guest_name,
            "guest_phone": self.guest_phone,
            "guest_email": self.guest_email,
            "created_by_id": self.created_by_id,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "total_price": float(self.total_price),
            "deposit_amount": float(self.deposit_amount),
            "with_driver": self.with_driver,
            "driver_rate": float(self.driver_rate),
            "status": self.status,
            "actual_return_date": self.actual_return_date.isoformat()
            if self.actual_return_date
            else None,
            "late_fee": float(self.late_fee),
            "amount_due": amount_due,
            "paid_amount": paid_amount,
            "outstanding_balance": round(amount_due - paid_amount, 2),
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
