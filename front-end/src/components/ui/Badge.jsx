import { cn } from "../../utils/cn";

const TONES = {
  neutral: "bg-surface-hover text-muted",
  brand: "bg-brand-100 text-brand-700",
  success: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  danger: "bg-danger-bg text-danger-text",
  info: "bg-info-bg text-info-text",
};

const STATUS_TONES = {
  available: "success",
  booked: "warning",
  maintenance: "danger",
  pending: "warning",
  confirmed: "info",
  cancelled: "danger",
  completed: "success",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
};

export default function Badge({ tone, status, children, className }) {
  const resolvedTone = tone || STATUS_TONES[status] || "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        TONES[resolvedTone],
        className
      )}
    >
      {children ?? status}
    </span>
  );
}
