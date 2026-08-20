import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        Car Rental
      </Link>
      <div className="navbar-links">
        {(user?.role === "client" || user?.role === "company") && (
          <>
            <Link to="/vehicles">Vehicles</Link>
            <Link to="/my-bookings">My Bookings</Link>
          </>
        )}
        {user?.role === "admin" && (
          <>
            <Link to="/admin/vehicles">Manage Vehicles</Link>
            <Link to="/admin/bookings">Manage Bookings</Link>
            <Link to="/admin/users">Manage Users</Link>
            <Link to="/admin/settings">Company Settings</Link>
          </>
        )}
        {user ? (
          <>
            <span className="navbar-user">
              {user.name} (@{user.username}, {user.role})
            </span>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
