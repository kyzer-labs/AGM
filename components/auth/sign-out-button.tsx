"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutFirebase } from "@/lib/firebase";
import { toast } from "sonner";
import { getConvexErrorMessage } from "@/lib/convex-error";

export function SignOutButton({
  variant = "ghost",
  size = "sm",
}: {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      await signOutFirebase();
      toast("Signed out");
      router.push("/");
      router.refresh();
    } catch (err) {
      const message =
        getConvexErrorMessage(err, "Could not sign out.");
      toast.error("Sign-out failed", { description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={onClick} loading={loading} variant={variant} size={size}>
      <LogOut className="h-4 w-4" aria-hidden />
      Sign out
    </Button>
  );
}
