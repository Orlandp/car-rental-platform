from datetime import datetime, timezone

from app.extensions import db

STATUS_PENDING = "pending"
STATUS_CONFIRMED = "confirmed"
STATUS_CANCELLED = "cancelled"
STATUS_COMPLETED = "completed"
VALID_STATUSES = {STATUS_PENDING, STATUS_CONFIRMED, STATUS_CANCELLED, STATUS_COMPLETED}

ACTIVE_STATUSES = {STATUS_PENDING, STATUS_CONFIRMED}

# Multiplier applied to the vehicle's daily rate for each day a car comes back late.
LATE_FEE_MULTIPLIER = 1.5


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    guest_name = db.Column(db.String(120))
    guest_phone = db.Column(db.String(40))
    guest_email = db.Column(db.String(255))

    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    total_price = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=STATUS_PENDING)

    actual_return_date = db.Column(db.Date, nullable=True)
    late_fee = db.Column(db.Numeric(10, 2), nullable=False, default=0)

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
        return {
            "id": self.id,
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
            "status": self.status,
            "actual_return_date": self.actual_return_date.isoformat()
            if self.actual_return_date
            else None,
            "late_fee": float(self.late_fee),
            "amount_due": float(self.total_price) + float(self.late_fee),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
