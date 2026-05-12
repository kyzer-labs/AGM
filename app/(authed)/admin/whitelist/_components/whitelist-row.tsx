"use client";

import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { CheckCircle2, Trash2 } from "lucide-react";

import { useDialog } from "@/components/dialog/dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";
import { formatMYT } from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";
import {
  VOTER_CLASS_LABEL,
  VOTER_CLASS_OPTIONS,
  type VoterClass,
} from "./whitelist-model";
import { VoterClassBadge } from "./voter-class-badge";

export function WhitelistRow({
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

    let description: ReactNode;
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
