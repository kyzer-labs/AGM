"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";

export default function InternalEvaluationPage() {
  return (
    <main className="container-narrow py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" aria-hidden />
              Internal evaluation
            </CardTitle>
            <Badge tone="muted">Phase 4</Badge>
          </div>
          <CardDescription>
            Once admins open the internal evaluation window and add you to the
            Year 2 whitelist, this page will show the rubric grid for every
            active candidate. You will be able to save drafts and submit your
            evaluation. Editing remains open until the window closes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Internal evaluation is not open yet. Check back closer to AGM
            day.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
