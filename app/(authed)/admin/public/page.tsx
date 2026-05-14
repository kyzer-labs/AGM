"use client";

import { useQuery } from "convex/react";

import { AuthGate } from "@/components/auth/auth-gate";
import { NoElection } from "@/components/admin/no-election";
import { api } from "@/convex/_generated/api";
import { PublicBody } from "./_components/public-body";
import { PublicPageSkeleton } from "./_components/public-skeleton";

export default function AdminPublicPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const election = useQuery(api.elections.getCurrent);
  if (election === undefined) return <PublicPageSkeleton />;
  if (election === null) return <NoElection />;
  return <PublicBody election={election} />;
}
