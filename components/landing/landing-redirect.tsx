"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useFirebaseAuth } from "@/lib/use-firebase-auth";
import { isUsmStudentEmail } from "@/lib/utils";

/**
 * Side-effect-only client component that hands authenticated visitors
 * off to `/dashboard`. Renders nothing; mounted on the public landing
 * (`app/page.tsx`) so:
 *
 *  - Anonymous visitors see the landing instantly (server-rendered HTML),
 *    no skeleton flash, no auth gate.
 *  - Already-authenticated visitors who type `/` (revisit, refresh,
 *    deep-link share) get punted to their work surface as soon as
 *    Firebase auth state hydrates.
 *  - Visitors who just completed the Microsoft redirect-flow sign-in
 *    land back on `/` (Firebase's redirect handler returns the user to
 *    the origin they came from). They observe a short moment on the
 *    landing while `processRedirectResult` runs in `Providers`, and
 *    then get redirected here as soon as the Firebase ID token
 *    propagates to Convex.
 *
 * The destination is deliberately `/dashboard`. That route's `AuthGate`
 * + `Stage` machinery already encodes every downstream routing decision:
 *
 *    profile incomplete    → /profile/complete
 *    admin / super         → /admin (with first-time bootstrap panel)
 *    voter, internalOpen,  → /internal
 *      whitelisted
 *    voter, publicVoting,  → /vote
 *      not whitelisted
 *    voter, published      → /results
 *    other phases          → /dashboard standby copy
 *
 * Doing the redirect here instead of inside the existing `signIn`
 * handler keeps a single source of truth: any path that ends with
 * "Firebase user is signed in and on `/`" lands the user correctly,
 * regardless of whether they reached this state from a fresh OAuth
 * redirect, persisted localStorage on revisit, or a browser back button.
 *
 * A non-USM email should never reach this component (the sign-in flow
 * signs them out and toasts an error before this effect would fire),
 * but the email guard is defensive in case the auth state machine
 * race-hydrates before the sign-out completes.
 */
export function LandingRedirect() {
  const router = useRouter();
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const firebase = useFirebaseAuth();

  useEffect(() => {
    if (firebase.isLoading || convexAuthLoading) return;
    if (!isAuthenticated) return;

    const email = firebase.user?.email ?? null;
    if (!isUsmStudentEmail(email)) return;

    router.replace("/dashboard");
  }, [
    firebase.isLoading,
    firebase.user,
    convexAuthLoading,
    isAuthenticated,
    router,
  ]);

  return null;
}
