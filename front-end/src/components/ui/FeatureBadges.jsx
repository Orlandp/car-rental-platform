import { featureIcon } from "../../utils/vehicleFeatures";
import { cn } from "../../utils/cn";

export default function FeatureBadges({ features, labels, max, className }) {
  if (!features || features.length === 0) return null;

  const shown = max ? features.slice(0, max) : features;
  const hidden = max ? features.length - shown.length : 0;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {shown.map((key) => {
        const Icon = featureIcon(key);
        const label = labels?.[key] || key;
        return (
          <span
            key={key}
            title={label}
            className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-1 text-xs font-medium text-brand-700"
          >
            <Icon className="size-3.5" />
            {label}
          </span>
        );
      })}
      {hidden > 0 && (
        <span className="inline-flex items-center rounded-full bg-surface-hover px-2 py-1 text-xs font-medium text-muted">
          +{hidden} more
        </span>
      )}
    </div>
  );
}
