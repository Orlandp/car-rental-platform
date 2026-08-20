# Backend (Flask API)

**Developer:** James Olando

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements-dev.txt   # requirements.txt + pytest; use requirements.txt alone in prod
cp .env.example .env
```

## Database

```bash
flask db upgrade
```

(`flask db init` / `flask db migrate` are only needed if you're starting a
brand-new migrations history — this repo's `migrations/versions/` is already
populated, so `flask db upgrade` is normally all you need.)

## Create an admin account

```bash
flask create-admin
```

You'll be prompted for name, username, email, and password. Public
registration (`POST /api/auth/register`) can only ever create a `client` or
`company` account — admins are only made through this CLI command.

## Run the server

```bash
python run.py
```

API will be at http://localhost:5000. In production, run behind Gunicorn instead:
`gunicorn -w 4 -b 0.0.0.0:8000 "run:app"`.

## Run the tests

```bash
pytest -v
```

35 tests: password hashing, booking overlap/pricing/deposit calculation, Kenyan phone
normalization, Kenyan ID/driving-license number format validation, vehicle feature
validation and filtering, plus route tests for the full register → book → pay-deposit
→ confirm flow, double-booking rejection, admin access control, IDOR protection, the
identity verification gate (blocked → submit → admin approve/reject → unblocked), and
verification-document access control.

### Proving the double-booking fix under real concurrency

`pytest` runs against SQLite on a single thread, so it can only prove the
check-and-insert logic is *correct* — it can't exercise real row-level locking across
concurrent DB connections. `scripts/verify_race_condition.py` does that: it needs a
real Postgres `DATABASE_URL` and the app served by multiple Gunicorn worker processes
(separate OS processes, separate DB connections — Flask's dev server is single-threaded
and can't demonstrate this either way):

```bash
gunicorn -w 4 -b 0.0.0.0:8000 "run:app"   # in one terminal
python3 scripts/verify_race_condition.py  # in another, venv active
```

It creates N verified test users and a test vehicle, then fires N simultaneous booking
POSTs for the same vehicle/dates from N real threads released at once via a
`threading.Barrier`. It asserts exactly one booking succeeds (`201`) and the rest are
rejected (`400`), and exits non-zero on any other outcome.

## Try it out

```bash
# Health check
curl http://localhost:5000/api/health

# Reference data for dropdowns (locations, categories, vehicle types, payment methods)
curl http://localhost:5000/api/meta

# Register a client - phone must be a Kenyan mobile number (07XXXXXXXX / 01XXXXXXXX)
curl -c cookies.txt -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Client","username":"jane","email":"jane@example.com","phone":"0712345678","password":"password123"}'

# Login as admin (use the account you created with `flask create-admin`)
curl -c admin_cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"youradminusername","password":"yourpassword"}'

# Create a vehicle (admin only, needs admin_cookies.txt from login above)
curl -b admin_cookies.txt -X POST http://localhost:5000/api/vehicles \
  -H "Content-Type: application/json" \
  -d '{"name":"Nissan Leaf","type":"electric_car","category":"sedan","location":"Nairobi CBD","make":"Nissan","model":"Leaf","year":2022,"price_per_day":45.00}'

# List vehicles (public) - filter by type, category, location, price range, or
# available_from/available_to (both required together)
curl http://localhost:5000/api/vehicles
curl "http://localhost:5000/api/vehicles?type=tuk_tuk"
curl "http://localhost:5000/api/vehicles?category=suv&location=Nairobi%20JKIA"
curl "http://localhost:5000/api/vehicles?min_price=2000&max_price=8000"
curl "http://localhost:5000/api/vehicles?available_from=2027-01-01&available_to=2027-01-05"

# Edit a vehicle's price (admin only) - replace 1 with the vehicle id
curl -b admin_cookies.txt -X PATCH http://localhost:5000/api/vehicles/1 \
  -H "Content-Type: application/json" \
  -d '{"price_per_day":50.00}'

# Delete a vehicle (admin only)
curl -b admin_cookies.txt -X DELETE http://localhost:5000/api/vehicles/1

# Set the company's own details incl. deposit % and driver day-rate (admin only)
curl -b admin_cookies.txt -X PUT http://localhost:5000/api/company-settings \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Rentals Ltd","kra_pin":"P0XXXXXXXXX","address":"123 Moi Ave","city":"Nairobi","phone":"0700000000","email":"info@acme.co.ke","vat_rate":16,"deposit_percentage":30,"driver_daily_rate":2500}'

# Upload the company logo (admin only) - printed in the logo box on every invoice/receipt PDF
curl -b admin_cookies.txt -X POST http://localhost:5000/api/company-settings/logo \
  -F "logo=@logo.png"

