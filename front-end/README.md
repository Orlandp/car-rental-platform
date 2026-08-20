# Frontend (React + Vite)

**Developer:** James Olando

## Setup

```bash
cd front-end
npm install
cp .env.example .env
```

`VITE_API_URL` in `.env` should point at the backend API (defaults to
`http://localhost:5000`).

## Run

```bash
npm run dev
```

App will be at http://localhost:3000 (`vite.config.js` pins this port with
`strictPort: true`; if it's taken, free it or change `server.port` there and
add the new origin to the backend's `CORS_ORIGINS`). Make sure the backend
(see `../backend/README.md`) is running first — the frontend calls it
directly and relies on its session cookie for auth.

## Build

```bash
npm run build      # production build, output in dist/
npm run preview    # serve the production build locally
```

## Structure

```
src/
  api/client.js         Fetch wrapper (cookie-based auth) used by every page
  context/AuthContext.jsx  Current user, login/register/logout, idle auto-logout
  components/            Shared UI: Navbar, ProtectedRoute, PasswordInput
  pages/                  Public pages (landing, login, register, forgot/reset password,
                          vehicles, my bookings, pay) and pages/admin (fleet, bookings,
                          users, company settings)
  styles/                 Plain CSS per page/area, shared tokens in styles/index.css
```

## Pages at a glance

| Path | Who | Purpose |
|------|-----|---------|
| `/` | anyone | Landing page (signed out) or redirect to the right dashboard (signed in) |
| `/login`, `/register` | anyone | Auth |
| `/forgot-password`, `/reset-password` | anyone | Password reset flow |
| `/vehicles` | client, company | Browse & book vehicles (filter by type, category, location, price, availability dates; optional driver) |
| `/my-bookings` | client, company | Booking history, invoices, receipts |
| `/bookings/:id/pay` | client, company | Pay the deposit or full balance (mock M-Pesa or manual methods), download invoice PDF |
| `/admin` | admin | Dashboard: live fleet/booking/payment counts and total revenue |
| `/admin/vehicles`, `/admin/bookings`, `/admin/users` | admin | Fleet, booking, and user management |
| `/admin/settings` | admin | Company profile (name, KRA PIN, address, VAT rate, deposit %, driver day-rate) used on invoices and bookings |

Registration requires a Kenyan mobile number (`07XXXXXXXX` / `01XXXXXXXX`), validated
server-side. Vehicle/location/category dropdown options come from `GET /api/meta`
rather than being hardcoded in the frontend.

Routes are gated by `ProtectedRoute` (`src/components/ProtectedRoute.jsx`)
based on the logged-in user's `role`, which the backend enforces
independently on every request.

---

Developed and maintained by **James Olando**.
