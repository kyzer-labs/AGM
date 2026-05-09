"use client";

import { Button } from "@/components/ui/button";
import { useMicrosoftSignIn } from "@/components/auth/use-microsoft-signin";

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
      <svg viewBox="0 0 23 23" className="h-4 w-4" aria-hidden>
        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
        <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
        <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
        <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
      </svg>
      Sign in with Microsoft
    </Button>
  );
}
