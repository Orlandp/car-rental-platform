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
        }
