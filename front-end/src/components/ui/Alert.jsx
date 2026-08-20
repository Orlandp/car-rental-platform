import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../utils/cn";

const VARIANTS = {
  error: { classes: "bg-danger-bg text-danger-text", Icon: AlertCircle },
  success: { classes: "bg-success-bg text-success-text", Icon: CheckCircle2 },
  info: { classes: "bg-info-bg text-info-text", Icon: Info },
};

export default function Alert({ variant = "error", children, className }) {
  if (!children) return null;
  const { classes, Icon } = VARIANTS[variant];
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm mb-4 animate-slide-up",
        classes,
        className
      )}
    >
      <Icon className="size-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
