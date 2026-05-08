import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { AuthGate } from "@/components/auth/auth-gate";

export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <AuthGate mode="any">
        <SiteHeader />
        <div>{children}</div>
      </AuthGate>
    </div>
  );
}
