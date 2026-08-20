import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import AuthLayout from "../components/layout/AuthLayout";
import Field, { Input } from "../components/ui/Field";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import PageLoader from "../components/ui/PageLoader";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedInUser = await login(username, password);
      navigate(loggedInUser.role === "admin" ? "/admin" : "/vehicles");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to manage your bookings"
      footer={
        <>
          No account?{" "}
          <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Register here
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Alert variant="error">{error}</Alert>
        <Field label="Username" required>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </Field>
        <Field label="Password" required>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full mt-2" loading={submitting} icon={LogIn}>
          {submitting ? "Logging in..." : "Login"}
        </Button>
        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="text-muted hover:text-text">
            Forgot password?
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
