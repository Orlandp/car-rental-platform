import { Fragment, useEffect, useState } from "react";
import { Check, ImageOff, Plus, Trash2, Upload, X } from "lucide-react";
import { api, vehicleImageUrl } from "../../api/client";
import { formatKES } from "../../utils/currency";
import { featureIcon } from "../../utils/vehicleFeatures";
import { useConfirm } from "../../context/ConfirmContext";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Field, { Input, Select, Textarea } from "../../components/ui/Field";
import Alert from "../../components/ui/Alert";
import PageLoader from "../../components/ui/PageLoader";
import FeatureBadges from "../../components/ui/FeatureBadges";

const EMPTY_FORM = {
  name: "",
  type: "electric_car",
  category: "sedan",
  location: "",
  make: "",
  model: "",
  year: "",
  price_per_day: "",
  status: "available",
  description: "",
  features: [],
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

function VehicleForm({ initial, meta, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(initial);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleFeature(key) {
    setForm((prev) => {
      const current = prev.features || [];
      const features = current.includes(key)
        ? current.filter((f) => f !== key)
        : [...current, key];
      return { ...prev, features };
    });
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
    <Card className="mb-4 p-5">
      <form onSubmit={handleSubmit}>
        <Alert variant="error">{error}</Alert>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={(e) => update("type", e.target.value)}>
              <option value="electric_car">Electric Car</option>
              <option value="tuk_tuk">Tuk-Tuk</option>
              <option value="fuel_car">Fuel Car</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={form.category || ""} onChange={(e) => update("category", e.target.value)}>
              <option value="">Not set</option>
              {meta.vehicle_categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] || c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location" required>
            <Select value={form.location || ""} onChange={(e) => update("location", e.target.value)} required>
              <option value="">Select a location</option>
              {meta.locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Make">
            <Input value={form.make || ""} onChange={(e) => update("make", e.target.value)} />
          </Field>
          <Field label="Model">
            <Input value={form.model || ""} onChange={(e) => update("model", e.target.value)} />
          </Field>
          <Field label="Year">
            <Input type="number" value={form.year || ""} onChange={(e) => update("year", e.target.value)} />
          </Field>
          <Field label="Price per day (KSh)" required>
            <Input
              type="number"
              step="0.01"
              value={form.price_per_day}
              onChange={(e) => update("price_per_day", e.target.value)}
              required
            />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => update("status", e.target.value)}>
              <option value="available">Available</option>
              <option value="booked">Booked</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={form.description || ""} onChange={(e) => update("description", e.target.value)} />
        </Field>
        <Field label="Features & amenities" hint="Shown to customers on the listing and booking flow">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {meta.vehicle_features.map(({ key, label }) => {
              const Icon = featureIcon(key);
              const selected = (form.features || []).includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => toggleFeature(key)}
                  className={
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors cursor-pointer " +
                    (selected
                      ? "border-brand-500 bg-brand-100 text-brand-700"
                      : "border-border text-muted hover:bg-surface-hover")
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {selected && <Check className="size-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Picture">
          <div className="flex items-center gap-3">
            {form.image_url && (
              <img
                className="size-16 rounded-lg object-cover border border-border"
                src={vehicleImageUrl(form.image_url)}
                alt=""
              />
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted hover:bg-surface-hover">
              <Upload className="size-4" />
              {imageFile ? imageFile.name : "Choose image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files[0] || null)}
              />
            </label>
          </div>
        </Field>
        <div className="mt-2 flex gap-2">
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function AdminVehiclesPage() {
  const confirm = useConfirm();
  const [vehicles, setVehicles] = useState([]);
  const [meta, setMeta] = useState({ locations: [], vehicle_categories: [], vehicle_features: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    api.get("/api/meta").then(setMeta).catch(() => {});
  }, []);

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

  async function handleDelete(vehicle) {
    const ok = await confirm({
      title: "Delete this vehicle?",
      message: `${vehicle.name} will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    await api.delete(`/api/vehicles/${vehicle.id}`);
    load();
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl text-text">Manage Vehicles</h1>
        <Button icon={showAddForm ? X : Plus} onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Close" : "Add Vehicle"}
        </Button>
      </div>

      <Alert variant="error">{error}</Alert>

      {showAddForm && (
        <VehicleForm
          initial={EMPTY_FORM}
          meta={meta}
          submitLabel="Create Vehicle"
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading ? (
        <PageLoader />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-hover text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Price/day</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <Fragment key={v.id}>
                    <tr className="border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="px-4 py-3">
                        {v.image_url ? (
                          <img
                            className="size-11 rounded-lg object-cover"
                            src={vehicleImageUrl(v.image_url)}
                            alt=""
                          />
                        ) : (
                          <span className="flex size-11 items-center justify-center rounded-lg bg-surface-hover text-muted">
                            <ImageOff className="size-4" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-text">{v.name}</td>
                      <td className="px-4 py-3 text-muted">{v.type}</td>
                      <td className="px-4 py-3 text-muted">{v.category ? CATEGORY_LABELS[v.category] || v.category : "—"}</td>
                      <td className="px-4 py-3 text-muted">{v.location || "—"}</td>
                      <td className="px-4 py-3 text-text">{formatKES(v.price_per_day)}</td>
                      <td className="px-4 py-3">
                        <Badge status={v.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingId(editingId === v.id ? null : v.id)}
                          >
                            {editingId === v.id ? "Close" : "Edit"}
                          </Button>
                          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(v)} />
                        </div>
                      </td>
                    </tr>
                    {editingId === v.id && (
                      <tr>
                        <td colSpan={8} className="bg-surface-hover px-4 py-4">
                          <VehicleForm
                            initial={{ ...v, year: v.year || "" }}
                            meta={meta}
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
        </Card>
      )}
    </div>
  );
}
