import { Loader2 } from "lucide-react";

export default function PageLoader({ label = "Loading..." }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted">
      <Loader2 className="size-6 animate-spin text-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
