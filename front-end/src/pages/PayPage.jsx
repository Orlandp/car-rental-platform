import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, API_URL } from "../api/client";
import "../styles/pay.css";

const METHODS = ["mpesa", "cash", "bank_transfer", "card", "other"];

export default function PayPage() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [agreed, setAgreed] = useState(false);
  const [method, setMethod] = useState("mpesa");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState(null);

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
      .get(`/api/bookings/${bookingId}/receipt`)
      .then(setReceipt)
      .catch(() => setReceipt(null));
  }

  useEffect(load, [bookingId]);

  if (loading) return <p className="page-loading">Loading...</p>;
  if (loadError) return <p className="form-error">{loadError}</p>;
  if (!booking || !payments) return null;

  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.round((booking.amount_due - paidTotal) * 100) / 100;

  async function handlePay(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = { amount: outstanding, method };
      if (method === "mpesa") {
        payload.phone_number = phoneNumber;
      }
      const payment = await api.post(`/api/bookings/${bookingId}/payments`, payload);
      setSubmittedPayment(payment);
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
        <p>
          {booking.start_date} to {booking.end_date}
        </p>
        <p className="pay-amount">Total: ${booking.total_price}</p>
        {booking.late_fee > 0 && (
          <p className="pay-late-fee">
            Late return fee: ${booking.late_fee} — amount due: ${booking.amount_due}
          </p>
        )}
        <p className={`booking-status booking-status-${booking.status}`}>{booking.status}</p>
        <a href={`${API_URL}/api/bookings/${bookingId}/invoice/pdf`} target="_blank" rel="noreferrer">
          Download Invoice (PDF)
        </a>
      </div>

      {receipt ? (
        <div className="receipt-box">
          <p>
            Already fully paid. Receipt <strong>{receipt.receipt_number}</strong> — $
            {receipt.amount}, issued {new Date(receipt.issued_at).toLocaleString()}
          </p>
          <Link to="/my-bookings">Back to My Bookings</Link>
        </div>
      ) : submittedPayment ? (
        <div className="pay-submitted">
          <p>
            Payment request submitted for <strong>${submittedPayment.amount}</strong> via{" "}
            {submittedPayment.method}. Status: <strong>{submittedPayment.status}</strong>.
          </p>
          <p className="form-hint">
            {method === "mpesa"
              ? "M-Pesa STK Push isn't wired in yet — an admin will confirm this payment manually and issue your receipt."
              : "An admin will confirm this payment and issue your receipt."}
          </p>
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
              <li>Payment is required in full before the vehicle is released to you.</li>
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
          <h2>Pay ${outstanding}</h2>
          {error && <p className="form-error">{error}</p>}
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
