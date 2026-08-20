import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import PasswordInput from "../components/PasswordInput";
import "../styles/auth.css";

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
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Reset password</h1>
        {!token && <p className="form-error">This reset link is missing its token.</p>}
        {error && <p className="form-error">{error}</p>}
        {done ? (
          <p className="form-success">
            Your password has been reset. <Link to="/login">Log in</Link> with your new password.
          </p>
        ) : (
          <>
            <label>
              New password
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label>
              Confirm new password
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <button type="submit" disabled={submitting || !token}>
              {submitting ? "Resetting..." : "Reset password"}
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