# Submit identity documents for review (required once before a client/company's first
# booking - POST /api/bookings 403s with an unverified/pending status until an admin
# approves). driver_license_image / national_id_image are file uploads. Numbers are
# digits-only: national ID 6-8 digits, driving license 5-8 digits.
curl -b cookies.txt -X POST http://localhost:5000/api/users/me/verification \
  -F "driver_license_number=1234567" \
  -F "national_id_number=12345678" \
  -F "driver_license_image=@dl.jpg" \
  -F "national_id_image=@id.jpg"

# No driving license? Skip the DL fields entirely with has_driver_license=false - every
# booking this user makes will then require with_driver:true (see below).
curl -b cookies.txt -X POST http://localhost:5000/api/users/me/verification \
  -F "has_driver_license=false" \
  -F "national_id_number=12345678" \
  -F "national_id_image=@id.jpg"

# Admin: list pending submissions, then approve/reject one - replace 2 with the user id
curl -b admin_cookies.txt "http://localhost:5000/api/admin/verifications?status=pending_review"
curl -b admin_cookies.txt -X PATCH http://localhost:5000/api/users/2/verification \
  -H "Content-Type: application/json" -d '{"status":"verified","notes":"Docs look legit"}'

# Book a vehicle, optionally with a driver - replace 1 with the vehicle id
curl -b cookies.txt -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"vehicle_id":1,"start_date":"2027-01-10","end_date":"2027-01-13","with_driver":true}'

# Pay the deposit via mock M-Pesa (instant simulated success, no real Daraja call) -
# replace 1 with the booking id and use its deposit_amount from the response above
curl -b cookies.txt -X POST http://localhost:5000/api/bookings/1/payments \
  -H "Content-Type: application/json" \
  -d '{"amount":7650,"method":"mpesa","phone_number":"0712345678"}'

# View a booking's receipts (there's one per successful payment)
curl -b cookies.txt http://localhost:5000/api/bookings/1/receipts

# Cancel a booking (customer: only >24h before start_date and only their own;
# admin: any booking, anytime) - paid payments are marked refunded (mock)
curl -b cookies.txt -X PATCH http://localhost:5000/api/bookings/1 \
  -H "Content-Type: application/json" -d '{"status":"cancelled"}'

# Admin dashboard stats
curl -b admin_cookies.txt http://localhost:5000/api/admin/stats

# Download a booking's invoice as a PDF (watermark + QR + barcode) - replace 1 with the booking id
curl -b cookies.txt http://localhost:5000/api/bookings/1/invoice/pdf -o invoice.pdf

# Download a payment's receipt as a PDF ("PAID" watermark + QR + barcode) - replace 1
# with the receipt id from a payment's response, or GET /api/bookings/1/receipts
curl -b cookies.txt http://localhost:5000/api/receipts/1/pdf -o receipt.pdf

