def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


def test_register_duplicate_email_rejected(client, make_client_user):
    make_client_user(username="jane", email="dupe@example.com", phone="0712345678")
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Jane Two",
            "username": "janetwo",
            "email": "dupe@example.com",
            "phone": "0722345678",
            "password": "password123",
        },
    )
    assert res.status_code == 409


def test_register_invalid_phone_rejected(client):
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Bad Phone",
            "username": "badphone",
            "email": "badphone@example.com",
            "phone": "0812345678",
            "password": "password123",
        },
    )
    assert res.status_code == 400


def test_login_logout(client, make_client_user):
    make_client_user(username="jane", email="jane@example.com", phone="0712345678")
    client.post("/api/auth/logout")

    bad = client.post("/api/auth/login", json={"username": "jane", "password": "wrong"})
    assert bad.status_code == 401

    good = client.post("/api/auth/login", json={"username": "jane", "password": "password123"})
    assert good.status_code == 200

    me = client.get("/api/auth/me")
    assert me.status_code == 200

    client.post("/api/auth/logout")
    me_after_logout = client.get("/api/auth/me")
    assert me_after_logout.status_code == 401


def test_protected_route_requires_login(client):
    res = client.get("/api/bookings")
    assert res.status_code == 401


def test_non_admin_cannot_access_admin_route(client, make_client_user):
    make_client_user()
    res = client.get("/api/admin/stats")
    assert res.status_code == 403


def test_admin_can_access_admin_route(as_admin):
    res = as_admin.get("/api/admin/stats")
    assert res.status_code == 200
    assert "vehicles" in res.get_json()


def test_vehicle_list_and_filters(client, sample_vehicle):
    res = client.get("/api/vehicles")
    assert res.status_code == 200
    assert len(res.get_json()) == 1

    by_type = client.get(f"/api/vehicles?type={sample_vehicle.type}")
    assert len(by_type.get_json()) == 1

    by_wrong_location = client.get("/api/vehicles?location=Mombasa")
    assert by_wrong_location.get_json() == []

    by_price = client.get("/api/vehicles?min_price=5000")
    assert by_price.get_json() == []


def test_vehicle_features_create_validate_and_filter(as_admin, client):
    bad = as_admin.post(
        "/api/vehicles",
        json={
            "name": "Feature Test Car",
            "type": "fuel_car",
            "price_per_day": 3000,
            "features": ["heated_seats", "not_a_real_feature"],
        },
    )
    assert bad.status_code == 400
    assert "features" in bad.get_json()["errors"]

    good = as_admin.post(
        "/api/vehicles",
        json={
            "name": "Feature Test Car",
            "type": "fuel_car",
            "price_per_day": 3000,
            "features": ["heated_seats", "massage_seats", "sunroof"],
        },
    )
    assert good.status_code == 201
    body = good.get_json()
    assert set(body["features"]) == {"heated_seats", "massage_seats", "sunroof"}

    match = client.get("/api/vehicles?features=heated_seats,sunroof")
    assert len(match.get_json()) == 1

    no_match = client.get("/api/vehicles?features=heated_seats,wifi_hotspot")
    assert no_match.get_json() == []


def test_full_booking_and_deposit_payment_flow(client, make_client_user, sample_vehicle):
    make_client_user()

    booking_res = client.post(
        "/api/bookings",
        json={
            "vehicle_id": sample_vehicle.id,
            "start_date": "2030-04-01",
            "end_date": "2030-04-04",
        },
    )
    assert booking_res.status_code == 201
    booking = booking_res.get_json()["booking"]
    assert booking["status"] == "pending"

    pay_res = client.post(
        f"/api/bookings/{booking['id']}/payments",
        json={"amount": booking["deposit_amount"], "method": "mpesa", "phone_number": "0712345678"},
    )
    assert pay_res.status_code == 201
    payload = pay_res.get_json()
    assert payload["payment"]["status"] == "paid"
    assert payload["payment"]["mpesa_receipt"]
    assert payload["receipt"]["receipt_number"].startswith("RCT-")

    booking_after = client.get(f"/api/bookings/{booking['id']}").get_json()
    assert booking_after["status"] == "confirmed"


def test_double_booking_rejected(client, make_client_user, sample_vehicle):
    make_client_user()
    first = client.post(
        "/api/bookings",
        json={"vehicle_id": sample_vehicle.id, "start_date": "2030-05-01", "end_date": "2030-05-05"},
    )
    assert first.status_code == 201

    second = client.post(
        "/api/bookings",
        json={"vehicle_id": sample_vehicle.id, "start_date": "2030-05-03", "end_date": "2030-05-06"},
    )
    assert second.status_code == 400
    assert "vehicle_id" in second.get_json()["errors"]


def test_past_start_date_rejected(client, make_client_user, sample_vehicle):
    make_client_user()
    res = client.post(
        "/api/bookings",
        json={"vehicle_id": sample_vehicle.id, "start_date": "2020-01-01", "end_date": "2020-01-05"},
    )
    assert res.status_code == 400


def test_customer_cannot_view_another_customers_booking(client, make_client_user, sample_vehicle):
    make_client_user(username="alice", email="alice@example.com", phone="0711111111")
    booking = client.post(
        "/api/bookings",
        json={"vehicle_id": sample_vehicle.id, "start_date": "2030-06-01", "end_date": "2030-06-03"},
    ).get_json()["booking"]

    make_client_user(username="bob", email="bob@example.com", phone="0722222222")
    res = client.get(f"/api/bookings/{booking['id']}")
    assert res.status_code == 403


def test_invalid_mpesa_phone_on_payment_rejected(client, make_client_user, sample_vehicle):
    make_client_user()
    booking = client.post(
        "/api/bookings",
        json={"vehicle_id": sample_vehicle.id, "start_date": "2030-07-01", "end_date": "2030-07-03"},
    ).get_json()["booking"]

    res = client.post(
        f"/api/bookings/{booking['id']}/payments",
        json={"amount": booking["deposit_amount"], "method": "mpesa", "phone_number": "0812345678"},
    )
    assert res.status_code == 400
