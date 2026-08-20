import { Fragment, useEffect, useState } from "react";
import { api, API_URL } from "../../api/client";
import "../../styles/admin.css";

const STATUSES = ["pending", "confirmed", "cancelled", "completed"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ReturnControl({ booking, onReturned }) {
  const [returnDate, setReturnDate] = useState(booking.actual_return_date || todayIso());
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function markReturned() {
    setError("");
    setSubmitting(true);
    try {
      await api.patch(`/api/bookings/${booking.id}/return`, {
        actual_return_date: returnDate,
      });
      onReturned();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (booking.status === "cancelled") return <span>—</span>;

  return (
    <div className="return-control">
      {error && <p className="form-error">{error}</p>}
      <input
        type="date"
        value={returnDate}
        onChange={(e) => setReturnDate(e.target.value)}
      />
      <button onClick={markReturned} disabled={submitting}>
        {booking.actual_return_date ? "Update Return" : "Mark Returned"}
      </button>
    </div>
  );
}

function PriceControl({ booking, onUpdated }) {
  const [price, setPrice] = useState(booking.total_price);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function updatePrice() {
    setError("");
    setSubmitting(true);
    try {
      await api.patch(`/api/bookings/${booking.id}`, { total_price: Number(price) });
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="price-control">
      {error && <p className="form-error">{error}</p>}
      <input
        type="number"
        step="0.01"
        min="0"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <button onClick={updatePrice} disabled={submitting}>
        Update Agreed Price
      </button>
    </div>
  );
}

function InvoiceControl({ booking }) {
  const [invoice, setInvoice] = useState(null);
  const [vatRate, setVatRate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    api
      .get(`/api/bookings/${booking.id}/invoice`)
      .then((data) => {
        setInvoice(data);
        setVatRate(data.vat_rate);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [booking.id]);

  async function updateVatRate() {
    setError("");
    setSubmitting(true);
    try {
      const updated = await api.patch(`/api/bookings/${booking.id}/invoice`, {
        vat_rate: Number(vatRate),
      });
      setInvoice(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <span className="form-hint">Loading invoice...</span>;
  if (error) return <p className="form-error">{error}</p>;
  if (!invoice) return null;

  return (
    <div className="invoice-control">
      <span>
        {invoice.invoice_number} — subtotal ${invoice.subtotal}, VAT ${invoice.vat_amount}, total $
        {invoice.total_amount}
      </span>
      <label>
        VAT %
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
        />
      </label>
      <button onClick={updateVatRate} disabled={submitting}>
        Update VAT
      </button>
      <a
        href={`${API_URL}/api/bookings/${booking.id}/invoice/pdf`}
        target="_blank"
        rel="noreferrer"
      >
        Download Invoice PDF
      </a>
    </div>
  );
}

function ManualBookingForm({ vehicles, renters, onCreated }) {
  const [vehicleId, setVehicleId] = useState("");
  const [renterId, setRenterId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [agreedPrice, setAgreedPrice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const clients = renters.filter((r) => r.role === "client");
  const companies = renters.filter((r) => r.role === "company");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        vehicle_id: Number(vehicleId),
        start_date: startDate,
        end_date: endDate,
      };
      if (renterId) {
        payload.client_id = Number(renterId);
      } else {
        payload.guest_name = guestName;
        payload.guest_phone = guestPhone;
      }
      if (agreedPrice !== "") {
        payload.total_price = Number(agreedPrice);
      }
      await api.post("/api/bookings/manual", payload);
      setVehicleId("");
      setRenterId("");
      setGuestName("");
      setGuestPhone("");
      setStartDate("");
      setEndDate("");
      setAgreedPrice("");
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="manual-booking-form" onSubmit={handleSubmit}>
      <h2>Manual / Walk-in Booking</h2>
      {error && <p className="form-error">{error}</p>}
      <label>
        Vehicle
        <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
          <option value="">Select a vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} (${v.price_per_day}/day)
            </option>
          ))}
        </select>
      </label>
      <label>
        Renter
        <select value={renterId} onChange={(e) => setRenterId(e.target.value)}>
          <option value="">Walk-in guest (no account)</option>
          {clients.length > 0 && (
            <optgroup label="Clients">
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (@{c.username})
                </option>
              ))}
            </optgroup>
          )}
          {companies.length > 0 && (
            <optgroup label="Companies">
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (@{c.username})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {!renterId && (
        <>
          <label>
            Guest name
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </label>
          <label>
            Guest phone
            <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
          </label>
        </>
      )}
      <label>
        Start date
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
      </label>
      <label>
        End date
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />
      </label>
      <label>
        Agreed total price (optional)
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Leave blank to use the standard day-rate"
          value={agreedPrice}
          onChange={(e) => setAgreedPrice(e.target.value)}
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating..." : "Create Booking"}
      </button>
    </form>
  );
}

function PendingPayments({ onConfirmed }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    api
      .get("/api/payments?status=pending")
      .then(setPayments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function confirm(id) {
    await api.patch(`/api/payments/${id}/confirm`);
    load();
    onConfirmed();
  }

  return (
    <div className="pending-payments">
      <h2>Pending Payments</h2>
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="page-loading">Loading...</p>}
      {!loading && payments.length === 0 && <p>No pending payments.</p>}
      {payments.map((p) => (
        <div className="payment-row" key={p.id}>
          <span>
            Booking #{p.booking_id} — ${p.amount} via {p.method}
            {p.phone_number ? ` (${p.phone_number})` : ""}
          </span>
          <button onClick={() => confirm(p.id)}>Confirm &amp; Issue Receipt</button>
        </div>
      ))}
    </div>
  );
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [renters, setRenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [invoiceOpenId, setInvoiceOpenId] = useState(null);

  function loadBookings() {
    setLoading(true);
    api
      .get("/api/bookings")
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBookings();
    api.get("/api/vehicles").then(setVehicles);
    api.get("/api/users").then((users) => setRenters(users.filter((u) => u.role !== "admin")));
  }, []);

  async function changeStatus(booking, status) {
    if (status === "cancelled" && !window.confirm("Cancel this booking?")) return;
    await api.patch(`/api/bookings/${booking.id}`, { status });
    loadBookings();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Manage Bookings</h1>
        <button onClick={() => setShowManualForm((v) => !v)}>
          {showManualForm ? "Close" : "New Manual Booking"}
        </button>
      </div>

      {showManualForm && (
        <ManualBookingForm
          vehicles={vehicles}
          renters={renters}
          onCreated={() => {
            setShowManualForm(false);
            loadBookings();
          }}
        />
      )}

      <PendingPayments onConfirmed={loadBookings} />

      <h2>All Bookings</h2>
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="page-loading">Loading bookings...</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Client / Guest</th>
            <th>Dates</th>
            <th>Total</th>
            <th>Status</th>
            <th>Return</th>
            <th>Late Fee</th>
            <th>Invoice</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <Fragment key={b.id}>
              <tr>
                <td>{b.vehicle?.name}</td>
                <td>
                  {b.client ? `${b.client.name} (${b.client.role})` : `${b.guest_name} (walk-in)`}
                </td>
                <td>
                  {b.start_date} to {b.end_date}
                </td>
                <td>
                  ${b.total_price}{" "}
                  <button
                    className="link-button"
                    onClick={() => setEditingPriceId(editingPriceId === b.id ? null : b.id)}
                  >
                    {editingPriceId === b.id ? "Close" : "Edit"}
                  </button>
                </td>
                <td>
                  <select value={b.status} onChange={(e) => changeStatus(b, e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {b.actual_return_date || "not yet"}
                </td>
                <td>{b.late_fee > 0 ? `$${b.late_fee}` : "—"}</td>
                <td>
                  <button
                    className="link-button"
                    onClick={() => setInvoiceOpenId(invoiceOpenId === b.id ? null : b.id)}
                  >
                    {invoiceOpenId === b.id ? "Close" : "View"}
                  </button>
                </td>
              </tr>
              {editingPriceId === b.id && (
                <tr>
                  <td colSpan={8}>
                    <PriceControl
                      booking={b}
                      onUpdated={() => {
                        setEditingPriceId(null);
                        loadBookings();
                      }}
                    />
                  </td>
                </tr>
              )}
              {invoiceOpenId === b.id && (
                <tr>
                  <td colSpan={8}>
                    <InvoiceControl booking={b} />
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={8}>
                  <ReturnControl booking={b} onReturned={loadBookings} />
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
