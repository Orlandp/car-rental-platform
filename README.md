# Car Rental Platform

A full-stack car (and tuk-tuk / electric vehicle) rental management system: public vehicle
browsing and booking for clients/companies, plus an admin back office for fleet, bookings,
payments, and invoicing.

**Stack:** Flask (Python) API + PostgreSQL, React (Vite) frontend, session-cookie auth.

**Developer:** James Olando

---

## Contents

- [Architecture](#architecture)
- [Features](#features)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Production readiness](#production-readiness)

## Architecture

```
front-end/  React 18 + Vite, plain fetch client, cookie-based session auth
backend/    Flask 3 API, SQLAlchemy + Alembic migrations, Flask-Login sessions
            PostgreSQL in production; SQLite fallback for zero-config local dev
```

The frontend and backend are two independent apps that talk over HTTP — there's no
server-side rendering or shared build step. Auth is a signed, `HttpOnly` session cookie
(no JWT); the browser must send credentials on every API call, so the frontend origin
must be in the backend's `CORS_ORIGINS`.

## Features

- **Roles:** `admin`, `client`, `company` — enforced server-side on every request, not
  just hidden in the UI. Public registration can only create `client`/`company`
  accounts; admins are provisioned via `flask create-admin`. Registration requires a
  validated Kenyan mobile number (`07XXXXXXXX` / `01XXXXXXXX`), stored normalized as
  `254XXXXXXXXX`.
- **Vehicles:** fleet CRUD (electric car / tuk-tuk / fuel car `type`, independent
  sedan/SUV/van/pickup/minibus `category`), Kenyan pickup `location`, availability
  status, pricing per day. Public listing filters by type, category, location, price
  range, and date-range availability (excludes vehicles with an overlapping active
  booking).
- **Bookings:** date-range booking (max 90 days) with overlap prevention — the vehicle
  row is locked (`SELECT ... FOR UPDATE`) for the duration of the check-and-insert so
  two concurrent requests for the same vehicle/dates can't both succeed. Optional
  professional driver (day rate configurable in Company Settings). Each booking gets a
  human-readable reference (`KR-000042`). Manual (walk-in) bookings, status lifecycle
  (pending → confirmed → completed / cancelled), return handling with automatic
  late-fee calculation. Customers can self-cancel up to 24h before the start date;
  admins can force-cancel anytime. Cancelling a paid booking marks its payment(s)
  refunded (mock — no real gateway refund is issued).
- **Payments / deposits:** a booking confirms once at least its 30% deposit (both
  configurable in Company Settings) is paid; further payments settle the remaining
  balance. M-Pesa payments are simulated end-to-end (instant mock "STK push" success
  with a generated transaction ID and M-Pesa receipt code) since there's **no live
  Daraja integration** — see [Production readiness](#production-readiness). Cash / bank
  transfer / card / other methods still go through admin manual confirmation.
- **Invoicing:** VAT-aware invoices per booking, downloadable as PDF (`reportlab`),
  using the company's own profile (name, KRA PIN, address, VAT rate) set under
  `/admin/settings`.
- **Admin dashboard:** live fleet/booking/payment counts and total revenue at `/admin`.
- **Password reset:** single-use, SHA-256-hashed, 30-minute-expiry tokens. The reset
  link is currently logged to the server console — no email/SMS provider is wired up
  yet.

## Quick start

Prerequisites: Python 3.11+, Node 18+, PostgreSQL (or skip it and let the backend fall
back to SQLite for a zero-config local run).

### 1. Database (skip if using the SQLite fallback)

```bash
sudo -u postgres psql \
  -c "CREATE ROLE car_rental_dev WITH LOGIN PASSWORD 'car_rental_dev';" \
  -c "ALTER ROLE car_rental_dev CREATEDB;" \
  -c "CREATE DATABASE car_rental_dev OWNER car_rental_dev;"
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt   # requirements.txt + pytest; use requirements.txt alone in prod
cp .env.example .env   # edit DATABASE_URL / SECRET_KEY as needed
flask db upgrade
flask create-admin     # prompts for name/username/email/password
python run.py           # http://localhost:5000 (set FLASK_DEBUG=1 in .env for auto-reload)
```

Run the test suite with `pytest` (from `backend/`, venv active) — 24 tests covering
password hashing, booking overlap/pricing/deposit logic, phone validation, the full
register → book → pay-deposit → confirm flow, double-booking rejection, admin access
control, and IDOR protection.

In production, run behind Gunicorn instead of the Flask dev server:
`gunicorn -w 4 -b 0.0.0.0:8000 "run:app"` (already in `requirements.txt`). Set
`FLASK_ENV=production` — app startup then refuses to boot if `SECRET_KEY` is still the
default placeholder, and `SESSION_COOKIE_SECURE` defaults to `true`.

### 3. Frontend

```bash
cd front-end
npm install
cp .env.example .env   # VITE_API_URL should point at the backend above
npm run dev             # http://localhost:3000 (see vite.config.js)
```

> The frontend's own README says port 5173 (Vite's default) but
> `front-end/vite.config.js` pins `strictPort: true` on **3000**. If 3000 is already
> taken on your machine, either free it or change `server.port` in `vite.config.js`
> (and add the new origin to the backend's `CORS_ORIGINS`).

### 4. Try it

```bash
curl http://localhost:5000/api/health
```

Then open the frontend URL, or drive the API directly — see `backend/README.md` for a
full `curl` walkthrough (register, login, create a vehicle, book it, pay, download the
invoice PDF).

Full per-app details: [`backend/README.md`](backend/README.md) ·
[`front-end/README.md`](front-end/README.md)

## Environment variables

**`backend/.env`**

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Flask session-signing key. Generate one: `python3 -c "import secrets; print(secrets.token_hex(32))"`. Must be set to a real random value outside dev. |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname`. Omit to fall back to a local SQLite file. |
| `CORS_ORIGINS` | Comma-separated list of frontend origins allowed to send credentialed requests. |
| `FRONTEND_URL` | Base URL used to build password-reset links. Point at the deployed frontend in production. |

**`front-end/.env`**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend API. |

## Project structure

```
backend/
  app/
    models/     SQLAlchemy models (user, vehicle, booking, payment, invoice, receipt, ...)
    routes/     Blueprints: auth, vehicles, bookings, payments, users, company_settings
    utils/      Auth decorators, PDF generation
  migrations/   Alembic migration history
  run.py        Entrypoint

front-end/
  src/
    api/client.js          Fetch wrapper (cookie-based auth) used by every page
    context/AuthContext.jsx Current user, login/register/logout, idle auto-logout
    components/            Shared UI: Navbar, ProtectedRoute, PasswordInput
    pages/                 Public pages + pages/admin (fleet, bookings, users, settings)
    styles/                 Plain CSS per page/area, shared tokens in styles/index.css
```

## Production readiness

Checked against `TEST_CASES.md` (the Kenya Car Rentals MVP test-case gate covering
functional flows, security, Kenya-specific business rules, and deployment config —
kept alongside this repo, not committed to it). All P0/P1/P2 items from that document
are now implemented:
Kenyan phone validation (KE-02/KE-05), vehicle location/category filters (KE-03,
CAR-02/03/04/05), 30% deposit + mock M-Pesa payment flow (KE-04, PAY-01–04, BOOK-08),
driver option (BOOK-07, KE-06), booking references (BOOK-02), a 24h cancellation
window with mock refunds (CAN-01–03), an admin dashboard (ADM-01), a locked
check-and-insert against the double-booking race (ERR-04), JSON error responses
(ERR-01), a 24-test pytest suite (PRD-05), and the Gunicorn/`SECRET_KEY`/`DEBUG`
production-config guards (PRD-01/02/04). CSRF (SEC-01) is handled architecturally —
JSON-only bodies plus a CORS origin allowlist and `SameSite=Lax` cookies block
classic form-based CSRF, since this is a cookie-auth JSON API rather than a
server-rendered form app, not via a Flask-WTF token.

What's still open before this is safe in front of real users and real money:

- **No live payment gateway.** M-Pesa payments succeed instantly via a *mock* — there's
  no real Safaricom Daraja STK-push integration, so nothing is actually charged. Wiring
  up Daraja means replacing `generate_mock_mpesa_receipt`/`generate_mock_transaction_id`
  in `backend/app/utils/kenya.py` with a real STK-push call + callback handler.
- **No transactional email/SMS.** Password-reset links are only logged to the server
  console — needs a real provider (SES, SendGrid, Africa's Talking, etc.) before
  password reset is usable in production.
- **No CI.** The pytest suite exists and is green, but there's no GitHub Actions/CI
  pipeline wired up yet to run it automatically.
- **No containerization.** No `Dockerfile`/`docker-compose.yml` — deploying today means
  manually provisioning a Python + Postgres + static-hosting environment.
- **Secrets hygiene.** `SECRET_KEY` defaults to a placeholder in dev — startup now
  refuses to run with that default once `FLASK_ENV=production`, but make sure a real
  generated secret is injected via your host's secret manager, not committed.
- **Dependency vulnerabilities.** `npm audit` currently flags 4 issues (1 high) in
  `esbuild`/`vite` (dev-server only) and `react-router-dom`; fixes are available via
  `npm audit fix --force` but pull in breaking major-version bumps (Vite 8, React
  Router 7) that need testing before adopting.
- **File uploads.** Vehicle images are expected under
  `backend/app/static/uploads/vehicles`, served from local disk — fine for a single
  instance, not for multi-instance/horizontally-scaled deployment (needs object
  storage, e.g. S3).
- **Rate limiting / abuse protection.** None on auth endpoints (login, register,
  forgot-password) currently.

---

Developed and maintained by **James Olando**.
