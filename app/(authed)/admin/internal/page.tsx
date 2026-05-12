"use client";

import { useQuery } from "convex/react";

import { AuthGate } from "@/components/auth/auth-gate";
import { NoElection } from "@/components/admin/no-election";
import { api } from "@/convex/_generated/api";
import { InternalBody } from "./_components/internal-body";
import { InternalPageSkeleton } from "./_components/internal-skeleton";

export default function AdminInternalPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <InternalPageSkeleton />;
  if (election === null) return <NoElection />;
  return <InternalBody election={election} />;
}
