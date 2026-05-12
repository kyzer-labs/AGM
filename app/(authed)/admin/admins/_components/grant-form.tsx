"use client";

import { useId } from "react";
import type { BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  type GrantValues,
} from "./admins-model";

export function GrantForm({
  form,
  onSubmit,
  onCancel,
}: {
  form: ReturnType<typeof useForm<GrantValues>>;
  onSubmit: (e?: BaseSyntheticEvent) => Promise<void>;
  onCancel: () => void;
}) {
  const emailId = useId();
  const roleId = useId();
  const emailErrId = useId();

  const role = form.watch("role");

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor={emailId}>Student email</Label>
        <Input
          id={emailId}
          type="email"
          placeholder="someone@student.usm.my"
          autoComplete="off"
          aria-required="true"
          aria-invalid={form.formState.errors.email ? "true" : undefined}
          aria-describedby={
            form.formState.errors.email ? emailErrId : undefined
          }
          autoFocus
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p
            id={emailErrId}
            role="alert"
            className="text-xs text-[var(--color-destructive)]"
          >
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={roleId}>Role</Label>
        <Select id={roleId} {...form.register("role")}>
          <option value="admin">Admin</option>
          <option value="super">Super admin</option>
        </Select>
        <p className="text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
          {ROLE_DESCRIPTION[role]}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={form.formState.isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          <UserPlus className="h-4 w-4" aria-hidden /> Grant {ROLE_LABEL[role].toLowerCase()}
        </Button>
      </div>
    </form>
  );
}
