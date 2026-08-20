import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, API_URL } from "../api/client";
import { formatKES } from "../utils/currency";
import "../styles/pay.css";

const METHODS = ["mpesa", "cash", "bank_transfer", "card", "other"];

export default function PayPage() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState(null);
  const [receipts, setReceipts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [agreed, setAgreed] = useState(false);
  const [payOption, setPayOption] = useState("deposit");
  const [method, setMethod] = useState("mpesa");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState(null);
  const [submittedReceipt, setSubmittedReceipt] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([
      api.get(`/api/bookings/${bookingId}`),
      api.get(`/api/bookings/${bookingId}/payments`),
    ])
      .then(([bookingData, paymentsData]) => {
        setBooking(bookingData);
        setPayments(paymentsData);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));

    api
      .get(`/api/bookings/${bookingId}/receipts`)
      .then(setReceipts)
      .catch(() => setReceipts([]));
  }

  useEffect(load, [bookingId]);

  if (loading) return <p className="page-loading">Loading...</p>;
  if (loadError) return <p className="form-error">{loadError}</p>;
  if (!booking || !payments) return null;

  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.round((booking.amount_due - paidTotal) * 100) / 100;
  const depositRemaining = Math.max(0, booking.deposit_amount - paidTotal);
  const amountToPay = payOption === "deposit" && depositRemaining > 0
    ? Math.min(depositRemaining, outstanding)
    : outstanding;

  async function handlePay(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = { amount: amountToPay, method };
      if (method === "mpesa") {
        payload.phone_number = phoneNumber;
      }
      const data = await api.post(`/api/bookings/${bookingId}/payments`, payload);
      setSubmittedPayment(data.payment);
      setSubmittedReceipt(data.receipt);
      api.get(`/api/bookings/${bookingId}`).then(setBooking);
      api.get(`/api/bookings/${bookingId}/payments`).then(setPayments);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pay-page">
      <h1>Payment</h1>

      <div className="pay-summary">
        <h2>{booking.vehicle.name}</h2>
        {booking.reference && (
          <p className="booking-reference">Booking ref: {booking.reference}</p>
        )}
        <p>
          {booking.start_date} to {booking.end_date}
          {booking.with_driver && " · with driver"}
        </p>
        <p className="pay-amount">Total: {formatKES(booking.total_price)}</p>
        <p>Deposit (30%): {formatKES(booking.deposit_amount)}</p>
        {booking.late_fee > 0 && (
          <p className="pay-late-fee">
            Late return fee: {formatKES(booking.late_fee)} — amount due: {formatKES(booking.amount_due)}
          </p>
        )}
        <p className={`booking-status booking-status-${booking.status}`}>{booking.status}</p>
        <a href={`${API_URL}/api/bookings/${bookingId}/invoice/pdf`} target="_blank" rel="noreferrer">
          Download Invoice (PDF)
        </a>
      </div>

      {receipts && receipts.length > 0 && (
        <div className="receipt-box">
          {receipts.map((r) => (
            <p key={r.id}>
              Receipt <strong>{r.receipt_number}</strong> — {formatKES(r.amount)}, issued{" "}
              {new Date(r.issued_at).toLocaleString()}
            </p>
          ))}
        </div>
      )}

      {outstanding <= 0 ? (
        <div className="receipt-box">
          <p>Fully paid.</p>
          <Link to="/my-bookings">Back to My Bookings</Link>
        </div>
      ) : submittedPayment ? (
        <div className="pay-submitted">
          <p>
            Paid <strong>{formatKES(submittedPayment.amount)}</strong> via {submittedPayment.method}.
            Status: <strong>{submittedPayment.status}</strong>.
          </p>
          {submittedReceipt ? (
            <p className="form-hint">
              Receipt <strong>{submittedReceipt.receipt_number}</strong>
              {submittedPayment.mpesa_receipt && ` — M-Pesa code ${submittedPayment.mpesa_receipt}`}.
            </p>
          ) : (
            <p className="form-hint">An admin will confirm this payment and issue your receipt.</p>
          )}
          <Link to="/my-bookings">Back to My Bookings</Link>
        </div>
      ) : !agreed ? (
        <div className="terms-box">
          <h2>Terms &amp; Conditions</h2>
          <div className="terms-text">
            <p>By proceeding with this booking and payment, you agree that:</p>
            <ul>
              <li>The vehicle must be returned on the agreed end date in the condition it was collected in.</li>
              <li>You are responsible for any traffic fines, tolls, or damage incurred during the rental period.</li>
              <li>Fuel/charge level must match the level at pickup, or a refuelling fee applies.</li>
              <li>Cancellations made less than 24 hours before the start date may not be refunded.</li>
              <li>A 30% deposit confirms the booking; the balance is due before the vehicle is released to you.</li>
            </ul>
          </div>
          <label className="terms-agree">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            I have read and agree to the terms and conditions
          </label>
          <button disabled={!agreed} onClick={() => setAgreed(true)}>
            Continue to Payment
          </button>
        </div>
      ) : (
        <form className="pay-form-page" onSubmit={handlePay}>
          {error && <p className="form-error">{error}</p>}
          {depositRemaining > 0 && (
            <label>
              Pay
              <select value={payOption} onChange={(e) => setPayOption(e.target.value)}>
                <option value="deposit">Deposit only ({formatKES(Math.min(depositRemaining, outstanding))})</option>
                <option value="full">Full balance ({formatKES(outstanding)})</option>
              </select>
            </label>
          )}
          <h2>Pay {formatKES(amountToPay)}</h2>
          <label>
            Payment method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          {method === "mpesa" && (
            <label>
              M-Pesa phone number
              <input
                type="tel"
                placeholder="07XXXXXXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
              />
            </label>
          )}
          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : method === "mpesa" ? "Pay with M-Pesa" : "Submit Payment"}
          </button>
          <button type="button" onClick={() => setAgreed(false)}>
            Back
          </button>
        </form>
      )}
    </div>
  );
}
