"use client";

import { useQuery } from "convex/react";

import { NoElection } from "@/components/admin/no-election";
import { api } from "@/convex/_generated/api";
import { DevBody } from "./dev-body";
import { DevDisabledNotice } from "./dev-disabled-notice";
import { DevPageSkeleton } from "./dev-skeleton";

export function DevPageInner() {
  const config = useQuery(api.dev.config);
  const election = useQuery(api.elections.getCurrent);

  if (config === undefined || election === undefined) {
    return <DevPageSkeleton />;
  }
  if (!config.enabled) return <DevDisabledNotice />;
  if (election === null) return <NoElection />;
  return <DevBody election={election} />;
}
