import { Check } from "lucide-react";
import { cn } from "../../utils/cn";

export default function Stepper({ steps, current }) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-6.5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isDone || isActive
                    ? "bg-brand-500 text-brand-ink"
                    : "border border-border bg-surface-hover text-muted"
                )}
              >
                {isDone ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("text-sm", isDone || isActive ? "font-semibold text-text" : "text-muted")}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("mx-3.5 h-px flex-1", isDone ? "bg-brand-500" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
