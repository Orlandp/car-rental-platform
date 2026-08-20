from datetime import datetime, timezone

from app.extensions import db

TYPE_ELECTRIC_CAR = "electric_car"
TYPE_TUK_TUK = "tuk_tuk"
TYPE_FUEL_CAR = "fuel_car"
VALID_TYPES = {TYPE_ELECTRIC_CAR, TYPE_TUK_TUK, TYPE_FUEL_CAR}

STATUS_AVAILABLE = "available"
STATUS_BOOKED = "booked"
STATUS_MAINTENANCE = "maintenance"
VALID_STATUSES = {STATUS_AVAILABLE, STATUS_BOOKED, STATUS_MAINTENANCE}

# Body-style category, independent of `type` (which is the Kenya-specific
# fuel/vehicle-class distinction: electric_car / tuk_tuk / fuel_car).
CATEGORY_SEDAN = "sedan"
CATEGORY_SUV = "suv"
CATEGORY_VAN = "van"
CATEGORY_PICKUP = "pickup"
CATEGORY_MINIBUS = "minibus"
CATEGORY_TUK_TUK = "tuk_tuk"
CATEGORY_OTHER = "other"
VALID_CATEGORIES = {
    CATEGORY_SEDAN,
    CATEGORY_SUV,
    CATEGORY_VAN,
    CATEGORY_PICKUP,
    CATEGORY_MINIBUS,
    CATEGORY_TUK_TUK,
    CATEGORY_OTHER,
}

# Amenities/features a vehicle can be tagged with, shown to customers on the listing
# and booking flow. (key -> human label); VALID_FEATURES is just the key set.
FEATURE_LABELS = {
    "air_conditioning": "Air Conditioning",
    "heated_seats": "Heated Seats",
    "massage_seats": "Massage Seats",
    "leather_seats": "Leather Seats",
    "sunroof": "Sunroof",
    "bluetooth": "Bluetooth",
    "usb_charging": "USB Charging",
    "gps_navigation": "GPS Navigation",
    "cruise_control": "Cruise Control",
    "steering_wheel_controls": "Steering Wheel Controls",
    "reverse_camera": "Reverse Camera",
    "parking_sensors": "Parking Sensors",
    "keyless_entry": "Keyless Entry",
    "push_start": "Push-Button Start",
    "child_seat_compatible": "Child Seat Compatible",
    "wifi_hotspot": "WiFi Hotspot",
    "premium_sound_system": "Premium Sound System",
    "four_wheel_drive": "4-Wheel Drive",
    "automatic_transmission": "Automatic Transmission",
    "panoramic_roof": "Panoramic Roof",
}
VALID_FEATURES = set(FEATURE_LABELS)


class Vehicle(db.Model):
    __tablename__ = "vehicles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    category = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(100), nullable=True, index=True)
    make = db.Column(db.String(80))
    model = db.Column(db.String(80))
    year = db.Column(db.Integer)
    license_plate = db.Column(db.String(20), unique=True)
    price_per_day = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=STATUS_AVAILABLE)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(500))
    # List of keys from FEATURE_LABELS, e.g. ["heated_seats", "sunroof"].
    features = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "category": self.category,
            "location": self.location,
            "make": self.make,
            "model": self.model,
            "year": self.year,
            "license_plate": self.license_plate,
            "price_per_day": float(self.price_per_day) if self.price_per_day is not None else None,
            "status": self.status,
            "description": self.description,
            "image_url": self.image_url,
            "features": self.features or [],
        }
