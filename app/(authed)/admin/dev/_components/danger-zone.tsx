import { useQuery } from "convex/react";
import { Flame, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

type DevStats = ReturnType<typeof useQuery<typeof api.dev.stats>>;

export function DangerZone({
  phase,
  stats,
  onWipeTestCandidates,
  onWipe,
  onWipeAll,
}: {
  phase: Doc<"elections">["phase"];
  stats: DevStats;
  onWipeTestCandidates: () => void;
  onWipe: () => void;
  onWipeAll: () => void;
}) {
  return (
    <Card className="border-[var(--color-destructive)]">
      <CardHeader>
        <CardTitle className="text-base">Danger zone</CardTitle>
        <CardDescription>
          Destructive cleanup tools. Confirmation dialogs list the exact
          rows affected before anything is removed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={onWipeTestCandidates}
          disabled={phase === "published" || stats?.candidates.test === 0}
        >
          <Trash2 className="h-4 w-4" /> Wipe fixtures
        </Button>
        <Button variant="destructive" onClick={onWipe}>
          <Trash2 className="h-4 w-4" /> Wipe seed data
        </Button>
        <Button variant="destructive" onClick={onWipeAll}>
          <Flame className="h-4 w-4" /> Wipe everything
        </Button>
      </CardContent>
    </Card>
  );
}
