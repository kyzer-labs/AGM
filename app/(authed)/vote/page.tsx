"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Vote } from "lucide-react";

export default function VotePage() {
  return (
    <main className="container-narrow py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" aria-hidden />
              AGM live voting
            </CardTitle>
            <Badge tone="muted">Phase 5</Badge>
          </div>
          <CardDescription>
            On AGM day, this screen will show the currently active position
            and its eligible candidates. You will pick one candidate and
            confirm. After voting, the screen will say so and wait for the
            next ballot. Live results are never shown to voters during voting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No public voting session is active right now.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
