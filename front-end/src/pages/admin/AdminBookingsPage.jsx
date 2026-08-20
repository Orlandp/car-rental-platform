import { Fragment, useEffect, useState } from "react";
import {
  CalendarCheck,
  Download,
  Plus,
  Receipt as ReceiptIcon,
  UserRound,
  X,
} from "lucide-react";
import { api, API_URL } from "../../api/client";
import { formatKES } from "../../utils/currency";
import { useConfirm } from "../../context/ConfirmContext";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field, { Input, Select } from "../../components/ui/Field";
import Alert from "../../components/ui/Alert";
import PageLoader from "../../components/ui/PageLoader";

const STATUSES = ["pending", "confirmed", "cancelled", "completed"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function PaymentStatus({ booking }) {
  const paid = booking.paid_amount || 0;
  const outstanding = booking.outstanding_balance ?? booking.amount_due - paid;

  if (paid <= 0) {
    return <Badge tone="neutral">Unpaid</Badge>;
  }
  if (outstanding > 0.01) {
    return (
      <div>
        <Badge tone="warning">Partially paid</Badge>
        <div className="mt-1 text-xs text-muted">{formatKES(paid)} of {formatKES(booking.amount_due)}</div>
      </div>
    );
  }
  return (
    <div>
      <Badge tone="success">Paid</Badge>
      <div className="mt-1 text-xs text-muted">{formatKES(paid)}</div>
    </div>
  );
}

function ReturnControl({ booking, onReturned }) {
  const [returnDate, setReturnDate] = useState(booking.actual_return_date || todayIso());
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function markReturned() {
    setError("");
    setSubmitting(true);
    try {
      await api.patch(`/api/bookings/${booking.id}/return`, { actual_return_date: returnDate });
      onReturned();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (booking.status === "cancelled") return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
      {error && <span className="text-danger-text">{error}</span>}
      <Input
        type="date"
        value={returnDate}
        onChange={(e) => setReturnDate(e.target.value)}
        className="h-8! w-auto"
      />
      <Button size="sm" variant="secondary" icon={CalendarCheck} onClick={markReturned} loading={submitting}>
        {booking.actual_return_date ? "Update Return" : "Mark Returned"}
      </Button>
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
    <div className="flex items-center gap-2 p-4">
      {error && <span className="text-sm text-danger-text">{error}</span>}
      <Input
        type="number"
        step="0.01"
        min="0"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="h-8! w-32"
      />
      <Button size="sm" variant="secondary" onClick={updatePrice} loading={submitting}>
        Update Agreed Price
      </Button>
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
      const updated = await api.patch(`/api/bookings/${booking.id}/invoice`, { vat_rate: Number(vatRate) });
      setInvoice(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <span className="block p-4 text-sm text-muted">Loading invoice...</span>;
  if (error) return <Alert variant="error" className="m-4">{error}</Alert>;
  if (!invoice) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
      <span className="text-muted">
        {invoice.invoice_number} — subtotal {formatKES(invoice.subtotal)}, VAT {formatKES(invoice.vat_amount)},
        total <strong className="text-text">{formatKES(invoice.total_amount)}</strong>
      </span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={vatRate}
          onChange={(e) => setVatRate(e.target.value)}
          className="h-8! w-20"
        />
        <Button size="sm" variant="secondary" onClick={updateVatRate} loading={submitting}>
          Update VAT
        </Button>
      </div>
      <a
        href={`${API_URL}/api/bookings/${booking.id}/invoice/pdf`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
      >
        <Download className="size-3.5" /> Download PDF
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
      const payload = { vehicle_id: Number(vehicleId), start_date: startDate, end_date: endDate };
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
    <Card className="mb-6 p-5">
      <h2 className="mb-4 font-semibold text-text">Manual / Walk-in Booking</h2>
      <form onSubmit={handleSubmit}>
        <Alert variant="error">{error}</Alert>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Vehicle" required>
            <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
              <option value="">Select a vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({formatKES(v.price_per_day)}/day)
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Renter">
            <Select value={renterId} onChange={(e) => setRenterId(e.target.value)}>
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
            </Select>
          </Field>
          {!renterId && (
            <>
              <Field label="Guest name">
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              </Field>
              <Field label="Guest phone">
                <Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Start date" required>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </Field>
          <Field label="End date" required>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </Field>
          <Field label="Agreed total price (optional)" hint="Leave blank to use the standard day-rate">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={agreedPrice}
              onChange={(e) => setAgreedPrice(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" loading={submitting}>
          {submitting ? "Creating..." : "Create Booking"}
        </Button>
      </form>
    </Card>
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

  async function confirmPayment(id) {
    await api.patch(`/api/payments/${id}/confirm`);
    load();
    onConfirmed();
  }

  return (
    <Card className="mb-6 p-5">
      <h2 className="mb-3 font-semibold text-text">Pending Payments</h2>
      <Alert variant="error">{error}</Alert>
      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-muted">No pending payments.</p>
      ) : (
        <div className="divide-y divide-border">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-text">
                Booking #{p.booking_id} — {formatKES(p.amount)} via {p.method}
                {p.phone_number ? ` (${p.phone_number})` : ""}
              </span>
              <Button size="sm" icon={ReceiptIcon} onClick={() => confirmPayment(p.id)}>
                Confirm &amp; Issue Receipt
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AdminBookingsPage() {
  const confirm = useConfirm();
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
    if (status === "cancelled") {
      const ok = await confirm({
        title: "Cancel this booking?",
        message: `${booking.vehicle?.name || "This booking"} will be marked cancelled and any paid amount refunded.`,
        confirmLabel: "Cancel booking",
        cancelLabel: "Keep booking",
      });
      if (!ok) return;
    }
    await api.patch(`/api/bookings/${booking.id}`, { status });
    loadBookings();
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl text-text">Manage Bookings</h1>
        <Button icon={showManualForm ? X : Plus} onClick={() => setShowManualForm((v) => !v)}>
          {showManualForm ? "Close" : "New Manual Booking"}
        </Button>
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

      <h2 className="mb-3 text-lg font-semibold text-text">All Bookings</h2>
      <Alert variant="error">{error}</Alert>

      {loading ? (
        <PageLoader />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-hover text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Client / Guest</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Return</th>
                  <th className="px-4 py-3">Late Fee</th>
                  <th className="px-4 py-3">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <Fragment key={b.id}>
                    <tr className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3 font-mono text-xs text-muted">{b.reference || `#${b.id}`}</td>
                      <td className="px-4 py-3 text-text">
                        {b.vehicle?.name}
                        {b.with_driver && (
                          <UserRound className="ml-1 inline size-3.5 text-muted" aria-label="with driver" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {b.client ? `${b.client.name} (${b.client.role})` : `${b.guest_name} (walk-in)`}
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {b.start_date} to {b.end_date}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-text">{formatKES(b.total_price)}</span>
                          <button
                            className="text-xs font-medium text-brand-600 hover:underline cursor-pointer"
                            onClick={() => setEditingPriceId(editingPriceId === b.id ? null : b.id)}
                          >
                            {editingPriceId === b.id ? "Close" : "Edit"}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatus booking={b} />
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={b.status}
                          onChange={(e) => changeStatus(b, e.target.value)}
                          className="h-8! text-xs"
                          wrapperClassName="min-w-[9.5rem]"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-muted">{b.actual_return_date || "not yet"}</td>
                      <td className="px-4 py-3 text-muted">{b.late_fee > 0 ? formatKES(b.late_fee) : "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          className="text-xs font-medium text-brand-600 hover:underline cursor-pointer"
                          onClick={() => setInvoiceOpenId(invoiceOpenId === b.id ? null : b.id)}
                        >
                          {invoiceOpenId === b.id ? "Close" : "View"}
                        </button>
                      </td>
                    </tr>
                    {editingPriceId === b.id && (
                      <tr>
                        <td colSpan={10} className="bg-surface-hover">
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
                        <td colSpan={10} className="bg-surface-hover">
                          <InvoiceControl booking={b} />
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-border last:border-0">
                      <td colSpan={10} className="bg-surface-hover">
                        <ReturnControl booking={b} onReturned={loadBookings} />
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
