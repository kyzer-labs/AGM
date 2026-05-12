"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";

import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { useDialog } from "@/components/dialog/dialog-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { Meta, MetaGroup } from "@/components/ui/meta";
import { NoticeStrip } from "@/components/ui/notice-strip";
import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { getGridPageSizeForMediaHeight } from "@/lib/viewport-pagination";
import type { Doc } from "@/convex/_generated/dataModel";
import { PositionFormModal } from "./position-form-modal";
import { PositionRow } from "./position-row";
import {
  DEFAULT_POSITIONS,
  DEFAULT_TIER_FOR_NAME,
  PHASE_LABELS,
  POSITION_BOTTOM_GUTTER,
  POSITION_CARD_ROW_HEIGHT,
  POSITION_DESKTOP_COLUMNS,
  POSITION_FALLBACK_PAGE_SIZE,
  POSITION_MIN_ROWS,
  POSITION_MOBILE_COLUMNS,
} from "./positions-model";
import { PositionsPageSkeleton } from "./positions-skeleton";

export function PositionsBody({ election }: { election: Doc<"elections"> }) {
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
  const [positionMediaHeight, setPositionMediaHeight] = useState<
    number | null
  >(null);
  const [positionColumns, setPositionColumns] = useState(
    POSITION_DESKTOP_COLUMNS,
  );
  const positionMediaRef = useRef<HTMLUListElement | null>(null);

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
  useEffect(() => {
    const measurePositionMedia = () => {
      const media = positionMediaRef.current;
      if (!media) return;

      const { top } = media.getBoundingClientRect();
      setPositionMediaHeight(
        Math.max(0, window.innerHeight - top - POSITION_BOTTOM_GUTTER),
      );
      setPositionColumns(
        window.innerWidth >= 768
          ? POSITION_DESKTOP_COLUMNS
          : POSITION_MOBILE_COLUMNS,
      );
    };

    measurePositionMedia();
    window.addEventListener("resize", measurePositionMedia);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measurePositionMedia);
    if (observer) observer.observe(document.body);

    return () => {
      window.removeEventListener("resize", measurePositionMedia);
      observer?.disconnect();
    };
  }, [totalPositions, lockedToSetup]);

  const positionPageSize = getGridPageSizeForMediaHeight({
    mediaHeight: positionMediaHeight,
    rowHeight: POSITION_CARD_ROW_HEIGHT,
    columns: positionColumns,
    minRows: POSITION_MIN_ROWS,
    fallbackRows: POSITION_FALLBACK_PAGE_SIZE,
  });
  const positionPageCount = Math.max(
    1,
    Math.ceil(totalPositions / positionPageSize),
  );
  const safePositionPage = Math.min(positionPage, positionPageCount - 1);
  const positionStart = safePositionPage * positionPageSize;
  const positionEnd = Math.min(
    positionStart + positionPageSize,
    totalPositions,
  );
  const visiblePositions = orderedPositions.slice(positionStart, positionEnd);

  useEffect(() => {
    if (positionPage > positionPageCount - 1) {
      setPositionPage(Math.max(0, positionPageCount - 1));
    }
  }, [positionPage, positionPageCount]);

  if (positions === undefined) {
    return <PositionsPageSkeleton />;
  }

  return (
    <main className="container-wide space-y-6 py-6">
      <AdminBreadcrumb items={[{ label: "Positions" }]} />

      <header className="space-y-3">
        <SectionMarker primary="Positions" secondary={election.name} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="font-display text-2xl font-medium leading-tight text-[var(--ink)] sm:text-3xl">
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
        <MetaGroup className="grid-cols-2 gap-4 pt-3 sm:grid-cols-3 lg:grid-cols-4">
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
            ref={positionMediaRef}
            key={safePositionPage}
            className="grid content-start gap-3 md:grid-cols-2"
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