# Forgot password - reset link is printed to this server's console/log,
# no email service is configured yet
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com"}'
```

## Vehicle types and categories

`type` is the Kenya-specific fuel/vehicle-class distinction:

- `electric_car`, `tuk_tuk`, `fuel_car`

`category` is an independent, optional body-style tag:

- `sedan`, `suv`, `van`, `pickup`, `minibus`, `tuk_tuk`, `other`

## Notes on vehicle features

Each vehicle also carries a `features` array (`db.JSON`) — a fixed catalog of
amenities (`FEATURE_LABELS` in `app/models/vehicle.py`: heated seats, massage seats,
leather seats, sunroof, steering wheel controls, premium sound system, 4-wheel drive,
and 13 more) that admins select when creating/editing a vehicle via
`POST`/`PATCH /api/vehicles`. `_validate_vehicle_payload` rejects any key not in
`VALID_FEATURES`. `GET /api/vehicles?features=heated_seats,sunroof` filters to vehicles
that have *all* of the listed features (AND, not OR). `GET /api/meta` exposes the full
catalog as `[{key, label}, ...]` so the frontend never hardcodes the feature list.

## Notes on auth

Login uses Flask-Login server-side sessions: the cookie only holds a signed
session id, no JWT/token is issued or parsed. `role` (`admin`, `client`, or
`company`) is stored on the `User` row and checked on the server for every
admin-only route via the `@admin_required` decorator in
`app/utils/decorators.py`.

Password reset tokens (`/api/auth/forgot-password` and
`/api/auth/reset-password`) are single-use, expire after 30 minutes, and are
stored hashed (SHA-256) — the raw token only ever appears in the generated
reset link, which is currently logged to the console rather than emailed.

## Notes on payments and deposits

A booking confirms once its deposit (30% of the total by default, configurable
in Company Settings) has been paid; further payments settle the remaining
balance. `method: "mpesa"` payments are a **mock**: there's no real Daraja
STK-push call, `app/utils/kenya.py` just generates a fake `transaction_id` and
`mpesa_receipt` and marks the payment paid immediately. Other methods (`cash`,
`bank_transfer`, `card`, `other`) still require an admin to manually confirm
via `PATCH /api/payments/<id>/confirm`.

## Notes on identity verification

A client/company account must be `verified` before `POST /api/bookings` succeeds
(enforced server-side, not just hidden in the UI - admin-created manual/walk-in
bookings via `POST /api/bookings/manual` skip this since staff check ID in person).
Verification is **manual admin review**, not an automated document-authenticity
check: no NTSA license-validation or third-party KYC-provider integration is wired up.

Before a submission even reaches admin review, `app/utils/kenya.py` format-validates
both numbers: `validate_kenyan_id_number` requires 6-8 digits (Kenyan national IDs have
run 6-8 digits since the 1970s), `validate_kenyan_dl_number` requires 5-8 digits. The DL
check is a **length/digit format check, not a live NTSA registry lookup** - it rejects
obviously-malformed input, it does not confirm the license number belongs to the holder.

Document images are stored under `backend/private_uploads/verification/` (configurable
via `VERIFICATION_UPLOAD_FOLDER`), deliberately outside `app/static/` so they're never
reachable by a guessed URL - they're only served through
`GET /api/users/<id>/verification/<driver-license|national-id>-image`, which checks the
requester is that user or an admin.

### Booking without a driver's license

`POST /api/users/me/verification` accepts `has_driver_license=false` (form field) to
skip the `driver_license_number`/`driver_license_image` requirement entirely - only the
national ID is mandatory in that case. Such a user still ends up `verified`, but with
`driver_license_number` left `NULL`. `User.to_dict()`'s `has_driver_license` field
(`bool(driver_license_number)`) is how the frontend knows to force the booking wizard's
"with driver" toggle on and disable it. The actual enforcement is server-side in
`POST /api/bookings` (`app/routes/bookings.py::create_booking`): a request with
`with_driver` falsy from a user with no `driver_license_number` on file is rejected
with `400 {"errors": {"with_driver": "..."}}` regardless of what the client sends. This
does *not* apply to `POST /api/bookings/manual` (admin walk-in bookings), since staff
check the renter's ID/license in person for those.

## Notes on invoices and receipts

Both PDFs (`app/utils/pdf.py`) share a page header drawn straight on the canvas so it
repeats identically on every page: a logo box top-left (the company's uploaded logo
image if `CompanySettings.logo_path` is set, otherwise a placeholder box with the
company's initials - this box is reserved for the logo specifically, company contact
details are drawn beside it, never inside it), the company name/address/phone/email/KRA
PIN next to the logo, and a QR code near the top-right encoding the document's key
details as plain text, with the document number and issue date printed beneath it. A
Code128 barcode of the document number sits in normal document flow just below the
items table (invoice) or amount table (receipt) - implemented as a small custom
`reportlab.platypus.Flowable` subclass (`_BarcodeFlowable`) since `code128.Code128` is
a `Widget`, not a `Shape`/`UserNode`, so it can't be added as a child of a graphics
`Drawing` the way the QR widget can. A diagonal watermark (company name on invoices,
"PAID" on receipts) still covers the whole page. None of this is a live KRA/government
verification portal - no such portal exists behind the QR code, this is a low-tech
anti-tamper/offline-lookup aid.

The invoice breaks the vehicle rental and (if hired) the professional driver into two
separate line items. Their amounts are the invoice's VAT-exclusive subtotal split
proportionally to each one's day-rate contribution (not just `days * rate` directly),
which keeps the two lines always summing exactly to the printed subtotal even if an
admin later hand-overrides the invoice's total via `PATCH /api/bookings/<id>/invoice`.
The receipt states the invoice number it's being paid against (`GET /api/receipts/<id>/pdf`
looks the invoice up by `booking_id` and passes it to `render_receipt_pdf`) and whether
the booking included a driver.

Upload a company logo with `POST /api/company-settings/logo` (admin, multipart
`logo` file field, same pattern as vehicle image upload) - stored under
`backend/app/static/uploads/company/` (configurable via `COMPANY_UPLOAD_FOLDER`),
publicly served like vehicle images since it's just branding, not sensitive.

## Notes on production config

`app/config.py` refuses to start the app (`RuntimeError`) if `FLASK_ENV=production`
and `SECRET_KEY` is still the default placeholder. `SESSION_COOKIE_SECURE` follows
the same env var unless explicitly overridden. `run.py`'s `debug=True` is opt-in via
`FLASK_DEBUG=1` — never defaults on, so a bare `python run.py` in production doesn't
accidentally expose the Werkzeug debugger.

---

Developed and maintained by **James Olando**.
