import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

const AuthContext = createContext(null);

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const idleTimerRef = useRef(null);

  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const data = await api.post("/api/auth/login", { username, password });
    setUser(data);
    return data;
  }

  async function register(name, username, email, password, role) {
    const data = await api.post("/api/auth/register", {
      name,
      username,
      email,
      password,
      role,
    });
    setUser(data);
    return data;
  }

  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
  }

  // Auto-logout after 2 minutes of no mouse/keyboard/touch activity, for every role.
  useEffect(() => {
    if (!user) return;

    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(async () => {
        await logout();
        navigate("/login");
      }, IDLE_TIMEOUT_MS);
    }

    resetIdleTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetIdleTimer));

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetIdleTimer));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
