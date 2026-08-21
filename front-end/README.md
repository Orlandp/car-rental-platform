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
  api/client.js            Fetch wrapper (cookie-based auth) used by every page
  context/AuthContext.jsx  Current user, login/register/logout/refresh, idle auto-logout
  context/ThemeContext.jsx Light/dark toggle (persisted to localStorage)
  context/ConfirmContext.jsx  Promise-based confirm dialog (replaces window.confirm)
  components/               Navbar, ProtectedRoute, PasswordInput
  components/ui/            Shared design-system primitives: Button, Card, Field/Input/
                            Select/Textarea, Badge, Alert, Skeleton, PageLoader,
                            Stepper, ThemeToggle, FeatureBadges
  utils/vehicleFeatures.js  Icon-per-feature-key map + {key -> label} lookup built from
                            GET /api/meta's vehicle_features list
  pages/                    Public pages (landing, login, register, forgot/reset
                            password, vehicles, book-vehicle wizard, my bookings, pay,
                            verify) and pages/admin (dashboard, fleet, bookings, users,
                            verifications, company settings)
  styles/index.css          Tailwind v4 entry point + design tokens (colors, fonts,
                            radii) — light/dark values swap via a `.dark` class on <html>
```

Styling is Tailwind CSS v4 (`@tailwindcss/vite`), with a small CSS-variable-backed
token system in `styles/index.css` — colors, fonts, and radii cascade through
`--color-*`/`--font-*` custom properties, so retheming (e.g. the brand palette) is a
one-file change. Body/UI text is DM Sans; page-title `h1`s and anything with the
`font-display` utility use Instrument Serif.

## Pages at a glance

| Path | Who | Purpose |
|------|-----|---------|
| `/` | anyone | Landing page (signed out) or redirect to the right dashboard (signed in) |
| `/login`, `/register` | anyone | Auth |
| `/forgot-password`, `/reset-password` | anyone | Password reset flow |
| `/vehicles` | client, company | Browse vehicles (filter by type, category, location, price, features, availability dates); each card shows up to 3 feature badges |
| `/vehicles/:id/book` | client, company | 3-step booking wizard (Dates → Options → Review & Pay) with a live KSh price/deposit estimate; step 1 shows the full "`{vehicle}` comes with ..." feature list. The "Professional driver" toggle is forced on and disabled for a renter with no driver's license on file |
| `/verify` | client, company | Upload national ID for admin review, plus driver's license unless "I have a Kenyan driving license" is unchecked (format-validated client-side to match the backend's Kenyan ID/DL rules); required before the first booking |
| `/my-bookings` | client, company | Booking history, invoice/receipt PDFs |
| `/bookings/:id/pay` | client, company | Pay the deposit or full balance (mock M-Pesa or manual methods), download invoice/receipt PDFs |
| `/admin` | admin | Dashboard: live fleet/booking/payment counts and total revenue |
| `/admin/vehicles`, `/admin/users` | admin | Fleet and user management |
| `/admin/bookings` | admin | Booking management; each row shows a Paid / Partially paid / Unpaid payment badge alongside its lifecycle status |
| `/admin/verifications` | admin | Review pending/verified/rejected identity-document submissions |
| `/admin/settings` | admin | Company profile (name, KRA PIN, address, VAT rate, deposit %, driver day-rate) and logo upload, used on invoice/receipt PDFs and bookings |

Registration requires a Kenyan mobile number (`07XXXXXXXX` / `01XXXXXXXX`), validated
server-side. Vehicle/location/category dropdown options come from `GET /api/meta`
rather than being hardcoded in the frontend. Booking is blocked client-side (and
enforced server-side) until `/verify` is approved by an admin.

Routes are gated by `ProtectedRoute` (`src/components/ProtectedRoute.jsx`)
based on the logged-in user's `role`, which the backend enforces
independently on every request.

---

Developed and maintained by **James Olando**.
