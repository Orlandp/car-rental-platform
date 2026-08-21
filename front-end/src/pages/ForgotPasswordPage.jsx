import { useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { api } from "../api/client";
import AuthLayout from "../components/layout/AuthLayout";
import Field, { Input } from "../components/ui/Field";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/api/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll help you get back in"
      footer={
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Back to login
        </Link>
      }
    >
      <Alert variant="error">{error}</Alert>
      {submitted ? (
        <Alert variant="success" className="mb-0">
          If an account exists for that email, a password reset link has been generated. Ask an
          administrator to retrieve it from the server logs for now, since email delivery isn't
          configured yet.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          <Button type="submit" className="w-full" loading={submitting} icon={Send}>
            {submitting ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
