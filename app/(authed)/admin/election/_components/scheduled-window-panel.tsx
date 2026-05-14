"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Clock, Save, X } from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
import type { Doc } from "@/convex/_generated/dataModel";

export function ScheduledWindowPanel({ election }: { election: Doc<"elections"> }) {
  const setScheduledWindow = useMutation(api.elections.setScheduledWindow);
  const clearScheduledWindow = useMutation(api.elections.clearScheduledWindow);
  const dialog = useDialog();

  const [start, setStart] = useState<string>(
    election.scheduledStartAt ? millisToInput(election.scheduledStartAt) : "",
  );
  const [end, setEnd] = useState<string>(
    election.scheduledEndAt ? millisToInput(election.scheduledEndAt) : "",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStart(
      election.scheduledStartAt
        ? millisToInput(election.scheduledStartAt)
        : "",
    );
    setEnd(
      election.scheduledEndAt ? millisToInput(election.scheduledEndAt) : "",
    );
  }, [election.scheduledStartAt, election.scheduledEndAt]);

  const startMs = start ? new Date(start).getTime() : undefined;
  const endMs = end ? new Date(end).getTime() : undefined;
  const orderInvalid =
    startMs !== undefined && endMs !== undefined && endMs <= startMs;

  const onSave = async () => {
    if (orderInvalid) {
      toast.error("End time must be after start time");
      return;
    }
    setBusy(true);
    try {
      await setScheduledWindow({
        electionId: election._id,
        startAt: startMs,
        endAt: endMs,
      });
      toast.success("Schedule saved");
    } catch (err) {
      toast.error("Save failed", {
        description: getConvexErrorMessage(err, "Save failed."),
      });
    } finally {
      setBusy(false);
    }
  };

  const onClear = async () => {
    const ok = await dialog.confirm({
      title: "Clear scheduled window?",
      description:
        "Cancels any pending open or close jobs. The phase stays where it is, so you'll need to transition it manually.",
      confirmText: "Clear schedule",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await clearScheduledWindow({ electionId: election._id });
      toast.success("Schedule cleared");
    } catch (err) {
      toast.error("Clear failed", {
        description: getConvexErrorMessage(err, "Clear failed."),
      });
    } finally {
      setBusy(false);
    }
  };

  const hasSchedule =
    election.scheduledStartAt !== undefined ||
    election.scheduledEndAt !== undefined;

  const startId = `sched-start-${election._id}`;
  const endId = `sched-end-${election._id}`;
  const orderErrId = `${endId}-err`;

  return (
    <section
      className="space-y-4 rounded-md border border-[var(--ink-line)] bg-[var(--paper-2)] p-5"
      aria-labelledby={`schedule-heading-${election._id}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <Clock className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
        <h3
          id={`schedule-heading-${election._id}`}
          className="text-sm font-semibold text-[var(--ink)]"
        >
          Internal evaluation window
        </h3>
        <Badge tone="muted">
          {election.phase === "setup" ? "Setup or open" : "Active"}
        </Badge>
      </header>
      <p className="max-w-[60ch] text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        Optional auto-open and auto-close timestamps. Times are interpreted in
        your browser&apos;s local time zone but the cycle runs against
        Malaysia Time (MYT). The cycle moves into{" "}
        <strong className="font-semibold">Internal evaluation open</strong>{" "}
        at the start time (only if setup is ready) and into{" "}
        <strong className="font-semibold">Internal evaluation closed</strong>{" "}
        at the end time. Manual phase changes cancel any pending jobs.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={startId}>Start (auto-open)</Label>
          <Input
            id={startId}
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={election.phase !== "setup"}
          />
          {election.phase !== "setup" ? (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Auto-open only triggers from Setup. This cycle is already past
              Setup.
            </span>
          ) : startMs ? (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
              {formatMYT(startMs)}
            </span>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={endId}>End (auto-close)</Label>
          <Input
            id={endId}
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-invalid={orderInvalid ? "true" : undefined}
            aria-describedby={orderInvalid ? orderErrId : undefined}
          />
          {orderInvalid ? (
            <span
              id={orderErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              End must be after start.
            </span>
          ) : endMs ? (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] tabular-nums text-[var(--ink-muted)]">
              {formatMYT(endMs)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onSave} loading={busy} size="sm">
            <Save className="h-4 w-4" aria-hidden /> Save schedule
          </Button>
          {hasSchedule ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={busy}
            >
              <X className="h-4 w-4" aria-hidden /> Clear
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function millisToInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
