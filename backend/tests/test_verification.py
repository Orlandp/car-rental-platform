import io

# Smallest possible valid 1x1 PNG, used as a stand-in uploaded document image.
TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
    b"\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _submit_verification(client, dl="1234567", national_id="12345678"):
    return client.post(
        "/api/users/me/verification",
        data={
            "driver_license_number": dl,
            "national_id_number": national_id,
            "driver_license_image": (io.BytesIO(TINY_PNG), "dl.png"),
            "national_id_image": (io.BytesIO(TINY_PNG), "id.png"),
        },
        content_type="multipart/form-data",
    )


def test_booking_blocked_until_verified(client, make_client_user, sample_vehicle):
    make_client_user(verified=False)
    res = client.post(
        "/api/bookings",
        json={"vehicle_id": sample_vehicle.id, "start_date": "2030-08-01", "end_date": "2030-08-03"},
    )
    assert res.status_code == 403
    assert res.get_json()["verification_status"] == "unverified"


def test_submit_verification_sets_pending(client, make_client_user):
    make_client_user(verified=False)
    res = _submit_verification(client)
    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "pending_review"
    assert body["has_driver_license_image"] is True
    assert body["has_national_id_image"] is True


def test_malformed_id_number_rejected(client, make_client_user):
    make_client_user(verified=False)
    res = _submit_verification(client, national_id="ID987654")
    assert res.status_code == 400
    assert "national_id_number" in res.get_json()["errors"]


def test_malformed_dl_number_rejected(client, make_client_user):
    make_client_user(verified=False)
    res = _submit_verification(client, dl="DL123456")
    assert res.status_code == 400
    assert "driver_license_number" in res.get_json()["errors"]


def test_too_short_id_number_rejected(client, make_client_user):
    make_client_user(verified=False)
    res = _submit_verification(client, national_id="1234")
    assert res.status_code == 400
    assert "national_id_number" in res.get_json()["errors"]


def test_admin_approve_unblocks_booking(app, client, make_client_user, admin_user, sample_vehicle):
    user = make_client_user(verified=False)
    _submit_verification(client)

    # A separate client with its own cookie jar for the admin - `client` is busy being
    # logged in as the renter above, and `as_admin` would just be the same client aliased.
    admin_client = app.test_client()
    admin_client.post("/api/auth/login", json={"username": "admin", "password": "Admin@12345"})

    pending = admin_client.get("/api/admin/verifications?status=pending_review").get_json()
    assert any(u["user_id"] == user["id"] for u in pending)

    approve = admin_client.patch(
        f"/api/users/{user['id']}/verification",
        json={"status": "verified", "notes": "looks good"},
    )
    assert approve.status_code == 200
    assert approve.get_json()["status"] == "verified"

    res = client.post(
        "/api/bookings",
        json={"vehicle_id": sample_vehicle.id, "start_date": "2030-08-10", "end_date": "2030-08-12"},
    )
    assert res.status_code == 201


def test_verification_image_access_control(app, client, make_client_user, admin_user):
    owner = make_client_user(username="owner", email="owner@example.com", phone="0700000001", verified=False)
    _submit_verification(client)

    # owner can view their own document
    own = client.get(f"/api/users/{owner['id']}/verification/driver-license-image")
    assert own.status_code == 200

    # a different, unrelated client cannot - independent client/cookie jar
    stranger_client = app.test_client()
    stranger_client.post(
        "/api/auth/register",
        json={
            "name": "Stranger",
            "username": "stranger",
            "email": "stranger@example.com",
            "phone": "0700000002",
            "password": "password123",
        },
    )
    other = stranger_client.get(f"/api/users/{owner['id']}/verification/driver-license-image")
    assert other.status_code == 403

    # admin can - independent client/cookie jar
    admin_client = app.test_client()
    admin_client.post("/api/auth/login", json={"username": "admin", "password": "Admin@12345"})
    admin_view = admin_client.get(f"/api/users/{owner['id']}/verification/driver-license-image")
    assert admin_view.status_code == 200


def test_receipt_and_invoice_pdf_download(client, make_client_user, sample_vehicle):
    make_client_user()
    booking = client.post(
        "/api/bookings",
        json={"vehicle_id": sample_vehicle.id, "start_date": "2030-09-01", "end_date": "2030-09-03"},
    ).get_json()["booking"]

    invoice_pdf = client.get(f"/api/bookings/{booking['id']}/invoice/pdf")
    assert invoice_pdf.status_code == 200
    assert invoice_pdf.content_type == "application/pdf"
    assert invoice_pdf.data[:4] == b"%PDF"

    pay = client.post(
        f"/api/bookings/{booking['id']}/payments",
        json={"amount": booking["deposit_amount"], "method": "mpesa", "phone_number": "0712345678"},
    ).get_json()

    receipt_pdf = client.get(f"/api/receipts/{pay['receipt']['id']}/pdf")
    assert receipt_pdf.status_code == 200
    assert receipt_pdf.content_type == "application/pdf"
    assert receipt_pdf.data[:4] == b"%PDF"
