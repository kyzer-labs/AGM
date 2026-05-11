"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Lock,
  Plus,
  Trash2,
  Upload,
  Users2,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { ImportSummaryStrip } from "@/components/admin/import-summary-strip";
import { NoElection } from "@/components/admin/no-election";
import { useDialog } from "@/components/dialog/dialog-provider";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { Modal } from "@/components/ui/modal";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { formatMYT } from "@/lib/format";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const USM_DOMAIN = "@student.usm.my";

type VoterClass = "topCommittee" | "headExecutive" | "year2Committee";

const VOTER_CLASS_LABEL: Record<VoterClass, string> = {
  topCommittee: "Top Committee",
  headExecutive: "Head Executive",
  year2Committee: "Year 2 Committee",
};

const VOTER_CLASS_OPTIONS: VoterClass[] = [
  "topCommittee",
  "headExecutive",
  "year2Committee",
];

const VOTER_CLASS_TONE: Record<VoterClass, "brand" | "copper" | "muted"> = {
  topCommittee: "brand",
  headExecutive: "copper",
  year2Committee: "muted",
};

const PHASE_LABELS: Record<Doc<"elections">["phase"], string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

interface BulkRow {
  displayRow: string;
  email: string;
  voterClass?: string;
}

interface BulkIssue {
  displayRow: string;
  email: string;
  reason: string;
}

interface BulkSummary {
  inserted: number;
  skipped: number;
  reclassified: number;
  errors: BulkIssue[];
  warnings: BulkIssue[];
}

function isPlausibleUsmEmail(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length <= USM_DOMAIN.length) return false;
  if (!trimmed.endsWith(USM_DOMAIN)) return false;
  if (!/^[a-z0-9._-]+@student\.usm\.my$/i.test(trimmed)) return false;
  return true;
}

export default function WhitelistPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <PageSkeleton />;
  if (election === null) return <NoElection />;
  return <Body election={election} />;
}

function PageSkeleton() {
  return (
    <main className="container-wide space-y-6 py-12">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </main>
  );
}

