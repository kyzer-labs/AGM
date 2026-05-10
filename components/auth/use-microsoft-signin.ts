"use client";

import { useState } from "react";
import { toast } from "sonner";
import { signInWithMicrosoft } from "@/lib/firebase";
import { getConvexErrorMessage } from "@/lib/convex-error";

/**
 * Owns the Microsoft sign-in flow used across both the small SignInButton
 * and the larger landing-page CTA.
 *
 * Implementation note: `signInWithMicrosoft` uses Firebase's redirect
 * flow (see `lib/firebase.ts` for the rationale), so this handler does
 * not need a popup-blocked fall-back path. The page navigates to
 * Microsoft and the result is consumed by `RedirectResultHandler` in
 * `app/providers.tsx` after the user comes back, which is also where
 * the @student.usm.my domain check, sign-out, and success toast happen.
 * That keeps the UX consistent regardless of whether the user comes back
 * to the landing or any other authenticated route.
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
    } catch (err) {
      const message = getConvexErrorMessage(
        err,
        "Sign-in failed. Please try again.",
      );
      toast.error("Sign-in failed", { description: message });
      setLoading(false);
    }
  };

  return { loading, signIn };
}
