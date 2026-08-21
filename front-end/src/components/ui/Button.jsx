import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

const VARIANTS = {
  primary:
    "bg-brand-500 text-brand-ink shadow-md shadow-brand-500/25 hover:bg-brand-400 hover:-translate-y-px focus-visible:outline-brand-500 disabled:bg-muted/40 disabled:text-muted disabled:shadow-none disabled:translate-y-0",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-hover focus-visible:outline-brand-500 disabled:text-muted disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-text hover:bg-surface-hover focus-visible:outline-brand-500 disabled:text-muted",
  danger:
    "bg-danger-text text-white hover:brightness-110 focus-visible:outline-danger-text disabled:bg-muted/40 disabled:text-muted",
  link: "bg-transparent text-brand-600 hover:text-brand-700 underline-offset-4 hover:underline p-0! h-auto! shadow-none",
};

const SIZES = {
  sm: "h-8 px-3.5 text-sm gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-7 text-base gap-2",
};

export function buttonClasses({ variant = "primary", size = "md", className = "" } = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-150 cursor-pointer",
    "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    className
  );
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        Icon && <Icon className="size-4" />
      )}
      {children}
    </button>
  );
}
