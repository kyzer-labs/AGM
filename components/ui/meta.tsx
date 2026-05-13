import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MetaProps {
  /** Mono uppercase tracked label, e.g. "Window opens", "Class weight". */
  label: string;
  /**
   * Tabular-num value rendered under the label. Typed as ReactNode so
   * call sites can splice in formatted strings, percentage spans, or
   * other inline composition without losing tabular alignment.
   */
  value: ReactNode;
}

/**
 * One label-over-value metadata pair, semantically a `<dt>` + `<dd>`.
 * Always rendered inside a `<MetaGroup>` (or any other `<dl>`-based
 * container) so the surrounding semantics stay valid.
 */
export function Meta({ label, value }: MetaProps) {
  return (
    <div className="space-y-1.5">
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {label}
      </dt>
      <dd className="font-mono text-sm tabular-nums text-[var(--ink)]">
        {value}
      </dd>
    </div>
  );
}

export interface MetaGroupProps {
  /**
   * Tailwind override slot — pass `sm:grid-cols-2`, `mt-12`, `pt-8`, etc.
   * Tailwind-merge resolves the conflicts so consumers can selectively
   * override the defaults without spelling them all out again.
   */
  className?: string;
  children: ReactNode;
}

/**
 * `<dl>` wrapper for `<Meta>` pairs. Defaults to a single-column
 * top-bordered grid; consumers grow it to two or three columns and
 * adjust top padding via `className`.
 */
export function MetaGroup({ className, children }: MetaGroupProps) {
  return (
    <dl
      className={cn(
        "grid gap-6 border-t border-[var(--ink-line)] pt-6",
        className,
      )}
    >
      {children}
    </dl>
  );
}
