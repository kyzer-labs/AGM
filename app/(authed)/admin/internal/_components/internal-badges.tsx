import { CheckCircle2, Circle, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  VOTER_CLASS_LABEL,
  type VoterClass,
} from "./internal-model";

export function ClassLabel({ voterClass }: { voterClass: VoterClass }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--ink)]">
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 rounded-[2px]",
          voterClass === "topCommittee"
            ? "bg-[var(--teal)]"
            : voterClass === "headExecutive"
              ? "bg-[var(--copper)]"
              : "bg-[var(--ink-muted)]",
        )}
      />
      {VOTER_CLASS_LABEL[voterClass]}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "submitted")
    return (
      <Badge tone="success" className="rounded-[3px]">
        <CheckCircle2 className="h-3 w-3" aria-hidden /> Submitted
      </Badge>
    );
  if (status === "draft")
    return (
      <Badge tone="warning" className="rounded-[3px]">
        <PenLine className="h-3 w-3" aria-hidden /> Draft
      </Badge>
    );
  return (
    <Badge tone="muted" className="rounded-[3px]">
      <Circle className="h-3 w-3" aria-hidden /> Not started
    </Badge>
  );
}
