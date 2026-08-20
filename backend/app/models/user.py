from datetime import datetime, timezone

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db

ROLE_ADMIN = "admin"
ROLE_CLIENT = "client"
ROLE_COMPANY = "company"
VALID_ROLES = {ROLE_ADMIN, ROLE_CLIENT, ROLE_COMPANY}

# Roles that can hold bookings (rent vehicles), as opposed to ROLE_ADMIN which manages the platform.
RENTER_ROLES = {ROLE_CLIENT, ROLE_COMPANY}

# Identity verification (driver's license + national ID) is manual admin review, not an
# automated document-authenticity check - there's no NTSA/KYC-provider integration here.
VERIFICATION_UNVERIFIED = "unverified"
VERIFICATION_PENDING = "pending_review"
VERIFICATION_VERIFIED = "verified"
VERIFICATION_REJECTED = "rejected"
VALID_VERIFICATION_STATUSES = {
    VERIFICATION_UNVERIFIED,
    VERIFICATION_PENDING,
    VERIFICATION_VERIFIED,
    VERIFICATION_REJECTED,
}


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    # Nullable at the DB level so the migration doesn't break pre-existing rows;
    # required and validated at the API layer for every new registration.
    username = db.Column(db.String(50), unique=True, nullable=True, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    # Normalized to 254XXXXXXXXX by app.utils.kenya.normalize_kenyan_phone before storage.
    # Nullable at the DB level for the same reason username is (pre-existing rows), required
    # and validated at the API layer for every new registration.
    phone = db.Column(db.String(15), unique=True, nullable=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default=ROLE_CLIENT)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Identity verification - required before a client/company can book (see
    # app.routes.bookings.create_booking). Numbers and image paths are only ever exposed
    # via app.routes.verification (self or admin), never in the general to_dict below.
    driver_license_number = db.Column(db.String(40), nullable=True)
    national_id_number = db.Column(db.String(40), nullable=True)
    driver_license_image_path = db.Column(db.String(255), nullable=True)
    national_id_image_path = db.Column(db.String(255), nullable=True)
    verification_status = db.Column(
        db.String(20), nullable=False, default=VERIFICATION_UNVERIFIED
    )
    verification_notes = db.Column(db.Text, nullable=True)
    verification_submitted_at = db.Column(db.DateTime, nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    verified_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    def set_password(self, raw_password):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)

    @property
    def is_admin(self):
        return self.role == ROLE_ADMIN

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "username": self.username,
            "email": self.email,
            "phone": self.phone,
            "role": self.role,
            "verification_status": self.verification_status,
        }

    def to_verification_dict(self):
        """Fuller verification view - only ever returned to the user themself or an admin."""
        return {
            "user_id": self.id,
            "driver_license_number": self.driver_license_number,
            "national_id_number": self.national_id_number,
            "has_driver_license_image": bool(self.driver_license_image_path),
            "has_national_id_image": bool(self.national_id_image_path),
            "status": self.verification_status,
            "notes": self.verification_notes,
            "submitted_at": self.verification_submitted_at.isoformat()
            if self.verification_submitted_at
            else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "verified_by_id": self.verified_by_id,
        }
