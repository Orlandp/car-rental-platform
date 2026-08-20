import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, ImageOff, MapPin, SlidersHorizontal, UserRound } from "lucide-react";
import { api, vehicleImageUrl } from "../api/client";
import { formatKES } from "../utils/currency";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Field, { Input, Select } from "../components/ui/Field";
import Alert from "../components/ui/Alert";
import { CardSkeleton } from "../components/ui/Skeleton";

const TYPE_LABELS = {
  electric_car: "Electric Car",
  tuk_tuk: "Tuk-Tuk",
  fuel_car: "Fuel Car",
};

const CATEGORY_LABELS = {
  sedan: "Sedan",
  suv: "SUV",
  van: "Van",
  pickup: "Pickup",
  minibus: "Minibus",
  tuk_tuk: "Tuk-Tuk",
  other: "Other",
};

function BookingForm({ vehicle, onDone }) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} className="mt-3 border-t border-border pt-3 animate-slide-up">
      <Alert variant="error">{error}</Alert>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Start date" className="mb-2">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        <Field label="End date" className="mb-2">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </Field>
      </div>
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={withDriver}
          onChange={(e) => setWithDriver(e.target.checked)}
          className="size-4 rounded border-border accent-brand-600"
        />
        <UserRound className="size-4 text-muted" />
        Include professional driver
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={submitting} className="flex-1 justify-center">
          {submitting ? "Booking..." : "Confirm Booking"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [meta, setMeta] = useState({ locations: [], vehicle_categories: [] });
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableTo, setAvailableTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingVehicleId, setBookingVehicleId] = useState(null);

  useEffect(() => {
    api.get("/api/meta").then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (locationFilter) params.set("location", locationFilter);
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    if (availableFrom && availableTo) {
      params.set("available_from", availableFrom);
      params.set("available_to", availableTo);
    }
    const qs = params.toString();
    api
      .get(qs ? `/api/vehicles?${qs}` : "/api/vehicles")
      .then(setVehicles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [typeFilter, categoryFilter, locationFilter, minPrice, maxPrice, availableFrom, availableTo]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text">Available Vehicles</h1>
      </div>

      <Card className="mb-6 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
          <SlidersHorizontal className="size-4" />
          Filters
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="electric_car">Electric Car</option>
            <option value="tuk_tuk">Tuk-Tuk</option>
            <option value="fuel_car">Fuel Car</option>
          </Select>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {meta.vehicle_categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] || c}
              </option>
            ))}
          </Select>
          <Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">All locations</option>
            {meta.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          <Input type="number" placeholder="Min KSh/day" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <Input type="number" placeholder="Max KSh/day" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <Input
            type="date"
            aria-label="Available from"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
          />
          <Input
            type="date"
            aria-label="Available to"
            value={availableTo}
            onChange={(e) => setAvailableTo(e.target.value)}
          />
        </div>
      </Card>

      <Alert variant="error">{error}</Alert>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center text-muted">
          <Car className="size-8" />
          <p>No vehicles match those filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => (
            <Card key={v.id} className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
              {v.image_url ? (
                <img
                  className="h-40 w-full object-cover"
                  src={vehicleImageUrl(v.image_url)}
                  alt={v.name}
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-surface-hover text-muted">
                  <ImageOff className="size-6" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-text">{v.name}</h2>
                  <Badge status={v.status} />
                </div>
                <p className="text-xs text-muted">
                  {TYPE_LABELS[v.type] || v.type}
                  {v.category ? ` · ${CATEGORY_LABELS[v.category] || v.category}` : ""}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {v.make} {v.model} {v.year ? `(${v.year})` : ""}
                </p>
                {v.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <MapPin className="size-3.5" /> {v.location}
                  </p>
                )}
                <p className="mt-3 text-lg font-bold text-text">
                  {formatKES(v.price_per_day)}
                  <span className="text-sm font-normal text-muted"> / day</span>
                </p>

                <div className="mt-auto pt-3">
                  {bookingVehicleId === v.id ? (
                    <BookingForm vehicle={v} onDone={() => setBookingVehicleId(null)} />
                  ) : (
                    <Button
                      className="w-full justify-center"
                      disabled={v.status !== "available"}
                      onClick={() => setBookingVehicleId(v.id)}
                    >
                      {v.status === "available" ? "Book" : "Unavailable"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
