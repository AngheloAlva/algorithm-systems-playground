import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Module display title */
  title: string;
  /** One-line description of what this module will do */
  description: string;
  /** Lucide icon representing this module */
  icon: LucideIcon;
  className?: string;
}

/**
 * EmptyState — shared "coming soon" component used by all module pages.
 * One component, one definition — no duplicated markup across pages.
 * Phase 1+: replace with module canvas when status becomes AVAILABLE.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center",
        className
      )}
    >
      {/* Icon container — subtle surface elevation */}
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
        <Icon className="size-8" aria-hidden="true" />
      </div>

      {/* Text content */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Status badge */}
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <span
          className="size-1.5 rounded-full bg-muted-foreground/50"
          aria-hidden="true"
        />
        Coming soon
      </div>
    </div>
  );
}
