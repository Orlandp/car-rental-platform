import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Car,
  ChevronDown,
  FileText,
  Receipt as ReceiptIcon,
  XCircle,
} from "lucide-react";
import { api } from "../api/client";
import { formatKES } from "../utils/currency";
import { useConfirm } from "../context/ConfirmContext";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import PageLoader from "../components/ui/PageLoader";
import { CardSkeleton } from "../components/ui/Skeleton";

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

  if (payments === null) return <p className="text-sm text-muted">Loading payments...</p>;

  const paidTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.round((booking.amount_due - paidTotal) * 100) / 100;

  return (
    <div className="mt-3 border-t border-border pt-3">
      {payments.length > 0 && (
        <ul className="mb-3 space-y-1.5 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span className="text-muted">
                {formatKES(p.amount)} via {p.method}
                {p.mpesa_receipt && ` (${p.mpesa_receipt})`}
              </span>
              <Badge status={p.status} />
            </li>
          ))}
        </ul>
      )}

      {receipts && receipts.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {receipts.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-lg bg-success-bg px-3 py-2 text-xs text-success-text"
            >
              <ReceiptIcon className="size-3.5 shrink-0" />
              Receipt <strong>{r.receipt_number}</strong> — {formatKES(r.amount)}
            </div>
          ))}
        </div>
      )}

      {outstanding > 0 ? (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Outstanding: {formatKES(outstanding)}</span>
          <Link to={`/bookings/${booking.id}/pay`}>
            <Button size="sm">Pay Now</Button>
          </Link>
        </div>
      ) : (
        <p className="text-sm text-success-text">Fully paid.</p>
      )}
    </div>
  );
}

export default function MyBookingsPage() {
  const confirm = useConfirm();
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
    const ok = await confirm({
      title: "Cancel this booking?",
      message: `${booking.vehicle.name} · ${booking.start_date} to ${booking.end_date}. This can't be undone.`,
      confirmLabel: "Cancel booking",
      cancelLabel: "Keep booking",
    });
    if (!ok) return;
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
    <div className="animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold text-text">My Bookings</h1>
      <Alert variant="error">{error}</Alert>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center text-muted">
          <Car className="size-8" />
          <p>You have no bookings yet.</p>
          <Link to="/vehicles">
            <Button size="sm" className="mt-2">
              Browse vehicles
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <Card key={b.id} className="p-5 animate-slide-up">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-text">{b.vehicle.name}</h2>
                    <Badge status={b.status} />
                  </div>
                  {b.reference && <p className="mt-0.5 font-mono text-xs text-muted">{b.reference}</p>}
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <Calendar className="size-3.5" />
                    {b.start_date} to {b.end_date} — {formatKES(b.total_price)}
                    {b.with_driver && " · with driver"}
                  </p>
                  {b.actual_return_date && (
                    <p className="mt-0.5 text-sm text-muted">
                      Returned {b.actual_return_date}
                      {b.late_fee > 0 && ` — late fee: ${formatKES(b.late_fee)}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={FileText} onClick={() => toggleInvoice(b)}>
                  {invoices[b.id] ? "Hide Invoice" : "View Invoice"}
                </Button>
                {canCancel(b) && (
                  <Button variant="secondary" size="sm" icon={XCircle} onClick={() => cancelBooking(b)}>
                    Cancel
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronDown}
                  onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                >
                  {expandedId === b.id ? "Hide Payments" : "Pay / Receipt"}
                </Button>
              </div>

              {invoices[b.id] && (
                <div className="mt-3 rounded-lg bg-surface-hover px-3 py-2 text-sm text-muted">
                  Invoice <strong className="text-text">{invoices[b.id].invoice_number}</strong> —{" "}
                  {formatKES(invoices[b.id].amount)}, issued{" "}
                  {new Date(invoices[b.id].issued_at).toLocaleString()}
                </div>
              )}

              {expandedId === b.id && <PaymentPanel booking={b} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
