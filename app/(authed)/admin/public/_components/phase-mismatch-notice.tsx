import Link from "next/link";

import { NoticeStrip } from "@/components/ui/notice-strip";

export function PhaseMismatchNotice() {
  return (
    <NoticeStrip
      markerPrimary="Phase mismatch"
      markerSecondary="Action required"
      headline="Move the cycle to public voting first"
    >
      <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        Sessions can only be opened during the{" "}
        <strong className="font-semibold text-[var(--ink)]">
          Public AGM voting
        </strong>{" "}
        phase. Transition the cycle from the{" "}
        <Link
          href="/admin/election"
          className="underline decoration-[var(--copper)] underline-offset-4 hover:text-[var(--ink)]"
        >
          Election cycle
        </Link>{" "}
        page.
      </p>
    </NoticeStrip>
  );
}
