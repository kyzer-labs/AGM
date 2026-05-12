"use client";

import { useQuery } from "convex/react";

import { AuthGate } from "@/components/auth/auth-gate";
import { NoElection } from "@/components/admin/no-election";
import { api } from "@/convex/_generated/api";
import { CandidatesBody } from "./_components/candidates-body";
import { CandidatesPageSkeleton } from "./_components/candidates-skeleton";

export default function CandidatesPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <CandidatesPageSkeleton />;
  if (election === null) return <NoElection />;
  return <CandidatesBody election={election} />;
}
