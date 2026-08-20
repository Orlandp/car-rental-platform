import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { formatKES } from "../utils/currency";
import "../styles/bookings.css";

function PaymentPanel({ booking }) {
  const [payments, setPayments] = useState(null);
  const [receipts, setReceipts] = useState(null);

  function load() {
    api.get(`/api/bookings/${booking.id}/payments`).then(setPayments);
    api
      .get(`/api/bookings/${booking.id}/receipts`)
      .then(setReceipts)
      .catch(() => setReceipts([]));
  }

  useEffect(load, [booking.id]);

  if (payments === null) return <p className="page-loading">Loading payments...</p>;

  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.round((booking.amount_due - paidTotal) * 100) / 100;

  return (
    <div className="payment-panel">
      {payments.length > 0 && (
        <ul className="payment-list">
          {payments.map((p) => (
            <li key={p.id}>
              {formatKES(p.amount)} via {p.method} — <strong>{p.status}</strong>
              {p.mpesa_receipt && ` (M-Pesa: ${p.mpesa_receipt})`}
            </li>
          ))}
        </ul>
      )}

      {receipts && receipts.length > 0 && (
        <div className="receipt-box">
          {receipts.map((r) => (
            <p key={r.id}>
              Receipt <strong>{r.receipt_number}</strong> — {formatKES(r.amount)} paid,
              issued {new Date(r.issued_at).toLocaleString()}
            </p>
          ))}
        </div>
      )}

      {outstanding > 0 ? (
        <div>
          <p>Outstanding balance: {formatKES(outstanding)}</p>
          <Link to={`/bookings/${booking.id}/pay`}>
            <button>Pay Now</button>
          </Link>
        </div>
      ) : (
        <p>Fully paid.</p>
      )}
    </div>
  );
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  function load() {
    setLoading(true);
    api
      .get("/api/bookings")
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleInvoice(booking) {
    if (invoices[booking.id]) {
      setInvoices((prev) => ({ ...prev, [booking.id]: null }));
      return;
    }
    const invoice = await api.get(`/api/bookings/${booking.id}/invoice`);
    setInvoices((prev) => ({ ...prev, [booking.id]: invoice }));
  }

  async function cancelBooking(booking) {
    if (!window.confirm("Cancel this booking?")) return;
    try {
      await api.patch(`/api/bookings/${booking.id}`, { status: "cancelled" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function canCancel(booking) {
    return (
      (booking.status === "pending" || booking.status === "confirmed") &&
      new Date(booking.start_date) > new Date()
    );
  }

  return (
    <div className="bookings-page">
      <h1>My Bookings</h1>
      {error && <p className="form-error">{error}</p>}
      {loading && <p className="page-loading">Loading bookings...</p>}

      {bookings.map((b) => (
        <div className="booking-card" key={b.id}>
          <div className="booking-summary">
            <h2>{b.vehicle.name}</h2>
            {b.reference && <p className="booking-reference">{b.reference}</p>}
            <p>
              {b.start_date} to {b.end_date} — {formatKES(b.total_price)}
              {b.with_driver && " · with driver"}
            </p>
            {b.actual_return_date && (
              <p>
                Returned {b.actual_return_date}
                {b.late_fee > 0 && ` — late fee: ${formatKES(b.late_fee)}`}
              </p>
            )}
            <p className={`booking-status booking-status-${b.status}`}>{b.status}</p>
          </div>

          <div className="booking-actions">
            <button onClick={() => toggleInvoice(b)}>
              {invoices[b.id] ? "Hide Invoice" : "View Invoice"}
            </button>
            {canCancel(b) && <button onClick={() => cancelBooking(b)}>Cancel</button>}
            <button
              onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
            >
              {expandedId === b.id ? "Hide Payments" : "Pay / Receipt"}
            </button>
          </div>

          {invoices[b.id] && (
            <div className="invoice-box">
              <p>
                Invoice <strong>{invoices[b.id].invoice_number}</strong> —{" "}
                {formatKES(invoices[b.id].amount)}, issued{" "}
                {new Date(invoices[b.id].issued_at).toLocaleString()}
              </p>
            </div>
          )}

          {expandedId === b.id && <PaymentPanel booking={b} />}
        </div>
      ))}

      {!loading && bookings.length === 0 && <p>You have no bookings yet.</p>}
    </div>
  );
}
