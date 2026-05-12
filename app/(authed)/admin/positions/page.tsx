"use client";

import { useQuery } from "convex/react";

import { AuthGate } from "@/components/auth/auth-gate";
import { NoElection } from "@/components/admin/no-election";
import { api } from "@/convex/_generated/api";
import { PositionsBody } from "./_components/positions-body";
import { PositionsPageSkeleton } from "./_components/positions-skeleton";

export default function PositionsPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <PositionsPageSkeleton />;
  if (election === null) return <NoElection />;
  return <PositionsBody election={election} />;
}
