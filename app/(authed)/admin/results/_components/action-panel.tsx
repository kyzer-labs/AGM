import type { ReactNode } from "react";

import { NoticeStrip } from "@/components/ui/notice-strip";

export function ActionPanel({
  markerPrimary,
  markerSecondary,
  title,
  body,
  children,
}: {
  markerPrimary: string;
  markerSecondary?: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <NoticeStrip
      markerPrimary={markerPrimary}
      markerSecondary={markerSecondary}
      headline={title}
    >
      <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        {body}
      </p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </NoticeStrip>
  );
}
