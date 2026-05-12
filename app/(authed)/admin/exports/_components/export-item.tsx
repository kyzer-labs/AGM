import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/ui/section-marker";
import { TECHNIQUE_TONE, type ExportSpec } from "./exports-model";

export function ExportItem({
  spec,
  index,
  loading,
  onClick,
}: {
  spec: ExportSpec;
  index: number;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <article className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-[var(--ink-line)] py-6">
      <span
        className="font-mono text-xl font-medium tabular-nums text-[var(--ink-muted)]"
        aria-hidden
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SectionMarker primary={spec.technique} />
          <span aria-hidden className="text-[var(--ink-muted)]">
            {spec.icon}
          </span>
          <h2 className="font-display text-lg font-medium tracking-[-0.01em] text-[var(--ink)] sm:text-xl">
            {spec.title}
          </h2>
          <Badge tone={TECHNIQUE_TONE[spec.technique]}>{spec.technique}</Badge>
        </div>
        <p className="max-w-[68ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {spec.body}
        </p>
      </div>
      <div>
        <Button onClick={onClick} loading={loading} variant="outline" size="sm">
          <Download className="h-4 w-4" aria-hidden /> Download CSV
        </Button>
      </div>
    </article>
  );
}
