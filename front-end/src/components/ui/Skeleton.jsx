import { cn } from "../../utils/cn";

export default function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-hover", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <Skeleton className="h-36 w-full mb-4" />
      <Skeleton className="h-5 w-2/3 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-4" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
