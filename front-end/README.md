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

App will be at http://localhost:5173. Make sure the backend (see
`../backend/README.md`) is running first — the frontend calls it directly
and relies on its session cookie for auth.

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
| `/vehicles` | client, company | Browse & book vehicles |
| `/my-bookings` | client, company | Booking history, invoices, receipts |
| `/bookings/:id/pay` | client, company | Pay an outstanding balance, download invoice PDF |
| `/admin/vehicles`, `/admin/bookings`, `/admin/users` | admin | Fleet, booking, and user management |
| `/admin/settings` | admin | Company profile (name, KRA PIN, address, VAT rate) used on invoices |

Routes are gated by `ProtectedRoute` (`src/components/ProtectedRoute.jsx`)
based on the logged-in user's `role`, which the backend enforces
independently on every request.

---

Developed and maintained by **James Olando**.
