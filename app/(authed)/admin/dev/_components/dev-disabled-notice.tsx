import { AlertTriangle } from "lucide-react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { NoticeStrip } from "@/components/ui/notice-strip";

export function DevDisabledNotice() {
  return (
    <main className="container-wide space-y-6 py-6">
      <AdminBreadcrumb items={[{ label: "Dev seeder" }]} />
      <NoticeStrip
        markerPrimary="Dev seeder"
        markerSecondary="Disabled"
        markerIcon={
          <AlertTriangle
            className="h-4 w-4 text-[var(--copper)]"
            aria-hidden
          />
        }
        headline="DEV_SEED_ALLOWED is not set on this deployment"
        tone="copper"
      >
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Set <code>DEV_SEED_ALLOWED=&quot;true&quot;</code> on the
          Convex deployment env to enable synthetic voters,
          evaluations, and votes for end-to-end testing. This env var
          must <strong className="font-semibold">never</strong> be set
          on the production deployment; the seeder is gated server-side
          so even an authenticated admin cannot insert seed rows when
          the flag is absent.
        </p>
      </NoticeStrip>
    </main>
  );
}
