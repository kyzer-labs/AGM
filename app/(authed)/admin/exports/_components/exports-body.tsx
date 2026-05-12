"use client";

import { useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { toast } from "sonner";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import { downloadCsv } from "@/lib/csv";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc } from "@/convex/_generated/dataModel";
import { EmergencyAuditPanel } from "./emergency-audit-panel";
import { ExportItem } from "./export-item";
import {
  buildFilename,
  EXPORT_SPECS,
  PHASE_LABELS,
  runExportQuery,
  safeCycleSlug,
  type ExportKind,
  type ExportSpec,
} from "./exports-model";

export function ExportsBody({ election }: { election: Doc<"elections"> }) {
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const convex = useConvex();

  const [busy, setBusy] = useState<ExportKind | null>(null);

  const isSuper = adminStatus?.role === "super";
  const slug = safeCycleSlug(election.name) || "agm";

  const onExport = async (spec: ExportSpec) => {
    setBusy(spec.kind);
    const now = Date.now();
    try {
      const rows = await runExportQuery(convex, spec.kind, election._id);
      const filename = buildFilename(spec.filenameStem, slug, now);
      if (rows.length === 0) {
        toast.warning("No rows to export", {
          description: `${spec.title} is empty for ${election.name}. The CSV file would be blank, so the download was skipped.`,
        });
        return;
      }
      downloadCsv(rows, filename);
      toast.success(`${spec.title} downloaded`, {
        description: `${rows.length} ${rows.length === 1 ? "row" : "rows"} written to ${filename}.`,
      });
    } catch (err) {
      toast.error(`${spec.title} export failed`, {
        description: getConvexErrorMessage(err, "Export failed."),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="container-wide space-y-12 py-12">
      <AdminBreadcrumb items={[{ label: "Exports" }]} />

      <header className="space-y-5">
        <SectionMarker
          primary="Exports"
          secondary={election.name}
        />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          CSV downloads and emergency audit lookup
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Every download is named with the cycle slug and an MYT timestamp
          so two operators on different laptops produce filenames that
          sort the same way. Use these for council minutes, post-mortems,
          and the public results archive. The emergency voter audit at
          the bottom of this page is the only privileged read; treat it
          like the publish step on results.
        </p>
        <MetaGroup className="grid-cols-2 sm:grid-cols-3">
          <Meta label="Cycle" value={election.name} />
          <Meta label="Phase" value={PHASE_LABELS[election.phase]} />
          <Meta label="Available exports" value={EXPORT_SPECS.length} />
        </MetaGroup>
      </header>

      <section
        aria-label="Standard CSV exports"
        className="space-y-4"
      >
        <header>
          <SectionMarker
            primary="Standard exports"
            secondary="One CSV per artefact"
          />
        </header>
        <ol className="space-y-0" aria-label="Standard CSV exports">
          {EXPORT_SPECS.map((spec, index) => (
            <li key={spec.kind}>
              <ExportItem
                spec={spec}
                index={index}
                loading={busy === spec.kind}
                onClick={() => void onExport(spec)}
              />
            </li>
          ))}
        </ol>
      </section>

      {isSuper ? (
        <EmergencyAuditPanel
          electionSlug={slug}
        />
      ) : null}
    </main>
  );
}
