"use client";

import { useState } from "react";
import { toast } from "sonner";
import { isUsmStudentEmail } from "@/lib/utils";
import { signInWithMicrosoft, signOutFirebase } from "@/lib/firebase";
import { getConvexErrorMessage } from "@/lib/convex-error";

/**
 * Owns the Microsoft sign-in flow used across both the small SignInButton
 * and the larger landing-page CTA. Centralises the @student.usm.my domain
 * check, popup-cancel ignoring, and toast surfacing so neither caller has
 * to reimplement it.
 */
export function useMicrosoftSignIn(): {
  loading: boolean;
  signIn: () => Promise<void>;
} {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    try {
      await signInWithMicrosoft();
      const auth = (await import("@/lib/firebase")).getFirebaseAuth();
      const email = auth.currentUser?.email ?? null;
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
      const message = getConvexErrorMessage(
        err,
        "Sign-in failed. Please try again.",
      );
      if (!/popup-closed|cancelled/i.test(message)) {
        toast.error("Sign-in failed", { description: message });
      }
    } finally {
      setLoading(false);
    }
  };

  return { loading, signIn };
}
