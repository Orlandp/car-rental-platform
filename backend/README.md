# Backend (Flask API)

**Developer:** James Olando

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirements.txt
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

API will be at http://localhost:5000

## Try it out

```bash
# Health check
curl http://localhost:5000/api/health

# Register a client
curl -c cookies.txt -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Client","username":"jane","email":"jane@example.com","password":"password123"}'

# Login as admin (use the account you created with `flask create-admin`)
curl -c admin_cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"youradminusername","password":"yourpassword"}'

# Create a vehicle (admin only, needs admin_cookies.txt from login above)
curl -b admin_cookies.txt -X POST http://localhost:5000/api/vehicles \
  -H "Content-Type: application/json" \
  -d '{"name":"Nissan Leaf","type":"electric_car","make":"Nissan","model":"Leaf","year":2022,"price_per_day":45.00}'

# List vehicles (public)
curl http://localhost:5000/api/vehicles

# Filter by type
curl "http://localhost:5000/api/vehicles?type=tuk_tuk"

# Edit a vehicle's price (admin only) - replace 1 with the vehicle id
curl -b admin_cookies.txt -X PATCH http://localhost:5000/api/vehicles/1 \
  -H "Content-Type: application/json" \
  -d '{"price_per_day":50.00}'

# Delete a vehicle (admin only)
curl -b admin_cookies.txt -X DELETE http://localhost:5000/api/vehicles/1

# Set the company's own details (admin only) - shown on every invoice PDF
curl -b admin_cookies.txt -X PUT http://localhost:5000/api/company-settings \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Rentals Ltd","kra_pin":"P0XXXXXXXXX","address":"123 Moi Ave","city":"Nairobi","phone":"0700000000","email":"info@acme.co.ke","vat_rate":16}'

# Download a booking's invoice as a PDF - replace 1 with the booking id
curl -b cookies.txt http://localhost:5000/api/bookings/1/invoice/pdf -o invoice.pdf

# Forgot password - reset link is printed to this server's console/log,
# no email service is configured yet
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com"}'
```

## Vehicle types

- `electric_car`
- `tuk_tuk`
- `fuel_car`

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

---

Developed and maintained by **James Olando**.
