import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import AuthLayout from "../components/layout/AuthLayout";
import Field, { Input, Select } from "../components/ui/Field";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import PageLoader from "../components/ui/PageLoader";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("client");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await register(name, username, email, phone, password, role);
      navigate("/vehicles");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Book vehicles across Kenya in minutes"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Login
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Alert variant="error">{error}</Alert>
        <Field label={role === "company" ? "Company name" : "Name"} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Username" required>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Phone number" required hint="Kenyan mobile number">
          <Input
            type="tel"
            placeholder="07XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" required>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        </Field>
        <Field label="Confirm password" required>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
          />
        </Field>
        <Field label="Account type">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="client">Individual client</option>
            <option value="company">Company</option>
          </Select>
        </Field>
        <Button type="submit" className="w-full mt-2" loading={submitting} icon={UserPlus}>
          {submitting ? "Creating..." : "Register"}
        </Button>
      </form>
    </AuthLayout>
  );
}
