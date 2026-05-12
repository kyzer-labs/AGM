"use client";

import { useQuery } from "convex/react";

import { NoElection } from "@/components/admin/no-election";
import { AuthGate } from "@/components/auth/auth-gate";
import { api } from "@/convex/_generated/api";
import { ResultsBody } from "./_components/results-body";
import { ResultsPageSkeleton } from "./_components/results-skeleton";

export default function AdminResultsPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <ResultsPageSkeleton />;
  if (election === null) return <NoElection />;
  return <ResultsBody election={election} />;
}
