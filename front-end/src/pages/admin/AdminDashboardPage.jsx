import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { formatKES } from "../../utils/currency";
import "../../styles/admin.css";

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/admin/stats").then(setStats).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!stats) return <p className="page-loading">Loading dashboard...</p>;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Dashboard</h1>
      </div>

      <h2>Fleet</h2>
      <div className="stat-grid">
        <StatCard label="Total vehicles" value={stats.vehicles.total} />
        <StatCard label="Available" value={stats.vehicles.available} />
      </div>

      <h2>Bookings</h2>
      <div className="stat-grid">
        <StatCard label="Total" value={stats.bookings.total} />
        <StatCard label="Pending" value={stats.bookings.pending} />
        <StatCard label="Confirmed" value={stats.bookings.confirmed} />
        <StatCard label="Completed" value={stats.bookings.completed} />
        <StatCard label="Cancelled" value={stats.bookings.cancelled} />
      </div>

      <h2>Payments</h2>
      <div className="stat-grid">
        <StatCard label="Pending confirmation" value={stats.payments.pending} />
        <StatCard label="Total revenue" value={formatKES(stats.payments.total_revenue)} />
      </div>
    </div>
  );
}
