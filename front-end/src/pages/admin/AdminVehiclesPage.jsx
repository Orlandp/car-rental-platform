import { Fragment, useEffect, useState } from "react";
import { api, vehicleImageUrl } from "../../api/client";
import "../../styles/admin.css";

const EMPTY_FORM = {
  name: "",
  type: "electric_car",
  make: "",
  model: "",
  year: "",
  price_per_day: "",
  status: "available",
  description: "",
};

function VehicleForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(initial);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const vehicle = await onSubmit({
        ...form,
        year: form.year ? Number(form.year) : null,
        price_per_day: Number(form.price_per_day),
      });
      if (imageFile && vehicle?.id) {
        await api.uploadFile(`/api/vehicles/${vehicle.id}/image`, imageFile);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="vehicle-form" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <label>
        Name
        <input value={form.name} onChange={(e) => update("name", e.target.value)} required />
      </label>
      <label>
        Type
        <select value={form.type} onChange={(e) => update("type", e.target.value)}>
          <option value="electric_car">Electric Car</option>
          <option value="tuk_tuk">Tuk-Tuk</option>
          <option value="fuel_car">Fuel Car</option>
        </select>
      </label>
      <label>
        Make
        <input value={form.make || ""} onChange={(e) => update("make", e.target.value)} />
      </label>
      <label>
        Model
        <input value={form.model || ""} onChange={(e) => update("model", e.target.value)} />
      </label>
      <label>
        Year
        <input
          type="number"
          value={form.year || ""}
          onChange={(e) => update("year", e.target.value)}
        />
      </label>
      <label>
        Price per day ($)
        <input
          type="number"
          step="0.01"
          value={form.price_per_day}
          onChange={(e) => update("price_per_day", e.target.value)}
          required
        />
      </label>
      <label>
        Status
        <select value={form.status} onChange={(e) => update("status", e.target.value)}>
          <option value="available">Available</option>
          <option value="booked">Booked</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </label>
      <label>
        Description
        <textarea
          value={form.description || ""}
          onChange={(e) => update("description", e.target.value)}
        />
      </label>
      <label>
        Picture
        {form.image_url && (
          <img className="vehicle-form-preview" src={vehicleImageUrl(form.image_url)} alt="" />
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => setImageFile(e.target.files[0] || null)}
        />
      </label>
      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  function load() {
    setLoading(true);
    api
      .get("/api/vehicles")
      .then(setVehicles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(data) {
    const vehicle = await api.post("/api/vehicles", data);
    setShowAddForm(false);
    load();
    return vehicle;
  }

  async function handleUpdate(id, data) {
    const vehicle = await api.patch(`/api/vehicles/${id}`, data);
    setEditingId(null);
    load();
    return vehicle;
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this vehicle? This cannot be undone.")) return;
    await api.delete(`/api/vehicles/${id}`);
    load();
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Manage Vehicles</h1>
        <button onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Close" : "Add Vehicle"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {showAddForm && (
        <VehicleForm
          initial={EMPTY_FORM}
          submitLabel="Create Vehicle"
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading && <p className="page-loading">Loading vehicles...</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Photo</th>
            <th>Name</th>
            <th>Type</th>
            <th>Price/day</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <Fragment key={v.id}>
              <tr>
                <td>
                  {v.image_url ? (
                    <img className="vehicle-thumb" src={vehicleImageUrl(v.image_url)} alt="" />
                  ) : (
                    <span className="vehicle-thumb-placeholder">No photo</span>
                  )}
                </td>
                <td>{v.name}</td>
                <td>{v.type}</td>
                <td>${v.price_per_day}</td>
                <td>{v.status}</td>
                <td className="admin-row-actions">
                  <button onClick={() => setEditingId(editingId === v.id ? null : v.id)}>
                    {editingId === v.id ? "Close" : "Edit"}
                  </button>
                  <button onClick={() => handleDelete(v.id)}>Delete</button>
                </td>
              </tr>
              {editingId === v.id && (
                <tr>
                  <td colSpan={6}>
                    <VehicleForm
                      initial={{ ...v, year: v.year || "" }}
                      submitLabel="Save Changes"
                      onSubmit={(data) => handleUpdate(v.id, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
