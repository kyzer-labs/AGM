"use client";

import { Button } from "@/components/ui/button";
import { useMicrosoftSignIn } from "@/components/auth/use-microsoft-signin";

/**
 * Smaller secondary-surface sign-in button. The landing's loud CTA
 * lives in `components/landing/sign-in-cta.tsx` and is the one a voter
 * actually sees on the door; this component is the implicit fallback
 * for any future authed surface that needs an in-page sign-in trigger
 * without the premium Button-in-Button treatment.
 *
 * Vocabulary stays USM-student-facing: "Sign in with USM email" rather
 * than "Sign in with Microsoft". The OAuth provider underneath is
 * still Microsoft (USM accounts are Outlook), but no student
 * recognises their account by that name. The Microsoft mark is
 * deliberately omitted to keep the surface speaking the student's
 * vocabulary, matching the landing CTA.
 */
export function SignInButton({
  size = "lg",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { loading, signIn } = useMicrosoftSignIn();

  return (
    <Button
      onClick={signIn}
      loading={loading}
      size={size}
      className={className}
    >
      Sign in with USM email
    </Button>
  );
}
