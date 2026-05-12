import { CheckCircle2, Circle, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function SessionBadge({
  status,
}: {
  status: "pending" | "active" | "closed";
}) {
  if (status === "active") {
    return (
      <Badge tone="brand" className="text-[9px]">
        <PlayCircle className="h-2.5 w-2.5" aria-hidden /> Active
      </Badge>
    );
  }
  if (status === "closed") {
    return (
      <Badge tone="success" className="text-[9px]">
        <CheckCircle2 className="h-2.5 w-2.5" aria-hidden /> Closed
      </Badge>
    );
  }
  return (
    <Badge tone="muted" className="text-[9px]">
      <Circle className="h-2.5 w-2.5" aria-hidden /> Pending
    </Badge>
  );
}
