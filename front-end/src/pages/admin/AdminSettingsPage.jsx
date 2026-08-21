import { useEffect, useState } from "react";
import { Image as ImageIcon, Save, Settings, Upload } from "lucide-react";
import { api, fileUrl } from "../../api/client";
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
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");

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

  async function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoError("");
    setLogoUploading(true);
    try {
      const updated = await api.uploadFile("/api/company-settings/logo", file, "logo");
      setForm((prev) => ({ ...prev, logo_url: updated.logo_url }));
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="animate-fade-in max-w-2xl">
      <h1 className="mb-1 flex items-center gap-2 text-3xl text-text">
        <Settings className="size-6 text-brand-600" /> Company Settings
      </h1>
      <p className="mb-6 text-sm text-muted">
        These details appear on every invoice PDF, including the KRA PIN and VAT rate used for tax
        calculations.
      </p>

      <Card className="mb-6 p-6">
        <h2 className="mb-1 font-semibold text-text">Company logo</h2>
        <p className="mb-4 text-sm text-muted">
          Printed in the logo box on every invoice and receipt PDF. Without one, documents show a
          placeholder with your company's initials instead.
        </p>
        <Alert variant="error">{logoError}</Alert>
        <div className="flex items-center gap-4">
          {form.logo_url ? (
            <img
              src={fileUrl(form.logo_url)}
              alt="Company logo"
              className="size-16 rounded-lg border border-border object-contain bg-white p-1"
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-muted">
              <ImageIcon className="size-6" />
            </span>
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted hover:bg-surface-hover">
            <Upload className="size-4" />
            {logoUploading ? "Uploading..." : form.logo_url ? "Replace logo" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={logoUploading}
              onChange={handleLogoChange}
            />
          </label>
        </div>
      </Card>

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
