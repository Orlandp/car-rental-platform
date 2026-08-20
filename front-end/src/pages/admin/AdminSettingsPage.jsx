import { useEffect, useState } from "react";
import { api } from "../../api/client";
import "../../styles/admin.css";

const EMPTY_FORM = {
  name: "",
  kra_pin: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  vat_rate: 16,
};

export default function AdminSettingsPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/api/company-settings")
      .then((data) => setForm({ ...EMPTY_FORM, ...data }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function update(field, value) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const updated = await api.put("/api/company-settings", {
        ...form,
        vat_rate: Number(form.vat_rate),
      });
      setForm({ ...EMPTY_FORM, ...updated });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="page-loading">Loading...</p>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Company Settings</h1>
      </div>
      <p className="form-hint">
        These details appear on every invoice PDF, including the KRA PIN and VAT rate used for
        tax calculations.
      </p>

      <form className="vehicle-form" onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}
        {saved && <p className="form-success">Company settings saved.</p>}
        <label>
          Company name
          <input value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </label>
        <label>
          KRA PIN
          <input
            value={form.kra_pin}
            onChange={(e) => update("kra_pin", e.target.value)}
            placeholder="P0XXXXXXXXX"
            required
          />
        </label>
        <label>
          Address / Location
          <input value={form.address} onChange={(e) => update("address", e.target.value)} />
        </label>
        <label>
          City
          <input value={form.city} onChange={(e) => update("city", e.target.value)} />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </label>
        <label>
          VAT rate (%)
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.vat_rate}
            onChange={(e) => update("vat_rate", e.target.value)}
            required
          />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
