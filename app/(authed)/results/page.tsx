"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";

export default function ResultsPage() {
  return (
    <main className="container-narrow py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" aria-hidden />
              Published results
            </CardTitle>
            <Badge tone="muted">Phase 6</Badge>
          </div>
          <CardDescription>
            Once admins publish results, this page will show the winner of
            each position together with each candidate&apos;s normalized
            internal share, public vote share, and final combined percentage
            (75% internal + 25% public).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Results have not been published yet.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
