import { useEffect, useState } from "react";
import { CreditCard, IdCard, ShieldCheck, ShieldX } from "lucide-react";
import { api, fileUrl } from "../../api/client";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Select, Textarea } from "../../components/ui/Field";
import Alert from "../../components/ui/Alert";
import PageLoader from "../../components/ui/PageLoader";

const FILTERS = [
  { value: "pending_review", label: "Pending review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All submitted" },
];

function ReviewRow({ submission, onDecided }) {
  const [notes, setNotes] = useState(submission.notes || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function decide(status) {
    setError("");
    setSubmitting(true);
    try {
      await api.patch(`/api/users/${submission.user_id}/verification`, { status, notes });
      onDecided();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text">{submission.name}</span>
            <Badge status={submission.status}>{submission.status.replace("_", " ")}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            @{submission.username} &middot; {submission.email} &middot; {submission.phone}
          </p>
          <p className="mt-1 text-xs text-muted">
            Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "-"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs font-medium text-muted">Driver's license</div>
          <div className="mt-0.5 font-mono text-text">{submission.driver_license_number || "-"}</div>
          {submission.has_driver_license_image && (
            <a
              href={fileUrl(`/api/users/${submission.user_id}/verification/driver-license-image`)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              <CreditCard className="size-3.5" /> View photo
            </a>
          )}
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs font-medium text-muted">National ID</div>
          <div className="mt-0.5 font-mono text-text">{submission.national_id_number || "-"}</div>
          {submission.has_national_id_image && (
            <a
              href={fileUrl(`/api/users/${submission.user_id}/verification/national-id-image`)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              <IdCard className="size-3.5" /> View photo
            </a>
          )}
        </div>
      </div>

      <Alert variant="error" className="mt-4 mb-0">{error}</Alert>

      <Textarea
        className="mt-4"
        placeholder="Notes (shown to the customer if rejected)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <Button icon={ShieldCheck} loading={submitting} onClick={() => decide("verified")}>
          Approve
        </Button>
        <Button icon={ShieldX} variant="secondary" loading={submitting} onClick={() => decide("rejected")}>
          Reject
        </Button>
      </div>
    </Card>
  );
}

export default function AdminVerificationsPage() {
  const [status, setStatus] = useState("pending_review");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    const qs = status ? `?status=${status}` : "";
    api
      .get(`/api/admin/verifications${qs}`)
      .then(setSubmissions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl text-text">Identity Verifications</h1>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="w-52">
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      <Alert variant="error">{error}</Alert>

      {loading ? (
        <PageLoader />
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center text-muted">
          <ShieldCheck className="size-8" />
          <p>Nothing here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => (
            <ReviewRow key={s.user_id} submission={s} onDecided={load} />
          ))}
        </div>
      )}
    </div>
  );
}
