import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Car,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ui/ThemeToggle";
import Button from "./ui/Button";
import { cn } from "../utils/cn";

const CLIENT_LINKS = [
  { to: "/vehicles", label: "Vehicles" },
  { to: "/my-bookings", label: "My Bookings" },
];

const ADMIN_LINKS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/vehicles", label: "Fleet", icon: Warehouse },
  { to: "/admin/bookings", label: "Bookings", icon: Car },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await logout();
    setOpen(false);
    navigate("/login");
  }

  const links = user?.role === "admin" ? ADMIN_LINKS : user ? CLIENT_LINKS : [];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-text" onClick={() => setOpen(false)}>
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Car className="size-4.5" />
          </span>
          Car Rental
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          {user ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                <span className="flex size-6 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                  {user.name?.[0]?.toUpperCase()}
                </span>
                <span className="text-muted">
                  {user.name} <span className="capitalize">({user.role})</span>
                </span>
              </div>
              <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-muted hover:text-text">
                Login
              </Link>
              <Button size="sm" onClick={() => navigate("/register")}>
                Register
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden inline-flex size-9 items-center justify-center rounded-lg text-text cursor-pointer"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div
        className={cn(
          "md:hidden overflow-hidden border-t border-border bg-surface transition-[max-height] duration-300 ease-in-out",
          open ? "max-h-96" : "max-h-0 border-t-0"
        )}
      >
        <div className="flex flex-col gap-1 px-4 py-3">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-text hover:bg-surface-hover"
            >
              {link.label}
            </Link>
          ))}
          <div className="my-2 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm text-muted">Theme</span>
            <ThemeToggle />
          </div>
          {user ? (
            <Button variant="secondary" icon={LogOut} onClick={handleLogout} className="w-full justify-center">
              Logout ({user.name})
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={() => { setOpen(false); navigate("/login"); }}>
                Login
              </Button>
              <Button onClick={() => { setOpen(false); navigate("/register"); }}>Register</Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
