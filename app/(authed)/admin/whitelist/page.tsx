"use client";

import { useQuery } from "convex/react";

import { AuthGate } from "@/components/auth/auth-gate";
import { NoElection } from "@/components/admin/no-election";
import { api } from "@/convex/_generated/api";
import { WhitelistBody } from "./_components/whitelist-body";
import { WhitelistPageSkeleton } from "./_components/whitelist-skeleton";

export default function WhitelistPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <WhitelistPageSkeleton />;
  if (election === null) return <NoElection />;
  return <WhitelistBody election={election} />;
}
