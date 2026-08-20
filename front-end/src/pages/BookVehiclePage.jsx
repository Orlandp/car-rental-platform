import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calendar, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, vehicleImageUrl } from "../api/client";
import { formatKES } from "../utils/currency";
import { featureLabelMap } from "../utils/vehicleFeatures";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Field, { Input } from "../components/ui/Field";
import Alert from "../components/ui/Alert";
import Stepper from "../components/ui/Stepper";
import PageLoader from "../components/ui/PageLoader";
import FeatureBadges from "../components/ui/FeatureBadges";

const STEPS = ["Dates", "Options", "Review & Pay"];

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const d = (new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24);
  return d > 0 ? d : 0;
}

export default function BookVehiclePage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vehicle, setVehicle] = useState(null);
  const [settings, setSettings] = useState(null);
  const [meta, setMeta] = useState({ vehicle_features: [] });
  const [loadError, setLoadError] = useState("");

  const [step, setStep] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/api/vehicles/${vehicleId}`),
      api.get("/api/company-settings"),
      api.get("/api/meta"),
    ])
      .then(([v, s, m]) => {
        setVehicle(v);
        setSettings(s);
        setMeta(m);
      })
      .catch((err) => setLoadError(err.message));
  }, [vehicleId]);

  // No driver's license on file means no legal way to self-drive - every booking must
  // include a professional driver (also enforced server-side in create_booking).
  const driverMandatory = Boolean(user && !user.has_driver_license);

  useEffect(() => {
    if (driverMandatory) setWithDriver(true);
  }, [driverMandatory]);

  if (loadError) return <Alert variant="error">{loadError}</Alert>;
  if (!vehicle || !settings) return <PageLoader label="Loading vehicle..." />;

  if (user && user.verification_status !== "verified") {
    return (
      <Card className="mx-auto max-w-md p-8 text-center animate-fade-in">
        <ShieldAlert className="mx-auto mb-3 size-9 text-warning-text" />
        <h1 className="text-2xl text-text">Verify your identity first</h1>
        <p className="mt-2 text-sm text-muted">
          {user.verification_status === "pending_review"
            ? "Your documents are under review. You'll be able to book as soon as an admin approves them."
            : "We need your driver's license and national ID before you can book a vehicle."}
        </p>
        {user.verification_status !== "pending_review" && (
          <Link to="/verify">
            <Button className="mt-5">Verify now</Button>
          </Link>
        )}
      </Card>
    );
  }

  const days = daysBetween(startDate, endDate);
  const driverRate = Number(settings.driver_daily_rate);
  const subtotal = days * Number(vehicle.price_per_day);
  const driverTotal = withDriver ? days * driverRate : 0;
  const total = subtotal + driverTotal;
  const deposit = Math.round(total * (Number(settings.deposit_percentage) / 100));

  function goNext() {
    setError("");
    if (step === 0) {
      if (!startDate || !endDate) return setError("Choose both a start and end date.");
      if (days <= 0) return setError("End date must be after the start date.");
      if (new Date(startDate) < new Date(new Date().toDateString())) {
        return setError("Start date can't be in the past.");
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function confirmBooking() {
    setError("");
    setSubmitting(true);
    try {
      const data = await api.post("/api/bookings", {
        vehicle_id: vehicle.id,
        start_date: startDate,
        end_date: endDate,
        with_driver: withDriver,
      });
      navigate(`/bookings/${data.booking.id}/pay`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <button
        onClick={() => navigate("/vehicles")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text cursor-pointer"
      >
        <ArrowLeft className="size-4" /> {vehicle.name}
        {vehicle.location && <span>&middot; {vehicle.location}</span>}
      </button>

      <div className="mb-8">
        <Stepper steps={STEPS} current={step} />
      </div>

      <Alert variant="error">{error}</Alert>

      {step === 0 && vehicle.features?.length > 0 && (
        <Card className="mb-5 flex gap-4 p-4">
          {vehicle.image_url && (
            <img
              src={vehicleImageUrl(vehicle.image_url)}
              alt={vehicle.name}
              className="size-20 shrink-0 rounded-lg object-cover"
            />
          )}
          <div>
            <div className="text-sm font-semibold text-text">{vehicle.name} comes with</div>
            <FeatureBadges
              features={vehicle.features}
              labels={featureLabelMap(meta.vehicle_features)}
              className="mt-2"
            />
          </div>
        </Card>
      )}

      {step === 0 && (
        <Card className="p-6">
          <h1 className="font-display text-3xl text-text">When do you need it?</h1>
          <p className="mt-1.5 text-sm text-muted">Choose your pick-up and return dates.</p>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <Field label="Pick-up" required>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Return" required>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>

          {days > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-brand-100 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-brand-700">
                <Calendar className="size-4" /> {days}-day rental selected
              </span>
              <span className="font-semibold text-brand-700">{formatKES(subtotal)} subtotal</span>
            </div>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6">
          <h1 className="font-display text-3xl text-text">Anything else you need?</h1>
          <p className="mt-1.5 text-sm text-muted">Optional extras &mdash; your total updates as you choose.</p>

          <label
            className={
              "mt-6 flex items-center justify-between gap-4 rounded-xl border border-border p-4 " +
              (driverMandatory ? "cursor-not-allowed opacity-90" : "cursor-pointer hover:bg-surface-hover")
            }
          >
            <div className="flex items-center gap-3.5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <UserRound className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-text">Professional driver</div>
                <div className="text-xs text-muted">{formatKES(driverRate)}/day</div>
                {driverMandatory && (
                  <div className="mt-0.5 text-xs font-medium text-warning-text">
                    Required — no driver's license on file
                  </div>
                )}
              </div>
            </div>
            <input
              type="checkbox"
              checked={withDriver}
              disabled={driverMandatory}
              onChange={(e) => setWithDriver(e.target.checked)}
              className="size-5 rounded border-border accent-brand-500 disabled:cursor-not-allowed"
            />
          </label>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h1 className="font-display text-3xl text-text">Review &amp; pay</h1>
          <p className="mt-1.5 text-sm text-muted">Confirm your trip &mdash; you'll pay your deposit next.</p>

          <div className="mt-6 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-text">{vehicle.name}</span>
              <span className="text-muted">{withDriver ? "with driver" : "self-drive"}</span>
            </div>
            <div className="mt-1 text-xs text-muted">
              {startDate} to {endDate} &middot; {days} days
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-muted">
              <span>{formatKES(vehicle.price_per_day)} &times; {days} days</span>
              <span>{formatKES(subtotal)}</span>
            </div>
            {withDriver && (
              <div className="flex justify-between text-muted">
                <span>Driver &times; {days} days</span>
                <span>{formatKES(driverTotal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-text">
              <span>Total</span>
              <span>{formatKES(total)}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-100 px-4 py-3">
            <span className="text-sm font-medium text-brand-700">
              Deposit due now ({settings.deposit_percentage}%)
            </span>
            <span className="font-bold text-brand-700">{formatKES(deposit)}</span>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="size-4 text-brand-500" /> Free cancellation up to 24h before pick-up.
          </div>
        </Card>
      )}

      <div className="mt-5 flex justify-end gap-2">
        {step > 0 && (
          <Button variant="secondary" onClick={goBack}>
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={goNext}>
            Continue
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={confirmBooking} loading={submitting}>
            {submitting ? "Booking..." : "Confirm & Continue to Payment"}
          </Button>
        )}
      </div>
    </div>
  );
}
