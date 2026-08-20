import { useEffect, useState } from "react";
import { Clock, ShieldCheck, ShieldX, Upload } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Field, { Input } from "../components/ui/Field";
import Alert from "../components/ui/Alert";
import PageLoader from "../components/ui/PageLoader";

const STATUS_COPY = {
  unverified: {
    tone: "neutral",
    title: "Verify your identity",
    message: "Upload your driver's license and national ID to unlock booking.",
  },
  pending_review: {
    tone: "warning",
    title: "Under review",
    message: "An admin is reviewing your documents. This usually takes less than a day.",
  },
  verified: {
    tone: "success",
    title: "You're verified",
    message: "Your identity has been confirmed - you're all set to book.",
  },
  rejected: {
    tone: "danger",
    title: "Verification rejected",
    message: "Your submission was rejected. Review the note below and resubmit.",
  },
};

// Mirrors the backend checks in app/utils/kenya.py - digits-only, length matching a
// real Kenyan national ID (6-8 digits) / NTSA driving licence (5-8 digits). This is a
// format check, not a live registry lookup.
const ID_NUMBER_RE = /^\d{6,8}$/;
const DL_NUMBER_RE = /^\d{5,8}$/;

function FileField({ label, file, onChange }) {
  return (
    <Field label={label} required>
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm text-muted hover:bg-surface-hover">
        <Upload className="size-4 shrink-0" />
        <span className="truncate">{file ? file.name : "Choose an image"}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => onChange(e.target.files[0] || null)}
        />
      </label>
    </Field>
  );
}

export default function VerificationPage() {
  const { refreshUser } = useAuth();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [dlNumber, setDlNumber] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dlImage, setDlImage] = useState(null);
  const [idImage, setIdImage] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    api
      .get("/api/users/me/verification")
      .then(setRecord)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!DL_NUMBER_RE.test(dlNumber.trim())) {
      setError("driver's license number must be 5-8 digits");
      return;
    }
    if (!ID_NUMBER_RE.test(idNumber.trim())) {
      setError("national ID number must be 6-8 digits");
      return;
    }
    if (!dlImage || !idImage) {
      setError("both a driver's license photo and a national ID photo are required");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("driver_license_number", dlNumber);
      formData.append("national_id_number", idNumber);
      formData.append("driver_license_image", dlImage);
      formData.append("national_id_image", idImage);
      const data = await api.postForm("/api/users/me/verification", formData);
      setRecord(data);
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoader />;
  if (loadError) return <Alert variant="error">{loadError}</Alert>;

  const status = record?.status || "unverified";
  const copy = STATUS_COPY[status];
  const showForm = status === "unverified" || status === "rejected";

  return (
    <div className="mx-auto max-w-lg animate-fade-in">
      <h1 className="mb-1 flex items-center gap-2 text-3xl text-text">
        <ShieldCheck className="size-6 text-brand-600" /> Identity Verification
      </h1>
      <p className="mb-6 text-sm text-muted">
        Required once before your first booking. Reviewed manually by our team - not an
        automated check.
      </p>

      <Card className="mb-6 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5">
            {status === "pending_review" ? (
              <Clock className="size-5 text-warning-text" />
            ) : status === "rejected" ? (
              <ShieldX className="size-5 text-danger-text" />
            ) : (
              <ShieldCheck className="size-5 text-success-text" />
            )}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-text">{copy.title}</h2>
              <Badge tone={copy.tone}>{status.replace("_", " ")}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{copy.message}</p>
            {status === "rejected" && record?.notes && (
              <p className="mt-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-text">
                {record.notes}
              </p>
            )}
          </div>
        </div>
      </Card>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit}>
            <Alert variant="error">{error}</Alert>
            <Field label="Driver's license number" required hint="5-8 digits, e.g. 1234567">
              <Input
                value={dlNumber}
                onChange={(e) => setDlNumber(e.target.value)}
                inputMode="numeric"
                pattern="\d{5,8}"
                maxLength={8}
                placeholder="1234567"
                required
              />
            </Field>
            <FileField label="Driver's license photo" file={dlImage} onChange={setDlImage} />
            <Field label="National ID number" required hint="6-8 digits, e.g. 12345678">
              <Input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                inputMode="numeric"
                pattern="\d{6,8}"
                maxLength={8}
                placeholder="12345678"
                required
              />
            </Field>
            <FileField label="National ID photo" file={idImage} onChange={setIdImage} />
            <Button type="submit" loading={submitting} className="w-full justify-center">
              {submitting ? "Submitting..." : "Submit for review"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
