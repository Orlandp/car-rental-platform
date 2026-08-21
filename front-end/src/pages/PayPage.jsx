import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Receipt as ReceiptIcon,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { api, API_URL } from "../api/client";
import { formatKES } from "../utils/currency";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Stepper from "../components/ui/Stepper";
import Field, { Input, Select } from "../components/ui/Field";
import Alert from "../components/ui/Alert";
import PageLoader from "../components/ui/PageLoader";

const METHODS = ["mpesa", "cash", "bank_transfer", "card", "other"];
const METHOD_LABELS = {
  mpesa: "M-Pesa",
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

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
  const [pollingPayment, setPollingPayment] = useState(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  if (loading) return <PageLoader />;
  if (loadError) return <Alert variant="error">{loadError}</Alert>;
  if (!booking || !payments) return null;

  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.round((booking.amount_due - paidTotal) * 100) / 100;
  const depositRemaining = Math.max(0, booking.deposit_amount - paidTotal);
  const amountToPay =
    payOption === "deposit" && depositRemaining > 0
      ? Math.min(depositRemaining, outstanding)
      : outstanding;

  function refreshBookingAndPayments() {
    api.get(`/api/bookings/${bookingId}`).then(setBooking);
    api.get(`/api/bookings/${bookingId}/payments`).then(setPayments);
  }

  function pollMpesaResult(paymentId, attempt = 0) {
    const MAX_ATTEMPTS = 30; // ~90s at 3s intervals - STK push prompts expire around then anyway
    setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        const list = await api.get(`/api/bookings/${bookingId}/payments`);
        const current = list.find((p) => p.id === paymentId);
        if (!mountedRef.current) return;

        if (current?.status === "paid") {
          setPollingPayment(null);
          setSubmittedPayment(current);
          const receiptsList = await api.get(`/api/bookings/${bookingId}/receipts`);
          if (!mountedRef.current) return;
          setSubmittedReceipt(receiptsList.find((r) => r.payment_id === paymentId) || null);
          refreshBookingAndPayments();
          return;
        }
        if (current?.status === "failed") {
          setPollingPayment(null);
          setError(current.result_desc || "The M-Pesa payment failed or was cancelled.");
          refreshBookingAndPayments();
          return;
        }
        if (attempt + 1 >= MAX_ATTEMPTS) {
          setPollingPayment(null);
          setPollTimedOut(true);
          return;
        }
        pollMpesaResult(paymentId, attempt + 1);
      } catch (err) {
        if (mountedRef.current) {
          setPollingPayment(null);
          setError(err.message);
        }
      }
    }, 3000);
  }

  async function handlePay(e) {
    e.preventDefault();
    setError("");
    setPollTimedOut(false);
    setSubmitting(true);
    try {
      const payload = { amount: amountToPay, method };
      if (method === "mpesa") {
        payload.phone_number = phoneNumber;
      }
      const data = await api.post(`/api/bookings/${bookingId}/payments`, payload);
      if (method === "mpesa" && data.payment.status === "pending") {
        setPollingPayment(data.payment);
        pollMpesaResult(data.payment.id);
      } else {
        setSubmittedPayment(data.payment);
        setSubmittedReceipt(data.receipt);
        refreshBookingAndPayments();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-in">
      <Link to="/my-bookings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Back to My Bookings
      </Link>

      <div className="mb-6">
        <Stepper steps={["Dates", "Options", "Review & Pay"]} current={2} />
      </div>

      <h1 className="mb-4 text-3xl text-text">Payment</h1>

      <Card className="mb-6 p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2 className="font-semibold text-text">{booking.vehicle.name}</h2>
          <Badge status={booking.status} />
        </div>
        {booking.reference && (
          <p className="mb-1 font-mono text-xs text-muted">{booking.reference}</p>
        )}
        <p className="text-sm text-muted">
          {booking.start_date} to {booking.end_date}
          {booking.with_driver && " · with driver"}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm text-muted">Total</span>
          <span className="font-semibold text-text">{formatKES(booking.total_price)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Deposit (30%)</span>
          <span className="text-sm text-text">{formatKES(booking.deposit_amount)}</span>
        </div>
        {booking.late_fee > 0 && (
          <div className="flex items-center justify-between text-danger-text">
            <span className="text-sm">Late return fee</span>
            <span className="text-sm font-medium">{formatKES(booking.late_fee)}</span>
          </div>
        )}
        <a
          href={`${API_URL}/api/bookings/${bookingId}/invoice/pdf`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          <Download className="size-4" /> Download Invoice (PDF)
        </a>
      </Card>

      {receipts && receipts.length > 0 && (
        <div className="mb-6 space-y-2">
          {receipts.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-success-bg px-4 py-3 text-sm text-success-text"
            >
              <span className="flex items-center gap-2">
                <ReceiptIcon className="size-4 shrink-0" />
                Receipt <strong>{r.receipt_number}</strong> — {formatKES(r.amount)}, issued{" "}
                {new Date(r.issued_at).toLocaleString()}
              </span>
              <a
                href={`${API_URL}/api/receipts/${r.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline hover:no-underline"
              >
                Download PDF
              </a>
            </div>
          ))}
        </div>
      )}

      {outstanding <= 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <CheckCircle2 className="size-8 text-success-text" />
          <p className="font-medium text-text">Fully paid.</p>
        </Card>
      ) : pollingPayment ? (
        <Card className="p-6 text-center animate-scale-in">
          <Smartphone className="mx-auto mb-3 size-10 animate-pulse text-brand-600" />
          <p className="font-medium text-text">Check your phone</p>
          <p className="mt-1 text-sm text-muted">
            An M-Pesa prompt was sent to <strong>{pollingPayment.phone_number}</strong> for{" "}
            {formatKES(pollingPayment.amount)}. Enter your M-Pesa PIN to complete the payment.
          </p>
          <p className="mt-3 text-xs text-muted">Waiting for confirmation…</p>
        </Card>
      ) : pollTimedOut ? (
        <Card className="p-6 text-center">
          <Clock className="mx-auto mb-3 size-10 text-warning-text" />
          <p className="font-medium text-text">Still waiting on M-Pesa</p>
          <p className="mt-1 text-sm text-muted">
            We haven't received a confirmation yet. If you completed the prompt on your phone, it
            may just be delayed — check My Bookings shortly. Otherwise, try again below.
          </p>
          <Button onClick={() => setPollTimedOut(false)} className="mt-4 justify-center">
            Try Again
          </Button>
        </Card>
      ) : submittedPayment ? (
        <Card className="p-6 text-center animate-scale-in">
          <CheckCircle2 className="mx-auto mb-3 size-10 text-success-text" />
          <p className="text-text">
            Paid <strong>{formatKES(submittedPayment.amount)}</strong> via{" "}
            {METHOD_LABELS[submittedPayment.method]}.
          </p>
          {submittedReceipt ? (
            <p className="mt-1 text-sm text-muted">
              Receipt <strong>{submittedReceipt.receipt_number}</strong>
              {submittedPayment.mpesa_receipt && ` — M-Pesa code ${submittedPayment.mpesa_receipt}`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">An admin will confirm this payment and issue your receipt.</p>
          )}
        </Card>
      ) : !agreed ? (
        <Card className="p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-text">
            <ShieldCheck className="size-5 text-brand-600" /> Terms &amp; Conditions
          </h2>
          <ul className="mb-4 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-4 text-sm text-muted">
            <li>The vehicle must be returned on the agreed end date in the condition it was collected in.</li>
            <li>You are responsible for any traffic fines, tolls, or damage incurred during the rental period.</li>
            <li>Fuel/charge level must match the level at pickup, or a refuelling fee applies.</li>
            <li>Cancellations made less than 24 hours before the start date may not be refunded.</li>
            <li>A 30% deposit confirms the booking; the balance is due before the vehicle is released to you.</li>
          </ul>
          <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="size-4 rounded border-border accent-brand-600"
            />
            I have read and agree to the terms and conditions
          </label>
          <Button disabled={!agreed} onClick={() => setAgreed(true)} className="w-full justify-center">
            Continue to Payment
          </Button>
        </Card>
      ) : (
        <Card className="p-6">
          <form onSubmit={handlePay}>
            <Alert variant="error">{error}</Alert>
            {depositRemaining > 0 && (
              <Field label="Pay">
                <Select value={payOption} onChange={(e) => setPayOption(e.target.value)}>
                  <option value="deposit">
                    Deposit only ({formatKES(Math.min(depositRemaining, outstanding))})
                  </option>
                  <option value="full">Full balance ({formatKES(outstanding)})</option>
                </Select>
              </Field>
            )}
            <h2 className="mb-4 text-xl font-bold text-text">Pay {formatKES(amountToPay)}</h2>
            <Field label="Payment method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            {method === "mpesa" && (
              <Field label="M-Pesa phone number" required>
                <Input
                  type="tel"
                  placeholder="07XXXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </Field>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                loading={submitting}
                icon={method === "mpesa" ? Smartphone : undefined}
                className="flex-1 justify-center"
              >
                {submitting ? "Submitting..." : method === "mpesa" ? "Pay with M-Pesa" : "Submit Payment"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setAgreed(false)}>
                Back
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
