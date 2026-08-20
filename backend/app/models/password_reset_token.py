from datetime import datetime, timezone

from app.extensions import db


def _utcnow():
    # Naive UTC to match this column's plain DateTime type across DB backends.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    # SHA-256 hex digest of the raw token; the raw token itself is never stored.
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow)

    user = db.relationship("User")

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > _utcnow()
