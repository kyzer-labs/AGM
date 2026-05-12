"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { SectionMarker } from "@/components/ui/section-marker";
import { api } from "@/convex/_generated/api";
import {
  NoCycleCommandCenter,
  PhaseCommandCenter,
} from "./admin-command-center";
import { AdminPageSkeleton } from "./admin-page-skeleton";
import { BootstrapPanel } from "./bootstrap-panel";

export function AdminPageInner() {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const superExists = useQuery(api.admins.superAdminExists);
  const devConfig = useQuery(api.dev.config);
  const current = useQuery(api.elections.getCurrent);
  const readiness = useQuery(
    api.elections.setupReadiness,
    current?.phase === "setup" ? { electionId: current._id } : "skip",
  );

  const isAdmin =
    adminStatus?.role === "admin" || adminStatus?.role === "super";
  const isSuper = adminStatus?.role === "super";
  const devEnabled = devConfig?.enabled === true;

  useEffect(() => {
    if (
      adminStatus === undefined ||
      superExists === undefined ||
      me === undefined
    ) {
      return;
    }
    if (!isAdmin && superExists) {
      router.replace("/dashboard");
    }
  }, [adminStatus, superExists, me, isAdmin, router]);

  if (
    me === undefined ||
    adminStatus === undefined ||
    superExists === undefined ||
    current === undefined
  ) {
    return <AdminPageSkeleton />;
  }

  if (!isAdmin && superExists) {
    return null;
  }

  const headerCopy = isAdmin
    ? {
        markerSecondary: isSuper ? "Super admin" : "Admin",
        title: "AGM command center",
        body: current
          ? "Only the current phase is expanded here. Detailed admin pages remain available when you need to inspect or correct something specific."
          : "Create the next AGM cycle to begin setup. System tools stay available below for rehearsal and admin maintenance.",
      }
    : {
        markerSecondary: "Setup pending",
        title: "Admin setup",
        body: "Become the first super admin for this deployment. Once complete, this page becomes the phase command center.",
      };

  return (
    <main className="container-wide space-y-12 py-12 sm:py-16">
      <header className="space-y-4">
        <SectionMarker
          primary="Admin console"
          secondary={headerCopy.markerSecondary}
        />
        <h1 className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          {headerCopy.title}
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {headerCopy.body}
        </p>
      </header>

      <BootstrapPanel />

      {isAdmin ? (
        <>
          {current ? (
            <PhaseCommandCenter
              election={current}
              readiness={readiness}
              devEnabled={devEnabled}
            />
          ) : (
            <NoCycleCommandCenter devEnabled={devEnabled} />
          )}
        </>
      ) : null}
    </main>
  );
}
