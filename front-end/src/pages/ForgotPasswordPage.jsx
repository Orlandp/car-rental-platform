import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import "../styles/auth.css";

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
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Forgot password</h1>
        {error && <p className="form-error">{error}</p>}
        {submitted ? (
          <p className="form-success">
            If an account exists for that email, a password reset link has been generated. Ask an
            administrator to retrieve it from the server logs for now, since email delivery isn't
            configured yet.
          </p>
        ) : (
          <>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </>
        )}
        <p>
          <Link to="/login">Back to login</Link>
        </p>
      </form>
    </div>
  );
}
