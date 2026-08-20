import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, vehicleImageUrl } from "../api/client";
import { formatKES } from "../utils/currency";
import "../styles/vehicles.css";

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
    <form className="booking-form" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
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
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={withDriver}
          onChange={(e) => setWithDriver(e.target.checked)}
        />
        Include professional driver
      </label>
      <div className="booking-form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Booking..." : "Confirm Booking"}
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
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
    <div className="vehicles-page">
      <div className="vehicles-header">
        <h1>Available Vehicles</h1>
      </div>

      <div className="vehicles-filters">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="electric_car">Electric Car</option>
          <option value="tuk_tuk">Tuk-Tuk</option>
          <option value="fuel_car">Fuel Car</option>
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {meta.vehicle_categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] || c}
            </option>
          ))}
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
          <option value="">All locations</option>
          {meta.locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Min KSh/day"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <input
          type="number"
          placeholder="Max KSh/day"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
        <label className="filter-date-label">
          From
          <input
            type="date"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
          />
        </label>
        <label className="filter-date-label">
          To
          <input type="date" value={availableTo} onChange={(e) => setAvailableTo(e.target.value)} />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="page-loading">Loading vehicles...</p>}

      <div className="vehicle-grid">
        {vehicles.map((v) => (
          <div className="vehicle-card" key={v.id}>
            {v.image_url ? (
              <img className="vehicle-photo" src={vehicleImageUrl(v.image_url)} alt={v.name} />
            ) : (
              <div className="vehicle-photo vehicle-photo-placeholder">No photo</div>
            )}
            <h2>{v.name}</h2>
            <p className="vehicle-type">
              {TYPE_LABELS[v.type] || v.type}
              {v.category ? ` · ${CATEGORY_LABELS[v.category] || v.category}` : ""}
            </p>
            <p>
              {v.make} {v.model} {v.year ? `(${v.year})` : ""}
            </p>
            {v.location && <p className="vehicle-location">📍 {v.location}</p>}
            <p className="vehicle-price">{formatKES(v.price_per_day)} / day</p>
            <p className={`vehicle-status vehicle-status-${v.status}`}>{v.status}</p>

            {bookingVehicleId === v.id ? (
              <BookingForm vehicle={v} onDone={() => setBookingVehicleId(null)} />
            ) : (
              <button
                disabled={v.status !== "available"}
                onClick={() => setBookingVehicleId(v.id)}
              >
                Book
              </button>
            )}
          </div>
        ))}
      </div>

      {!loading && vehicles.length === 0 && <p>No vehicles found.</p>}
    </div>
  );
}
