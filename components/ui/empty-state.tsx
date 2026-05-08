import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-secondary)] text-[var(--color-muted-foreground)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-medium">{title}</h3>
      {description ? (
        <p className="max-w-sm text-xs text-[var(--color-muted-foreground)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
