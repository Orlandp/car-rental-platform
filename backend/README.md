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

24 tests: password hashing, booking overlap/pricing/deposit calculation, Kenyan phone
normalization, plus route tests for the full register → book → pay-deposit → confirm
flow, double-booking rejection, admin access control, and IDOR protection.

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

# Download a booking's invoice as a PDF - replace 1 with the booking id
curl -b cookies.txt http://localhost:5000/api/bookings/1/invoice/pdf -o invoice.pdf

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

## Notes on production config

`app/config.py` refuses to start the app (`RuntimeError`) if `FLASK_ENV=production`
and `SECRET_KEY` is still the default placeholder. `SESSION_COOKIE_SECURE` follows
the same env var unless explicitly overridden. `run.py`'s `debug=True` is opt-in via
`FLASK_DEBUG=1` — never defaults on, so a bare `python run.py` in production doesn't
accidentally expose the Werkzeug debugger.

---

Developed and maintained by **James Olando**.
