from flask import Blueprint, jsonify

from app.models.booking import (
    STATUS_CANCELLED,
    STATUS_COMPLETED,
    STATUS_CONFIRMED,
    STATUS_PENDING,
    Booking,
)
from app.models.payment import STATUS_PAID, Payment
from app.models.vehicle import STATUS_AVAILABLE, Vehicle
from app.utils.decorators import admin_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.get("/stats")
@admin_required
def get_stats():
    total_revenue = (
        Payment.query.filter_by(status=STATUS_PAID)
        .with_entities(Payment.amount)
        .all()
    )
    return jsonify(
        {
            "vehicles": {
                "total": Vehicle.query.count(),
                "available": Vehicle.query.filter_by(status=STATUS_AVAILABLE).count(),
            },
            "bookings": {
                "total": Booking.query.count(),
                "pending": Booking.query.filter_by(status=STATUS_PENDING).count(),
                "confirmed": Booking.query.filter_by(status=STATUS_CONFIRMED).count(),
                "completed": Booking.query.filter_by(status=STATUS_COMPLETED).count(),
                "cancelled": Booking.query.filter_by(status=STATUS_CANCELLED).count(),
            },
            "payments": {
                "pending": Payment.query.filter_by(status="pending").count(),
                "total_revenue": round(sum(float(a[0]) for a in total_revenue), 2),
            },
        }
    ), 200
