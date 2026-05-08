"use client";

import { useMemo, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import { Toaster } from "sonner";
import { useFirebaseAuth } from "@/lib/use-firebase-auth";
import { DialogProvider } from "@/components/dialog/dialog-provider";

function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL is not set. Run `bunx convex dev` once to populate it. See docs/SETUP.md.",
    );
  }
  return url;
}

export function Providers({ children }: { children: ReactNode }) {
  const convex = useMemo(() => new ConvexReactClient(getConvexUrl()), []);

  return (
    <ConvexProviderWithAuth client={convex} useAuth={useFirebaseAuth}>
      <DialogProvider>
        {children}
        <Toaster richColors closeButton position="top-center" />
      </DialogProvider>
    </ConvexProviderWithAuth>
  );
}
