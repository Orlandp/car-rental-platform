from datetime import datetime, timezone
from decimal import Decimal

from app.extensions import db

DEFAULT_VAT_RATE = Decimal("16.00")


class CompanySettings(db.Model):
    __tablename__ = "company_settings"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, default="")
    kra_pin = db.Column(db.String(30), nullable=False, default="")
    address = db.Column(db.String(255), nullable=False, default="")
    city = db.Column(db.String(100), nullable=False, default="")
    phone = db.Column(db.String(40), nullable=False, default="")
    email = db.Column(db.String(255), nullable=False, default="")
    vat_rate = db.Column(db.Numeric(5, 2), nullable=False, default=DEFAULT_VAT_RATE)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    @classmethod
    def get_solo(cls):
        """Return the single company settings row, creating it with defaults if missing."""
        settings = cls.query.get(1)
        if settings is None:
            settings = cls(id=1, vat_rate=DEFAULT_VAT_RATE)
            db.session.add(settings)
            db.session.commit()
        return settings

    def to_dict(self):
        return {
            "name": self.name,
            "kra_pin": self.kra_pin,
            "address": self.address,
            "city": self.city,
            "phone": self.phone,
            "email": self.email,
            "vat_rate": float(self.vat_rate),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
