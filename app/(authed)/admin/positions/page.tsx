"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
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

import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc } from "@/convex/_generated/dataModel";

const TIER_LABELS: Record<number, string> = {
  1: "President",
  2: "Vice Presidents",
  3: "Directors",
  4: "Other",
};

const PHASE_LABELS: Record<Doc<"elections">["phase"], string> = {
  setup: "Setup",
  internalOpen: "Internal evaluation open",
  internalClosed: "Internal evaluation closed",
  publicVoting: "Public AGM voting",
  resultsPreview: "Results preview",
  published: "Published",
};

const POSITION_PAGE_SIZE = 6;

const DEFAULT_TIER_FOR_NAME = (name: string): number => {
  const n = name.toLowerCase();
  if (n.includes("president") && !n.includes("vice")) return 1;
  if (n.includes("vice president") || n.startsWith("vp")) return 2;
  if (n.includes("director")) return 3;
  return 4;
};

const DEFAULT_POSITIONS = [
  "President",
  "Vice President of Internal Affairs",
  "Vice President of External Affairs",
  "Director of Secretarial Department",
  "Director of Financial Department",
  "Director of Creative Department",
  "Director of Growth Marketing Department",
  "Director of Community Engagement Department",
  "Director of Technical Department",
];

const positionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(80, "At most 80 characters"),
  tier: z.coerce
    .number({ invalid_type_error: "Tier must be a number" })
    .int("Tier must be a whole number")
    .min(1, "Tier 1 or higher")
    .max(9, "Tier 9 or lower"),
});
type PositionFormValues = z.infer<typeof positionSchema>;

