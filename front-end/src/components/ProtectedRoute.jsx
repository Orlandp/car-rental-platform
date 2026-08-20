import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PageLoader from "./ui/PageLoader";

export default function ProtectedRoute({ role, roles, children }) {
  const { user, loading } = useAuth();
  const allowedRoles = roles || (role ? [role] : null);

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
