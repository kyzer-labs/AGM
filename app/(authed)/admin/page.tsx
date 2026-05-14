"use client";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminPageInner } from "./_components/admin-page-inner";

export default function AdminPage() {
  return (
    <AuthGate mode="profileComplete">
      <AdminPageInner />
    </AuthGate>
  );
}
