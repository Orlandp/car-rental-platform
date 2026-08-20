import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, vehicleImageUrl } from "../api/client";
import "../styles/vehicles.css";

const TYPE_LABELS = {
  electric_car: "Electric Car",
  tuk_tuk: "Tuk-Tuk",
  fuel_car: "Fuel Car",
};

function BookingForm({ vehicle, onDone }) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingVehicleId, setBookingVehicleId] = useState(null);

  useEffect(() => {
    setLoading(true);
    const path = typeFilter ? `/api/vehicles?type=${typeFilter}` : "/api/vehicles";
    api
      .get(path)
      .then(setVehicles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  return (
    <div className="vehicles-page">
      <div className="vehicles-header">
        <h1>Available Vehicles</h1>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="electric_car">Electric Car</option>
          <option value="tuk_tuk">Tuk-Tuk</option>
          <option value="fuel_car">Fuel Car</option>
        </select>
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
            <p className="vehicle-type">{TYPE_LABELS[v.type] || v.type}</p>
            <p>
              {v.make} {v.model} {v.year ? `(${v.year})` : ""}
            </p>
            <p className="vehicle-price">${v.price_per_day} / day</p>
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
