"use client";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminsPageInner } from "./_components/admins-page-inner";

export default function AdminsPage() {
  return (
    <AuthGate mode="profileComplete">
      <AdminsPageInner />
    </AuthGate>
  );
}