function Body({ election }: { election: Doc<"elections"> }) {
  const list = useQuery(api.whitelist.list, { electionId: election._id });
  const bulkAdd = useMutation(api.whitelist.bulkAdd);

  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkDefaultClass, setBulkDefaultClass] =
    useState<VoterClass>("year2Committee");
  const [filterClass, setFilterClass] = useState<VoterClass | "all">("all");
  const [importing, setImporting] = useState(false);
  const [lastImport, setLastImport] = useState<
    | (BulkSummary & {
        attempted: number;
        sourceLabel: string;
      })
    | null
  >(null);

  const editable =
    election.phase === "setup" || election.phase === "internalOpen";

  const filteredList = useMemo(() => {
    if (!list) return [];
    if (filterClass === "all") return list;
    return list.filter((row) => row.voterClass === filterClass);
  }, [list, filterClass]);

  const countByClass = useMemo(() => {
    const counts: Record<VoterClass, number> = {
      topCommittee: 0,
      headExecutive: 0,
      year2Committee: 0,
    };
    if (!list) return counts;
    for (const row of list) counts[row.voterClass] += 1;
    return counts;
  }, [list]);

  const sendBulk = async (rows: BulkRow[], sourceLabel: string) => {
    setImporting(true);
    try {
      const summary = await bulkAdd({
        electionId: election._id,
        rows,
        defaultClass: bulkDefaultClass,
      });
      setLastImport({ ...summary, attempted: rows.length, sourceLabel });
      const issues = summary.errors.length + summary.warnings.length;
      if (issues === 0) {
        toast.success("Bulk import complete", {
          description: `${summary.inserted} added, ${summary.skipped} skipped, ${summary.reclassified} reclassified.`,
        });
      } else {
        toast.warning("Bulk import finished with issues", {
          description: `${summary.inserted} added, ${summary.errors.length} ${
            summary.errors.length === 1 ? "error" : "errors"
          }, ${summary.warnings.length} ${
            summary.warnings.length === 1 ? "warning" : "warnings"
          }. See details below.`,
        });
      }
      setShowBulk(false);
    } catch (err) {
      toast.error("Import failed", {
        description: getConvexErrorMessage(err, "Import failed."),
      });
    } finally {
      setImporting(false);
    }
  };

  if (list === undefined) {
    return <PageSkeleton />;
  }

  return (
    <main className="container-wide space-y-10 py-12">
      <AdminBreadcrumb items={[{ label: "Internal whitelist" }]} />

      <header className="space-y-5">
        <SectionMarker
          primary="Internal whitelist"
          secondary={election.name}
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
            Evaluator allowlist and class assignment
          </h1>
          {editable ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Add evaluator
              </Button>
              <Button variant="outline" onClick={() => setShowBulk(true)}>
                <Upload className="h-4 w-4" aria-hidden /> Bulk import
              </Button>
            </div>
          ) : null}
        </div>
        <MetaGroup className="grid-cols-2 sm:grid-cols-4">
          <Meta
            label="Cycle phase"
            value={PHASE_LABELS[election.phase]}
          />
          <Meta label="Top committee" value={countByClass.topCommittee} />
          <Meta label="Head executive" value={countByClass.headExecutive} />
          <Meta
            label="Year 2 committee"
            value={countByClass.year2Committee}
          />
        </MetaGroup>
      </header>

      {!editable ? (
        <NoticeStrip
          markerPrimary="Phase lock"
          markerSecondary={PHASE_LABELS[election.phase]}
          markerIcon={
            <Lock className="h-4 w-4 text-[var(--copper)]" aria-hidden />
          }
          headline="Whitelist is frozen for the rest of the cycle"
          tone="copper"
        >
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Adds, edits, and deletes are only allowed during{" "}
            <strong className="font-semibold">Setup</strong> or{" "}
            <strong className="font-semibold">Internal evaluation open</strong>
            . Changing the allowlist after the rubric window has closed
            would alter who is counted in the weighted breakdown. Move the
            cycle back to one of those phases from the{" "}
            <LinkButton
              href="/admin/election"
              variant="link"
              size="sm"
              className="h-auto p-0 text-sm"
            >
              Election cycle page
            </LinkButton>{" "}
            if a structural change is genuinely necessary.
          </p>
        </NoticeStrip>
      ) : null}

      {lastImport ? (
        <BulkImportSummary
          summary={lastImport}
          onDismiss={() => setLastImport(null)}
        />
      ) : null}

      <AddSingleModal
        open={editable && showAdd}
        electionId={election._id}
        onClose={() => setShowAdd(false)}
      />

      <BulkImportModal
        open={editable && showBulk}
        defaultClass={bulkDefaultClass}
        importing={importing}
        onChangeDefaultClass={setBulkDefaultClass}
        onClose={() => setShowBulk(false)}
        onSubmitPaste={(rows) => sendBulk(rows, "Pasted emails")}
        onSubmitCsv={(rows, fileName) => sendBulk(rows, fileName)}
      />

      <section aria-label="Whitelist roster">
        <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <SectionMarker
              primary="Roster"
              secondary={`${list.length} ${
                list.length === 1 ? "evaluator" : "evaluators"
              }`}
            />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
              {filterClass === "all"
                ? "All evaluator classes"
                : VOTER_CLASS_LABEL[filterClass]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <FilterChips
              current={filterClass}
              counts={countByClass}
              total={list.length}
              onChange={setFilterClass}
            />
          </div>
        </header>
        {filteredList.length === 0 ? (
          <EmptyState
            icon={<Users2 className="h-5 w-5" aria-hidden />}
            title={
              filterClass === "all"
                ? "No evaluators on the whitelist yet"
                : `No evaluators in ${VOTER_CLASS_LABEL[filterClass]}`
            }
            description={
              filterClass === "all"
                ? "Internal evaluation cannot start until the whitelist has at least one evaluator. Use Add evaluator or Bulk import to populate it."
                : "Add evaluators with this class, or change the filter above to All classes."
            }
          />
        ) : (
          <ul
            className="divide-y divide-[var(--ink-line)] rounded-md border border-[var(--ink-line)] bg-[var(--paper)]"
            aria-busy={importing ? "true" : undefined}
          >
            {filteredList.map((row) => (
              <WhitelistRow
                key={row._id}
                row={row}
                editable={editable}
              />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function FilterChips({
  current,
  counts,
  total,
  onChange,
}: {
  current: VoterClass | "all";
  counts: Record<VoterClass, number>;
  total: number;
  onChange: (cls: VoterClass | "all") => void;
}) {
  const chips: { value: VoterClass | "all"; label: string; count: number }[] =
    [
      { value: "all", label: "All classes", count: total },
      {
        value: "topCommittee",
        label: VOTER_CLASS_LABEL.topCommittee,
        count: counts.topCommittee,
      },
      {
        value: "headExecutive",
        label: VOTER_CLASS_LABEL.headExecutive,
        count: counts.headExecutive,
      },
      {
        value: "year2Committee",
        label: VOTER_CLASS_LABEL.year2Committee,
        count: counts.year2Committee,
      },
    ];
  return (
    <div
      role="radiogroup"
      aria-label="Filter whitelist by class"
      className="flex flex-wrap items-center gap-1.5"
    >
      {chips.map((c) => {
        const active = current === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
              active
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] hover:bg-[color-mix(in_oklab,var(--ink)_92%,var(--paper)_8%)]"
                : "border-[var(--ink-line)] text-[var(--ink-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--ink)]",
            )}
          >
            <span>{c.label}</span>
            <span className="tabular-nums">{c.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function WhitelistRow({
  row,
  editable,
}: {
  row: {
    _id: Id<"internalWhitelist">;
    email: string;
    voterClass: VoterClass;
    addedAt: number;
  };
  editable: boolean;
}) {
  const dialog = useDialog();
  const setClass = useMutation(api.whitelist.setClass);
  const removeEntry = useMutation(api.whitelist.remove);
  const impact = useQuery(api.whitelist.entryImpact, { entryId: row._id });

  const onChangeClass = async (next: VoterClass) => {
    if (next === row.voterClass) return;
    try {
      await setClass({ entryId: row._id, voterClass: next });
      toast.success("Class updated", {
        description: `Set ${row.email} to ${VOTER_CLASS_LABEL[next]}.`,
      });
    } catch (err) {
      toast.error("Update failed", {
        description: getConvexErrorMessage(err, "Update failed."),
      });
    }
  };

  const onRemove = async () => {
    if (impact === undefined) return;

    let description: React.ReactNode;
    if (
      impact === null ||
      !impact.hasSignedIn ||
      impact.evaluationCount === 0
    ) {
      description = (
        <>
          Remove <strong className="font-semibold">{row.email}</strong> from
          the whitelist. They have not submitted any evaluations yet, so no
          scores are affected. They will lose access to the internal
          evaluation window. The action cannot be undone.
        </>
      );
    } else {
      description = (
        <>
          Remove <strong className="font-semibold">{row.email}</strong> from
          the whitelist. This evaluator has{" "}
          <strong className="font-semibold tabular-nums">
            {impact.submittedCount}
          </strong>{" "}
          submitted{" "}
          {impact.submittedCount === 1 ? "evaluation" : "evaluations"}
          {impact.draftCount > 0 ? (
            <>
              {" "}and{" "}
              <strong className="font-semibold tabular-nums">
                {impact.draftCount}
              </strong>{" "}
              draft{" "}
              {impact.draftCount === 1 ? "evaluation" : "evaluations"}
            </>
          ) : null}
          {", covering "}
          <strong className="font-semibold tabular-nums">
            {impact.scoreCount}
          </strong>{" "}
          {impact.scoreCount === 1 ? "score" : "scores"} across the rubric
          {impact.lastSubmittedAt !== null ? (
            <>
              {", last submitted on "}
              <strong className="font-semibold">
                {formatMYT(impact.lastSubmittedAt)}
              </strong>
            </>
          ) : null}
          . Removing them does not delete those scores, but they will no
          longer be able to edit or resubmit. The action cannot be undone.
        </>
      );
    }

    const ok = await dialog.confirm({
      title: "Remove from whitelist?",
      description,
      confirmText: "Remove evaluator",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      await removeEntry({ entryId: row._id });
      toast.success("Evaluator removed");
    } catch (err) {
      toast.error("Remove failed", {
        description: getConvexErrorMessage(err, "Remove failed."),
      });
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[13px] tabular-nums text-[var(--ink)]">
          {row.email}
        </p>
        <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          Added {formatMYT(row.addedAt)}
        </p>
      </div>
      {impact && impact.hasSignedIn && impact.submittedCount > 0 ? (
        <Badge tone="brand" className="text-[10px]">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          <span className="font-mono tabular-nums">
            {impact.submittedCount}
          </span>{" "}
          submitted
        </Badge>
      ) : null}
      {editable ? (
        <Select
          aria-label={`Set class for ${row.email}`}
          value={row.voterClass}
          onChange={(e) => void onChangeClass(e.target.value as VoterClass)}
          className="h-8 w-44"
        >
          {VOTER_CLASS_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {VOTER_CLASS_LABEL[c]}
            </option>
          ))}
        </Select>
      ) : (
        <VoterClassBadge voterClass={row.voterClass} />
      )}
      {editable ? (
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          aria-label={`Remove ${row.email}`}
          disabled={impact === undefined}
        >
          <Trash2
            className="h-4 w-4 text-[var(--color-destructive)]"
            aria-hidden
          />
        </Button>
      ) : null}
    </li>
  );
}

function VoterClassBadge({ voterClass }: { voterClass: VoterClass }) {
  return (
    <Badge tone={VOTER_CLASS_TONE[voterClass]}>
      <Circle className="h-2.5 w-2.5 fill-current" aria-hidden />
      {VOTER_CLASS_LABEL[voterClass]}
    </Badge>
  );
}

function AddSingleModal({
  open,
  electionId,
  onClose,
}: {
  open: boolean;
  electionId: Id<"elections">;
  onClose: () => void;
}) {
  const add = useMutation(api.whitelist.add);

  const emailId = useId();
  const classId = useId();
  const emailErrId = useId();

  const [email, setEmail] = useState("");
  const [cls, setCls] = useState<VoterClass>("year2Committee");
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setCls("year2Committee");
      setEmailError(null);
    }
  }, [open]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      setEmailError("Enter an email address.");
      return;
    }
    if (!isPlausibleUsmEmail(trimmed)) {
      setEmailError(`Email must end in ${USM_DOMAIN}.`);
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    try {
      await add({
        electionId,
        email: trimmed,
        voterClass: cls,
      });
      toast.success("Evaluator added", {
        description: `${trimmed} (${VOTER_CLASS_LABEL[cls]}).`,
      });
      onClose();
    } catch (err) {
      toast.error("Add failed", {
        description: getConvexErrorMessage(err, "Add failed."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="Add evaluator"
      description={
        <>
          The email must end in <code>{USM_DOMAIN}</code>. The evaluator
          gains access the next time they sign in.
        </>
      }
      size="md"
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={emailId}>Student email</Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="off"
            placeholder={`someone${USM_DOMAIN}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            aria-required="true"
            aria-invalid={emailError ? "true" : undefined}
            aria-describedby={emailError ? emailErrId : undefined}
            autoFocus
          />
          {emailError ? (
            <p
              id={emailErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {emailError}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={classId}>Class</Label>
          <Select
            id={classId}
            value={cls}
            onChange={(e) => setCls(e.target.value as VoterClass)}
            aria-required="true"
          >
            {VOTER_CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {VOTER_CLASS_LABEL[c]}
              </option>
            ))}
          </Select>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            The cycle&apos;s configured weight for this class applies to
            every score this evaluator submits.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            <Plus className="h-4 w-4" aria-hidden /> Add evaluator
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BulkImportModal({
  open,
  defaultClass,
  importing,
  onChangeDefaultClass,
  onClose,
  onSubmitPaste,
  onSubmitCsv,
}: {
  open: boolean;
  defaultClass: VoterClass;
  importing: boolean;
  onChangeDefaultClass: (cls: VoterClass) => void;
  onClose: () => void;
  onSubmitPaste: (rows: BulkRow[]) => Promise<void> | void;
  onSubmitCsv: (rows: BulkRow[], fileName: string) => Promise<void> | void;
}) {
  const pasteId = useId();
  const defaultClassId = useId();
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [paste, setPaste] = useState("");

  useEffect(() => {
    if (!open) setPaste("");
  }, [open]);

  const onPasteSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const lines = paste.split(/\r?\n/);
    const rows: BulkRow[] = [];
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      if (!line || line.trim().length === 0) continue;
      const pieces = line
        .split(/[,;]\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (pieces.length === 0) continue;
      pieces.forEach((email, j) => {
        rows.push({
          displayRow:
            pieces.length === 1
              ? `Line ${lineNum}`
              : `Line ${lineNum}, item ${j + 1}`,
          email,
        });
      });
    }
    if (rows.length === 0) {
      toast.error("Nothing to import", {
        description: "Paste at least one email address.",
      });
      return;
    }
    void onSubmitPaste(rows);
  };

  const tryHeaderlessParse = (file: File): Promise<BulkRow[] | null> => {
    return new Promise((resolve) => {
      Papa.parse<string[]>(file, {
        complete: (r) => {
          const rows: BulkRow[] = [];
          for (let i = 0; i < r.data.length; i++) {
            const cells = r.data[i];
            if (!Array.isArray(cells)) continue;
            for (let j = 0; j < cells.length; j++) {
              const cell = cells[j];
              if (typeof cell !== "string") continue;
              const trimmed = cell.trim();
              if (trimmed.length === 0) continue;
              rows.push({
                displayRow:
                  cells.length > 1
                    ? `Row ${i + 1}, col ${j + 1}`
                    : `Row ${i + 1}`,
                email: trimmed,
              });
            }
          }
          resolve(rows.length > 0 ? rows : null);
        },
        error: () => resolve(null),
      });
    });
  };

  const onCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: async (result) => {
        const fatalParseErrors = result.errors.filter(
          (err) => err.code !== "TooFewFields",
        );
        if (fatalParseErrors.length > 0) {
          const first = fatalParseErrors[0];
          const rowLabel =
            typeof first?.row === "number"
              ? `Row ${first.row + 2}`
              : "CSV";
          toast.error("Could not parse CSV", {
            description: `${rowLabel}: ${first?.message ?? "Unknown parse error"}`,
          });
          return;
        }

        const detected = (result.meta.fields ?? []).map((c) => c.trim());
        const detectedLc = new Set(
          detected.map((c) => c.toLowerCase()),
        );
        const hasEmailColumn =
          detectedLc.has("email") ||
          detectedLc.has("e-mail") ||
          detectedLc.has("mail") ||
          detectedLc.has("student email");

        if (!hasEmailColumn) {
          const fallback = await tryHeaderlessParse(file);
          if (!fallback) {
            toast.error("CSV missing required column", {
              description: `Add an "email" column. Detected: ${
                detected.length > 0 ? detected.join(", ") : "(none)"
              }.`,
            });
            return;
          }
          await onSubmitCsv(fallback, file.name);
          return;
        }

        const rows: BulkRow[] = [];
        for (let i = 0; i < result.data.length; i++) {
          const row = result.data[i] ?? {};
          const email = (
            row.email ??
            row.Email ??
            row["E-mail"] ??
            row["e-mail"] ??
            row.mail ??
            row["Student Email"] ??
            ""
          ).trim();
          if (email.length === 0) continue;
          const cls = (
            row.voterClass ??
            row.VoterClass ??
            row.class ??
            row.Class ??
            row.role ??
            row.Role ??
            ""
          ).trim();
          rows.push({
            displayRow: `Row ${i + 2}`,
            email,
            voterClass: cls.length > 0 ? cls : undefined,
          });
        }
        if (rows.length === 0) {
          toast.error("No usable rows", {
            description:
              "Every row was missing an email value. Add the email to each row and re-upload.",
          });
          return;
        }
        await onSubmitCsv(rows, file.name);
      },
      error: (err) => {
        toast.error("CSV parse failed", { description: err.message });
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!importing) onClose();
      }}
      title="Bulk import evaluators"
      description={
        <>
          Paste comma, semicolon, or newline-separated emails, or upload a
          CSV with <code>email</code> and optional <code>voterClass</code>{" "}
          columns. Rows without a class fall back to the default below.
          Every email must end in <code>{USM_DOMAIN}</code>.
        </>
      }
    >
      <form onSubmit={onPasteSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={pasteId}>Emails</Label>
          <Textarea
            id={pasteId}
            rows={6}
            placeholder={`alice${USM_DOMAIN}\nbob${USM_DOMAIN}`}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            aria-describedby={`${pasteId}-hint`}
          />
          <p
            id={`${pasteId}-hint`}
            className="text-[11px] text-[var(--color-muted-foreground)]"
          >
            One email per line is easiest. Comma- or semicolon-separated
            lists work too. Per-row class overrides aren&apos;t supported
            in pasted input. Use CSV for that.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={defaultClassId}>Default class</Label>
          <Select
            id={defaultClassId}
            value={defaultClass}
            onChange={(e) =>
              onChangeDefaultClass(e.target.value as VoterClass)
            }
          >
            {VOTER_CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {VOTER_CLASS_LABEL[c]}
              </option>
            ))}
          </Select>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            Applied to any row without a recognized voterClass column. CSV
            rows with a recognized class override this.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            loading={importing}
            onClick={() => csvInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden /> Upload CSV
          </Button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={onCsvUpload}
            disabled={importing}
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={importing}
          >
            Close
          </Button>
          <Button
            type="submit"
            loading={importing}
            disabled={paste.trim() === ""}
          >
            Import pasted emails
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BulkImportSummary({
  summary,
  onDismiss,
}: {
  summary: BulkSummary & { attempted: number; sourceLabel: string };
  onDismiss: () => void;
}) {
  const totalIssues = summary.errors.length + summary.warnings.length;
  return (
    <ImportSummaryStrip
      markerPrimary="Last bulk import"
      markerSecondary={summary.sourceLabel}
      headline={`${summary.inserted} of ${summary.attempted} ${
        summary.attempted === 1 ? "row" : "rows"
      } imported`}
      stats={{
        added: summary.inserted,
        reclassified: summary.reclassified,
        skipped: summary.skipped,
        errors: summary.errors.length,
        warnings: summary.warnings.length,
      }}
      errors={summary.errors}
      warnings={summary.warnings}
      tone={totalIssues > 0 ? "copper" : "neutral"}
      onDismiss={onDismiss}
    />
  );
}
