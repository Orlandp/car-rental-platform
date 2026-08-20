# Backend (Flask API)

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
flask db init          # only the very first time
flask db migrate -m "initial tables"
flask db upgrade
```

## Create an admin account

```bash
flask create-admin
```

You'll be prompted for name, email, and password.

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
  -d '{"name":"Jane Client","email":"jane@example.com","password":"password123"}'

# Login as admin (use the account you created with `flask create-admin`)
curl -c admin_cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}'

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
```

## Vehicle types

- `electric_car`
- `tuk_tuk`
- `fuel_car`

## Notes on auth

Login uses Flask-Login server-side sessions: the cookie only holds a signed
session id, no JWT/token is issued or parsed. `role` (`admin` or `client`) is
stored on the `User` row and checked on the server for every admin-only route
via the `@admin_required` decorator in `app/utils/decorators.py`.
