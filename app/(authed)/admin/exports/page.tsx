"use client";

import { useQuery } from "convex/react";

import { AuthGate } from "@/components/auth/auth-gate";
import { NoElection } from "@/components/admin/no-election";
import { api } from "@/convex/_generated/api";
import { ExportsBody } from "./_components/exports-body";
import { ExportsPageSkeleton } from "./_components/exports-skeleton";

export default function ExportsPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <ExportsPageSkeleton />;
  if (election === null) return <NoElection />;
  return <ExportsBody election={election} />;
}
