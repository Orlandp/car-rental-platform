import pytest

from app.models.user import User
from app.routes.bookings import _has_overlap
from app.models.booking import Booking, STATUS_PENDING
from app.utils.kenya import normalize_kenyan_phone


def test_password_is_hashed_not_plaintext(db):
    user = User(name="Jane", username="jane", email="jane@example.com")
    user.set_password("supersecret")
    assert user.password_hash != "supersecret"
    assert user.check_password("supersecret")
    assert not user.check_password("wrongpassword")


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("0712345678", "254712345678"),
        ("0112345678", "254112345678"),
        ("+254712345678", "254712345678"),
        ("254712345678", "254712345678"),
    ],
)
def test_normalize_valid_kenyan_phone(raw, expected):
    assert normalize_kenyan_phone(raw) == expected


@pytest.mark.parametrize("raw", ["0812345678", "712345678", "not-a-phone", "0712345"])
def test_normalize_invalid_kenyan_phone_raises(raw):
    with pytest.raises(ValueError):
        normalize_kenyan_phone(raw)


def test_overlap_detection(db, sample_vehicle):
    from datetime import date

    creator = User(name="Creator", username="creator", email="creator@example.com")
    creator.set_password("password123")
    db.session.add(creator)
    db.session.commit()

    booking = Booking(
        vehicle_id=sample_vehicle.id,
        client_id=None,
        created_by_id=creator.id,
        start_date=date(2030, 1, 5),
        end_date=date(2030, 1, 10),
        total_price=100,
        status=STATUS_PENDING,
    )
    db.session.add(booking)
    db.session.commit()

    # Overlapping range
    assert _has_overlap(sample_vehicle.id, date(2030, 1, 8), date(2030, 1, 12)) is True
    # Touching but not overlapping (end == start of existing)
    assert _has_overlap(sample_vehicle.id, date(2030, 1, 10), date(2030, 1, 15)) is False
    # Fully separate range
    assert _has_overlap(sample_vehicle.id, date(2030, 2, 1), date(2030, 2, 5)) is False


def test_pricing_and_deposit_with_driver(client, make_client_user, sample_vehicle):
    make_client_user()
    res = client.post(
        "/api/bookings",
        json={
            "vehicle_id": sample_vehicle.id,
            "start_date": "2030-03-01",
            "end_date": "2030-03-04",
            "with_driver": True,
        },
    )
    assert res.status_code == 201
    booking = res.get_json()["booking"]
    # 3 days @ 4000 (vehicle) + 3 days @ 2500 (default driver rate) = 19500
    assert booking["total_price"] == 19500.0
    # 30% default deposit, integer KES
    assert booking["deposit_amount"] == 5850.0
    assert booking["reference"].startswith("KR-")
