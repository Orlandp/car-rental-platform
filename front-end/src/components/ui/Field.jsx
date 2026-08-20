import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

const controlClasses =
  "w-full rounded-lg border border-border bg-surface px-3 h-10 text-sm text-text placeholder:text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60 disabled:cursor-not-allowed";

export function inputClasses(className = "") {
  return cn(controlClasses, className);
}

export default function Field({ label, hint, error, children, className, required }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm mb-4", className)}>
      {label && (
        <span className="font-medium text-text">
          {label}
          {required && <span className="text-danger-text"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && <span className="text-xs text-danger-text">{error}</span>}
    </label>
  );
}

export function Input({ className, ...props }) {
  return <input className={inputClasses(className)} {...props} />;
}

export function Select({ className, children, wrapperClassName, ...props }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        className={inputClasses(cn("appearance-none pr-9 cursor-pointer", className))}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
    </div>
  );
}

export function Textarea({ className, ...props }) {
  return <textarea className={inputClasses(cn("h-auto py-2 min-h-24 resize-y", className))} {...props} />;
}
