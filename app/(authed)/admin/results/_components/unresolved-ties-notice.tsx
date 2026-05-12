import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { NoticeStrip } from "@/components/ui/notice-strip";
import type { PreviewRow } from "./results-model";

export function UnresolvedTiesNotice({ rows }: { rows: PreviewRow[] }) {
  return (
    <NoticeStrip
      markerPrimary="Unresolved ties"
      markerSecondary="Blocking publish"
      markerIcon={
        <AlertTriangle
          className="h-4 w-4 text-[var(--copper)]"
          aria-hidden
        />
      }
      headline="Resolve every tie before publishing"
      role="alert"
    >
      <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        These positions need a manual decision before results can be
        published. Resolve each one on the{" "}
        <Link
          href="/admin/public"
          className="underline decoration-[var(--copper)] underline-offset-4 hover:text-[var(--ink)]"
        >
          Public voting
        </Link>{" "}
        page.
      </p>
      <ul className="font-mono text-sm tabular-nums text-[var(--ink)]">
        {rows.map((r) => (
          <li key={r.positionId} className="flex gap-3 py-1">
            <span className="text-[var(--ink-muted)]">·</span>
            <span>
              Tier {r.tier} · {r.positionName}
            </span>
          </li>
        ))}
      </ul>
    </NoticeStrip>
  );
}
