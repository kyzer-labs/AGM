"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirebaseAuth } from "@/lib/use-firebase-auth";
import { isUsmStudentEmail } from "@/lib/utils";
import { signOutFirebase } from "@/lib/firebase";
import { toast } from "sonner";

type Mode = "any" | "profileComplete" | "admin" | "superAdmin";

interface AuthGateProps {
  mode: Mode;
  children: ReactNode;
}

/**
 * Client-side gate. Redirects unauthenticated users to `/`,
 * users without a USM email back to `/`, and users without a
 * completed profile to `/profile/complete`.
 *
 * NOTE: Server-side authorization is enforced inside every
 * Convex function — this gate is only for UX.
 */
export function AuthGate({ mode, children }: AuthGateProps) {
  const router = useRouter();
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const firebase = useFirebaseAuth();
  const ensureVoter = useMutation(api.voters.ensureVoter);
  const me = useQuery(api.voters.me);
  const ensuredOnce = useRef(false);

  useEffect(() => {
    if (firebase.isLoading) return;
    const email = firebase.user?.email ?? null;
    if (firebase.user && !isUsmStudentEmail(email)) {
      void signOutFirebase().then(() => {
        toast.error("Only @student.usm.my accounts can use this site.");
        router.replace("/");
      });
    }
  }, [firebase.isLoading, firebase.user, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (ensuredOnce.current) return;
    ensuredOnce.current = true;
    void ensureVoter({});
  }, [isAuthenticated, ensureVoter]);

  useEffect(() => {
    if (firebase.isLoading || convexAuthLoading) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    if (me === undefined) return;
    if (me === null) return;

    if (mode !== "any" && !me.profileComplete) {
      router.replace("/profile/complete");
      return;
    }
    if (mode === "admin" && me.role !== "admin" && me.role !== "super") {
      router.replace("/dashboard");
      return;
    }
    if (mode === "superAdmin" && me.role !== "super") {
      router.replace("/dashboard");
      return;
    }
  }, [
    firebase.isLoading,
    convexAuthLoading,
    isAuthenticated,
    me,
    mode,
    router,
  ]);

  if (
    firebase.isLoading ||
    convexAuthLoading ||
    !isAuthenticated ||
    me === undefined
  ) {
    return (
      <div className="container-narrow space-y-4 py-16">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
