"use client";

import { AuthGate } from "@/components/auth/auth-gate";
import { DevPageInner } from "./_components/dev-page-inner";

export default function DevSeedPage() {
  return (
    <AuthGate mode="profileComplete">
      <DevPageInner />
    </AuthGate>
  );
}
