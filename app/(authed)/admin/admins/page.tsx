"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Clock3, ShieldCheck, ShieldOff, Trash2, UserPlus } from "lucide-react";
import { getConvexErrorMessage } from "@/lib/convex-error";

import { AuthGate } from "@/components/auth/auth-gate";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { useDialog } from "@/components/dialog/dialog-provider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";


const grantSchema = z.object({
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
type GrantValues = z.infer<typeof grantSchema>;

export default function AdminsPage() {
  return (
    <AuthGate mode="profileComplete">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const router = useRouter();
  const dialog = useDialog();
  const adminStatus = useQuery(api.admins.myAdminStatus);
  const list = useQuery(api.admins.listAdmins);
  const grant = useMutation(api.admins.grantAdmin);
  const revoke = useMutation(api.admins.revokeAdmin);

  const isSuper = adminStatus?.role === "super";

  useEffect(() => {
    if (adminStatus === undefined) return;
    if (!isSuper) router.replace("/admin");
  }, [adminStatus, isSuper, router]);

  const [showGrant, setShowGrant] = useState(false);
  const form = useForm<GrantValues>({
    resolver: zodResolver(grantSchema),
    defaultValues: { email: "", role: "admin" },
  });

  if (adminStatus === undefined || list === undefined) {
    return (
      <main className="container-wide py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (!isSuper) return null;

  const onGrant = form.handleSubmit(async (values) => {
    try {
      const result = await grant(values);
      if (result.pending) {
        toast.success("Invite created", {
          description:
            "They have not signed in yet — admin access will activate automatically the first time they sign in.",
        });
      } else {
        toast.success("Admin access granted");
      }
      form.reset({ email: "", role: "admin" });
      setShowGrant(false);
    } catch (err) {
      toast.error("Grant failed", {
        description: getConvexErrorMessage(err, "Grant failed."),
      });
    }
  });

  return (
    <main className="container-wide py-10 space-y-8">
      <AdminBreadcrumb items={[{ label: "Admins" }]} />

      <header className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Admin allowlist
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Super admins manage who else can run the AGM. You can invite
            someone before they sign in — their access will activate the
            first time they sign in with their @student.usm.my account.
          </p>
        </div>
        <Button
          onClick={() => {
            form.reset({ email: "", role: "admin" });
            setShowGrant(true);
          }}
        >
          <UserPlus className="h-4 w-4" /> Grant admin
        </Button>
      </header>

      <Modal
        open={showGrant}
        onClose={() => setShowGrant(false)}
        title="Grant admin access"
        description={
          <>
            <strong>Admin</strong> = day-to-day operations.{" "}
            <strong>Super admin</strong> = also can manage admins, do
            emergency overrides, and resolve ties.
          </>
        }
        size="md"
      >
        <form onSubmit={onGrant} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="grant-email">Email</Label>
            <Input
              id="grant-email"
              type="email"
              placeholder="someone@student.usm.my"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-[var(--color-destructive)]">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="grant-role">Role</Label>
            <Select id="grant-role" {...form.register("role")}>
              <option value="admin">Admin</option>
              <option value="super">Super admin</option>
            </Select>
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            The recipient must have signed in once with their{" "}
            <code>@student.usm.my</code> Microsoft account before they can be
            granted access.
          </p>
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowGrant(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Grant
            </Button>
          </div>
        </form>
      </Modal>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Current admins{" "}
            <span className="text-[var(--color-muted-foreground)]">
              ({list.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <EmptyState
              title="No admins yet"
              description="Use the form above to grant access."
            />
          ) : (
            <ul className="divide-y">
              {list.map((a) => (
                <li
                  key={a._id}
                  className="flex flex-wrap items-center gap-3 py-2"
                >
                  <Badge tone={a.role === "super" ? "brand" : "muted"}>
                    {a.role === "super" ? (
                      <>
                        <ShieldCheck className="h-3 w-3" aria-hidden /> Super
                      </>
                    ) : (
                      <>
                        <ShieldOff className="h-3 w-3" aria-hidden /> Admin
                      </>
                    )}
                  </Badge>
                  {a.pending ? (
                    <Badge tone="warning">
                      <Clock3 className="h-3 w-3" aria-hidden /> Pending sign-in
                    </Badge>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {a.fullName ?? a.email}
                    </div>
                    <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                      {a.email} · {a.pending ? "invited" : "added"}{" "}
                      {new Date(a.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      const ok = await dialog.confirm({
                        title: `Revoke ${a.role} access?`,
                        description: (
                          <>
                            Remove access for <strong>{a.email}</strong>.
                            They will lose admin privileges immediately.
                            This is logged.
                          </>
                        ),
                        confirmText: "Revoke access",
                        variant: "destructive",
                      });
                      if (!ok) return;
                      try {
                        await revoke({ adminId: a._id });
                        toast.success("Revoked");
                      } catch (err) {
                        toast.error("Revoke failed", {
                          description: getConvexErrorMessage(
                            err,
                            "Revoke failed.",
                          ),
                        });
                      }
                    }}
                    aria-label="Revoke"
                  >
                    <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
