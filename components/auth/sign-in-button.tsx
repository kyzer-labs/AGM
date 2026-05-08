"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isUsmStudentEmail } from "@/lib/utils";
import { signInWithMicrosoft, signOutFirebase } from "@/lib/firebase";
import { getConvexErrorMessage } from "@/lib/convex-error";

export function SignInButton({
  size = "lg",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
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
      const message =
        getConvexErrorMessage(err, "Sign-in failed. Please try again.");
      if (!/popup-closed|cancelled/i.test(message)) {
        toast.error("Sign-in failed", { description: message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={onClick}
      loading={loading}
      size={size}
      className={className}
    >
      <svg
        viewBox="0 0 23 23"
        className="h-4 w-4"
        aria-hidden
      >
        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
        <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
        <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
        <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
      </svg>
      Sign in with Microsoft
    </Button>
  );
}
