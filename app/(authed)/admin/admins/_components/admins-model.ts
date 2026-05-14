import { z } from "zod";

import type { Id } from "@/convex/_generated/dataModel";

export const grantSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Must be a valid email")
    .refine(
      (e) => e.endsWith("@student.usm.my"),
      "Must end in @student.usm.my",
    ),
  role: z.enum(["super", "admin"]),
});

export type GrantValues = z.infer<typeof grantSchema>;

export const ROLE_LABEL: Record<"super" | "admin", string> = {
  super: "Super admin",
  admin: "Admin",
};

export const ROLE_DESCRIPTION: Record<"super" | "admin", string> = {
  super:
    "Everything the admin role can do, plus managing the admin allowlist, resolving manual ties, and running the emergency voter-audit lookup.",
  admin:
    "Configure the cycle, run live ballots, monitor counts, and publish results. Cannot manage admins or run emergency audits.",
};

export interface AdminListEntry {
  _id: Id<"admins">;
  email: string;
  role: "super" | "admin";
  fullName: string | null;
  pending: boolean;
  createdAt: number;
}
