import pytest

from app import create_app
from app.config import TestConfig
from app.extensions import db as _db
from app.models.user import ROLE_ADMIN, ROLE_CLIENT, User
from app.models.vehicle import STATUS_AVAILABLE, TYPE_FUEL_CAR, Vehicle


@pytest.fixture()
def app():
    application = create_app(TestConfig)
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
def make_client_user(client):
    """Register+login a client user, returning (client, user_dict). Uses a fresh
    session per call - logs out first if someone else is already logged in."""

    def _make(username="jane", email="jane@example.com", phone="0712345678"):
        client.post("/api/auth/logout")
        res = _register(client, username=username, email=email, phone=phone)
        return res.get_json()

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
