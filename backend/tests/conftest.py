import pytest
from flask import g

from app import create_app
from app.config import TestConfig
from app.extensions import db as _db
from app.models.user import ROLE_ADMIN, ROLE_CLIENT, VERIFICATION_VERIFIED, User
from app.models.vehicle import STATUS_AVAILABLE, TYPE_FUEL_CAR, Vehicle


@pytest.fixture()
def app(tmp_path):
    application = create_app(TestConfig)
    application.config["VERIFICATION_UPLOAD_FOLDER"] = str(tmp_path / "verification")
    application.config["UPLOAD_FOLDER"] = str(tmp_path / "vehicles")

    # Test-only: fixtures below need an ambient app context so they can touch db.session
    # directly (outside of any request), but that same ambient context means Flask's
    # RequestContext.push() reuses it for every simulated test-client request instead of
    # pushing a fresh one - so Flask-Login's per-request g._login_user cache would
    # otherwise leak across different logged-in users within one test. Clearing it at the
    # start of every request neutralizes that; it's a pytest-only hook, never registered
    # by the real app factory, and has no effect on production (which never holds an
    # ambient app context across multiple real requests in the first place).
    @application.before_request
    def _reset_login_cache():
        g.pop("_login_user", None)

    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def db(app):
    return _db


@pytest.fixture()
def client(app):
    return app.test_client()


def _register(client, *, username, email, phone, password="password123", role=ROLE_CLIENT):
    return client.post(
        "/api/auth/register",
        json={
            "name": username.title(),
            "username": username,
            "email": email,
            "phone": phone,
            "password": password,
            "role": role,
        },
    )


@pytest.fixture()
def make_client_user(client, db):
    """Register+login a client user, returning the user dict. Uses a fresh session per
    call - logs out first if someone else is already logged in. Auto-verified by default
    (bypassing the real submit+admin-approve flow) so booking-flow tests unrelated to
    verification itself don't have to deal with it; pass verified=False to opt out."""

    def _make(username="jane", email="jane@example.com", phone="0712345678", verified=True):
        client.post("/api/auth/logout")
        res = _register(client, username=username, email=email, phone=phone)
        data = res.get_json()
        if verified and data and "id" in data:
            user = db.session.get(User, data["id"])
            user.verification_status = VERIFICATION_VERIFIED
            # Real verification always captures a DL number unless the renter explicitly
            # declared they have no license (see test_no_driver_license_requires_driver_option) -
            # set one here so this default fixture models the common case.
            user.driver_license_number = "1234567"
            db.session.commit()
        return data

    return _make


@pytest.fixture()
def admin_user(db):
    user = User(name="Admin", username="admin", email="admin@kenyarentals.co.ke", role=ROLE_ADMIN)
    user.set_password("Admin@12345")
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture()
def as_admin(client, admin_user):
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "admin", "password": "Admin@12345"})
    return client


@pytest.fixture()
def sample_vehicle(db):
    vehicle = Vehicle(
        name="Nissan Note",
        type=TYPE_FUEL_CAR,
        category="sedan",
        location="Nairobi CBD",
        price_per_day=4000,
        status=STATUS_AVAILABLE,
    )
    db.session.add(vehicle)
    db.session.commit()
    return vehicle
