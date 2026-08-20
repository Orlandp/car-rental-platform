import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ role, roles, children }) {
  const { user, loading } = useAuth();
  const allowedRoles = roles || (role ? [role] : null);

  if (loading) return <p className="page-loading">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
