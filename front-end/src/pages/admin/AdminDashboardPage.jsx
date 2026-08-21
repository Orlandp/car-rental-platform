import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock,
  Hourglass,
  Wallet,
  Warehouse,
  XCircle,
} from "lucide-react";
import { api } from "../../api/client";
import { formatKES } from "../../utils/currency";
import Card from "../../components/ui/Card";
import PageLoader from "../../components/ui/PageLoader";
import Alert from "../../components/ui/Alert";
import { cn } from "../../utils/cn";

const TONES = {
  brand: "bg-brand-100 text-brand-700",
  success: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  danger: "bg-danger-bg text-danger-text",
  info: "bg-info-bg text-info-text",
  neutral: "bg-surface-hover text-muted",
};

function StatCard({ label, value, icon: Icon, tone = "neutral" }) {
  return (
    <Card className="flex items-center gap-4 p-5 animate-slide-up">
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
        <Icon className="size-5" />
      </div>
      <div>
        <span className="block text-3xl text-text">{value}</span>
        <span className="text-sm text-muted">{label}</span>
      </div>
    </Card>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-text">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/admin/stats").then(setStats).catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!stats) return <PageLoader label="Loading dashboard..." />;

  return (
    <div className="animate-fade-in">
      <h1 className="mb-6 text-3xl text-text">Dashboard</h1>

      <Section title="Fleet">
        <StatCard label="Total vehicles" value={stats.vehicles.total} icon={Warehouse} tone="brand" />
        <StatCard label="Available" value={stats.vehicles.available} icon={Car} tone="success" />
      </Section>

      <Section title="Bookings">
        <StatCard label="Total" value={stats.bookings.total} icon={BadgeCheck} tone="brand" />
        <StatCard label="Pending" value={stats.bookings.pending} icon={Hourglass} tone="warning" />
        <StatCard label="Confirmed" value={stats.bookings.confirmed} icon={CheckCircle2} tone="info" />
        <StatCard label="Completed" value={stats.bookings.completed} icon={BadgeCheck} tone="success" />
        <StatCard label="Cancelled" value={stats.bookings.cancelled} icon={XCircle} tone="danger" />
      </Section>

      <Section title="Payments">
        <StatCard label="Pending confirmation" value={stats.payments.pending} icon={Clock} tone="warning" />
        <StatCard
          label="Total revenue"
          value={formatKES(stats.payments.total_revenue)}
          icon={Wallet}
          tone="success"
        />
      </Section>
    </div>
  );
}
