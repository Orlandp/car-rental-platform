import { cn } from "../../utils/cn";

export default function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface shadow-sm shadow-black/[0.03]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
