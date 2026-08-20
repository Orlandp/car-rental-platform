import { useEffect, useState } from "react";
import { Save, Settings } from "lucide-react";
import { api } from "../../api/client";
import Card from "../../components/ui/Card";
import Field, { Input } from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import Alert from "../../components/ui/Alert";
import PageLoader from "../../components/ui/PageLoader";

const EMPTY_FORM = {
  name: "",
  kra_pin: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  vat_rate: 16,
  deposit_percentage: 30,
  driver_daily_rate: 2500,
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
        deposit_percentage: Number(form.deposit_percentage),
        driver_daily_rate: Number(form.driver_daily_rate),
      });
      setForm({ ...EMPTY_FORM, ...updated });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="animate-fade-in max-w-2xl">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-text">
        <Settings className="size-6 text-brand-600" /> Company Settings
      </h1>
      <p className="mb-6 text-sm text-muted">
        These details appear on every invoice PDF, including the KRA PIN and VAT rate used for tax
        calculations.
      </p>

      <Card className="p-6">
        <form onSubmit={handleSubmit}>
          <Alert variant="error">{error}</Alert>
          {saved && (
            <Alert variant="success" className="mb-4">
              Company settings saved.
            </Alert>
          )}

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="Company name" required>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </Field>
            <Field label="KRA PIN" required>
              <Input
                value={form.kra_pin}
                onChange={(e) => update("kra_pin", e.target.value)}
                placeholder="P0XXXXXXXXX"
                required
              />
            </Field>
            <Field label="Address / Location">
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </Field>
            <Field label="VAT rate (%)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.vat_rate}
                onChange={(e) => update("vat_rate", e.target.value)}
                required
              />
            </Field>
            <Field label="Deposit (%)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.deposit_percentage}
                onChange={(e) => update("deposit_percentage", e.target.value)}
                required
              />
            </Field>
            <Field label="Driver daily rate (KSh)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.driver_daily_rate}
                onChange={(e) => update("driver_daily_rate", e.target.value)}
                required
              />
            </Field>
          </div>

          <Button type="submit" loading={submitting} icon={Save} className="mt-2">
            {submitting ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