export default function PositionsPage() {
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
  return <PositionsBody election={election} />;
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

function PositionsBody({ election }: { election: Doc<"elections"> }) {
  const dialog = useDialog();
  const positions = useQuery(api.positions.list, {
    electionId: election._id,
  });
  const add = useMutation(api.positions.add);
  const move = useMutation(api.positions.move);
  const remove = useMutation(api.positions.remove);
  const updateName = useMutation(api.positions.updateName);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Doc<"positions"> | null>(null);
  const [positionPage, setPositionPage] = useState(0);

  const lockedToSetup = election.phase !== "setup";

  const onSeedDefaults = async () => {
    const ok = await dialog.confirm({
      title: "Seed default positions?",
      description: (
        <>
          Adds the 9 default positions (President, 2 Vice Presidents, 6
          Directors). If a name already exists, a duplicate will be
          created. Only run this on a fresh cycle.
        </>
      ),
      confirmText: "Seed defaults",
    });
    if (!ok) return;
    try {
      for (const name of DEFAULT_POSITIONS) {
        await add({
          electionId: election._id,
          name,
          tier: DEFAULT_TIER_FOR_NAME(name),
        });
      }
      toast.success("Default positions added");
    } catch (err) {
      toast.error("Seed failed", {
        description: getConvexErrorMessage(err, "Seed failed."),
      });
    }
  };

  const orderedPositions = useMemo(
    () =>
      (positions ?? [])
        .slice()
        .sort(
          (a, b) =>
            a.tier - b.tier ||
            a.order - b.order ||
            a.name.localeCompare(b.name),
        ),
    [positions],
  );
  const grouped = useMemo(
    () =>
      orderedPositions.reduce<Record<number, typeof orderedPositions>>(
        (acc, p) => {
          const tier = p.tier;
          const arr = acc[tier] ?? [];
          arr.push(p);
          acc[tier] = arr;
          return acc;
        },
        {},
      ),
    [orderedPositions],
  );
  const tierKeys = Object.keys(grouped)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  const totalPositions = orderedPositions.length;
  const positionPageCount = Math.max(
    1,
    Math.ceil(totalPositions / POSITION_PAGE_SIZE),
  );
  const safePositionPage = Math.min(positionPage, positionPageCount - 1);
  const positionStart = safePositionPage * POSITION_PAGE_SIZE;
  const positionEnd = Math.min(
    positionStart + POSITION_PAGE_SIZE,
    totalPositions,
  );
  const visiblePositions = orderedPositions.slice(positionStart, positionEnd);

  useEffect(() => {
    if (positionPage > positionPageCount - 1) {
      setPositionPage(Math.max(0, positionPageCount - 1));
    }
  }, [positionPage, positionPageCount]);

  if (positions === undefined) {
    return <PageSkeleton />;
  }

  return (
    <main className="container-wide space-y-10 py-12">
      <AdminBreadcrumb items={[{ label: "Positions" }]} />

      <header className="space-y-5">
        <SectionMarker primary="Positions" secondary={election.name} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
            Hierarchy and ballot order
          </h1>
          {!lockedToSetup ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Add position
              </Button>
              {positions.length === 0 ? (
                <Button variant="outline" onClick={onSeedDefaults}>
                  <Plus className="h-4 w-4" aria-hidden /> Seed 9 defaults
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <MetaGroup className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          <Meta label="Cycle phase" value={PHASE_LABELS[election.phase]} />
          <Meta label="Tiers" value={tierKeys.length} />
          <Meta label="Positions" value={totalPositions} />
          <Meta
            label="Edits"
            value={lockedToSetup ? "Locked" : "Allowed"}
          />
        </MetaGroup>
      </header>

      {lockedToSetup ? (
        <NoticeStrip
          markerPrimary="Phase lock"
          markerSecondary={PHASE_LABELS[election.phase]}
          markerIcon={
            <Lock className="h-4 w-4 text-[var(--copper)]" aria-hidden />
          }
          headline="Positions are frozen for the rest of the cycle"
          tone="copper"
        >
          <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Position names, tiers, and ballot order can only change while
            the cycle is in <strong className="font-semibold">Setup</strong>.
            Tier and ballot order changes after setup would re-shuffle the
            cascade ladder voters and evaluators have already started
            against. Move the cycle back to Setup from the{" "}
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

      <PositionFormModal
        mode="add"
        open={!lockedToSetup && showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={async (values) => {
          await add({
            electionId: election._id,
            name: values.name,
            tier: values.tier,
          });
          toast.success("Position added");
        }}
      />

      <PositionFormModal
        mode="edit"
        open={!lockedToSetup && editing !== null}
        onClose={() => setEditing(null)}
        initial={editing}
        onSubmit={async (values) => {
          if (!editing) return;
          if (values.name !== editing.name) {
            await updateName({ positionId: editing._id, name: values.name });
          }
          toast.success("Position updated");
        }}
      />

      {positions.length === 0 ? (
        <EmptyState
          icon={<Plus className="h-5 w-5" aria-hidden />}
          title="No positions yet"
          description="Add a position with the button above, or seed the 9 defaults to get started."
        />
      ) : (
        <section aria-label="Position hierarchy">
          <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <SectionMarker
                primary="Ballot order"
                secondary={`${positions.length} ${positions.length === 1 ? "position" : "positions"}`}
              />
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
                Grouped by tier and precedence
              </p>
            </div>
            {positionPageCount > 1 ? (
              <div className="flex items-center gap-2">
                <p className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
                  {String(positionStart + 1).padStart(2, "0")}-
                  {String(positionEnd).padStart(2, "0")} of{" "}
                  {String(positions.length).padStart(2, "0")}
                </p>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    setPositionPage((page) => Math.max(0, page - 1))
                  }
                  disabled={safePositionPage === 0}
                  aria-label="Previous position page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    setPositionPage((page) =>
                      Math.min(positionPageCount - 1, page + 1),
                    )
                  }
                  disabled={safePositionPage >= positionPageCount - 1}
                  aria-label="Next position page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : null}
          </header>
          <ul
            key={safePositionPage}
            className="grid min-h-[24rem] content-start gap-3 md:grid-cols-2"
          >
            {visiblePositions.map((p, index) => {
              const tierPositions = grouped[p.tier] ?? [];
              const tierIndex = tierPositions.findIndex(
                (position) => position._id === p._id,
              );
              const globalIndex = orderedPositions.findIndex(
                (position) => position._id === p._id,
              );
              return (
                <PositionRow
                  key={p._id}
                  position={p}
                  ordinal={globalIndex + 1}
                  tierOrdinal={tierIndex + 1}
                  tierTotal={tierPositions.length}
                  isFirst={tierIndex === 0}
                  isLast={tierIndex === tierPositions.length - 1}
                  locked={lockedToSetup}
                  index={index}
                  onEdit={() => setEditing(p)}
                  onMove={async (direction) => {
                    try {
                      await move({ positionId: p._id, direction });
                    } catch (err) {
                      toast.error("Reorder failed", {
                        description: getConvexErrorMessage(
                          err,
                          "Reorder failed.",
                        ),
                      });
                    }
                  }}
                  onConfirmedRemove={async () => {
                    try {
                      await remove({ positionId: p._id });
                      toast.success("Position deleted");
                    } catch (err) {
                      toast.error("Delete failed", {
                        description: getConvexErrorMessage(
                          err,
                          "Delete failed.",
                        ),
                      });
                    }
                  }}
                />
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

function PositionRow({
  position,
  ordinal,
  tierOrdinal,
  tierTotal,
  isFirst,
  isLast,
  locked,
  index,
  onEdit,
  onMove,
  onConfirmedRemove,
}: {
  position: Doc<"positions">;
  ordinal: number;
  tierOrdinal: number;
  tierTotal: number;
  isFirst: boolean;
  isLast: boolean;
  locked: boolean;
  index: number;
  onEdit: () => void;
  onMove: (direction: "up" | "down") => void | Promise<void>;
  onConfirmedRemove: () => Promise<void>;
}) {
  const dialog = useDialog();
  const impact = useQuery(api.positions.positionImpact, {
    positionId: position._id,
  });

  const onRemove = async () => {
    if (impact === undefined) return;

    const candidateCount = impact?.candidateCount ?? 0;
    const voteCount = impact?.voteCount ?? 0;

    let description: React.ReactNode;
    if (candidateCount === 0 && voteCount === 0) {
      description = (
        <>
          Permanently delete{" "}
          <strong className="font-semibold">{position.name}</strong>. No
          candidates list it and no votes reference it, so nothing else
          changes. The action cannot be undone.
        </>
      );
    } else {
      description = (
        <>
          Permanently delete{" "}
          <strong className="font-semibold">{position.name}</strong>. This
          unassigns it from{" "}
          <strong className="font-semibold tabular-nums">
            {candidateCount}
          </strong>{" "}
          {candidateCount === 1 ? "candidate" : "candidates"}
          {voteCount > 0 ? (
            <>
              {" "}and discards{" "}
              <strong className="font-semibold tabular-nums">
                {voteCount}
              </strong>{" "}
              {voteCount === 1 ? "vote" : "votes"} already cast on it
            </>
          ) : null}
          . The action cannot be undone.
        </>
      );
    }

    const ok = await dialog.confirm({
      title: "Delete this position?",
      description,
      confirmText: "Delete position",
      variant: "destructive",
    });
    if (!ok) return;
    await onConfirmedRemove();
  };

  return (
    <li
      className="tile-enter flex min-h-32 flex-col justify-between rounded-xl border bg-[var(--color-card)] p-4 text-sm text-[var(--color-card-foreground)] shadow-sm"
      style={{ ["--index" as never]: index }}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--color-secondary)] font-mono text-sm tabular-nums text-[var(--ink-muted)]"
          aria-hidden
        >
          {String(ordinal).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.6875rem] uppercase leading-[1.2] tracking-[0.14em] text-[var(--ink-muted)]">
            Tier {position.tier} · {TIER_LABELS[position.tier] ?? "Other"}
          </p>
          <h3 className="mt-1 truncate font-serif text-lg font-semibold leading-[1.08] text-[var(--ink)]">
            {position.name}
          </h3>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ink-line)] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
            Tier order {tierOrdinal}/{tierTotal}
          </span>
          {impact !== undefined &&
          impact !== null &&
          impact.candidateCount > 0 ? (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] tabular-nums text-[var(--ink-muted)]">
              {impact.candidateCount}{" "}
              {impact.candidateCount === 1 ? "candidate" : "candidates"}
            </span>
          ) : null}
        </div>
        {!locked ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={isFirst}
              onClick={() => void onMove("up")}
              aria-label={`Move ${position.name} up`}
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={isLast}
              onClick={() => void onMove("down")}
              aria-label={`Move ${position.name} down`}
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label={`Delete ${position.name}`}
            >
              <Trash2
                className="h-4 w-4 text-[var(--color-destructive)]"
                aria-hidden
              />
            </Button>
          </div>
        ) : (
          <Badge tone="muted">
            <Lock className="h-3 w-3" aria-hidden /> Locked
          </Badge>
        )}
      </div>
    </li>
  );
}

function PositionFormModal({
  mode,
  open,
  onClose,
  initial,
  onSubmit,
}: {
  mode: "add" | "edit";
  open: boolean;
  onClose: () => void;
  initial?: Doc<"positions"> | null;
  onSubmit: (values: PositionFormValues) => Promise<void>;
}) {
  const nameId = useId();
  const tierId = useId();
  const nameErrId = useId();
  const tierErrId = useId();

  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionSchema),
    defaultValues: { name: "", tier: 1 },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: initial?.name ?? "",
        tier: initial?.tier ?? 1,
      });
    }
  }, [open, initial, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      toast.error(mode === "add" ? "Add failed" : "Update failed", {
        description: getConvexErrorMessage(
          err,
          mode === "add" ? "Add failed." : "Update failed.",
        ),
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!form.formState.isSubmitting) onClose();
      }}
      title={mode === "add" ? "Add a position" : "Rename position"}
      description={
        mode === "add"
          ? "Tier 1 = President, 2 = Vice Presidents, 3 = Directors. Use higher tiers for any extra roles."
          : "Tier and ballot order are managed from the list, not this form."
      }
      size="md"
    >
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            placeholder="Director of Technical Department"
            aria-required="true"
            aria-invalid={form.formState.errors.name ? "true" : undefined}
            aria-describedby={
              form.formState.errors.name ? nameErrId : undefined
            }
            autoFocus
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <p
              id={nameErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
        {mode === "add" ? (
          <div className="grid gap-1.5">
            <Label htmlFor={tierId}>Tier</Label>
            <Select
              id={tierId}
              aria-required="true"
              aria-invalid={form.formState.errors.tier ? "true" : undefined}
              aria-describedby={
                form.formState.errors.tier ? tierErrId : undefined
              }
              {...form.register("tier")}
            >
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>
                  {t} · {TIER_LABELS[t] ?? `Tier ${t}`}
                </option>
              ))}
            </Select>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Cascade rule: higher tiers vote first; their winners are
              removed from lower-tier ballots they listed.
            </p>
            {form.formState.errors.tier ? (
              <p
                id={tierErrId}
                role="alert"
                className="text-xs text-[var(--color-destructive)]"
              >
                {form.formState.errors.tier.message}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {mode === "add" ? (
              <>
                <Plus className="h-4 w-4" aria-hidden /> Add
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
