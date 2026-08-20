import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { api } from "../api/client";
import PasswordInput from "../components/PasswordInput";
import AuthLayout from "../components/layout/AuthLayout";
import Field from "../components/ui/Field";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset password"
      footer={
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Back to login
        </Link>
      }
    >
      {!token && <Alert variant="error">This reset link is missing its token.</Alert>}
      <Alert variant="error">{error}</Alert>
      {done ? (
        <Alert variant="success" className="mb-0">
          Your password has been reset. <Link to="/login" className="font-medium underline">Log in</Link>{" "}
          with your new password.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="New password" required>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          </Field>
          <Field label="Confirm new password" required>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </Field>
          <Button type="submit" className="w-full" loading={submitting} disabled={!token} icon={KeyRound}>
            {submitting ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
