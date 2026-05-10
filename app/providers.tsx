"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import { Toaster, toast } from "sonner";
import { useFirebaseAuth } from "@/lib/use-firebase-auth";
import { DialogProvider } from "@/components/dialog/dialog-provider";
import { processRedirectResult, signOutFirebase } from "@/lib/firebase";
import { getFirebaseAuthErrorCode } from "@/lib/firebase-error";
import { isUsmStudentEmail } from "@/lib/utils";

function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is not set. Run `bunx convex dev` once to populate it. See docs/SETUP.md.",
    );
  }
  return url;
}

/**
 * Picks up a pending Firebase redirect-flow sign-in result on app mount.
 * Pairs with `signInWithMicrosoftRedirect`, which is the fallback when
 * the browser blocks the popup window. If the redirected user is not on
 * the @student.usm.my domain we sign them out immediately so the rest
 * of the app's auth gates don't have to second-guess the identity.
 *
 * This component renders nothing and runs exactly once per page load.
 */
function RedirectResultHandler() {
  useEffect(() => {
    void (async () => {
      try {
        const result = await processRedirectResult();
        if (!result) return;
        const email = result.user.email ?? null;
        if (!isUsmStudentEmail(email)) {
          await signOutFirebase();
          toast.error("Sign-in rejected", {
            description:
              "Only @student.usm.my accounts can use this site. Please sign in with your USM student email.",
          });
          return;
        }
        toast.success("Signed in");
      } catch (err) {
        const code = getFirebaseAuthErrorCode(err);
        if (code === "auth/account-exists-with-different-credential") {
          toast.error("Account already linked elsewhere", {
            description:
              "This Microsoft account is already linked to another sign-in method.",
          });
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : "Sign-in failed. Please try again.";
        toast.error("Sign-in failed", { description: message });
      }
    })();
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const convex = useMemo(() => new ConvexReactClient(getConvexUrl()), []);

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useFirebaseAuth}>
      <DialogProvider>
        <RedirectResultHandler />
        {children}
        <Toaster richColors closeButton position="top-center" />
      </DialogProvider>
    </ConvexProviderWithAuth>
  );
}
