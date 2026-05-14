"use client";

import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  positionSchema,
  TIER_LABELS,
  type PositionFormValues,
} from "./positions-model";

export function PositionFormModal({
  mode,
  open,
  onClose,
  initial,
  onSubmit,
}: {
  mode: "add" | "edit";
  open: boolean;
  onClose: () => void;
  initial?: Doc<"positions"> | null;
  onSubmit: (values: PositionFormValues) => Promise<void>;
}) {
  const nameId = useId();
  const tierId = useId();
  const nameErrId = useId();
  const tierErrId = useId();

  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionSchema),
    defaultValues: { name: "", tier: 1 },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: initial?.name ?? "",
        tier: initial?.tier ?? 1,
      });
    }
  }, [open, initial, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      toast.error(mode === "add" ? "Add failed" : "Update failed", {
        description: getConvexErrorMessage(
          err,
          mode === "add" ? "Add failed." : "Update failed.",
        ),
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!form.formState.isSubmitting) onClose();
      }}
      title={mode === "add" ? "Add a position" : "Rename position"}
      description={
        mode === "add"
          ? "Tier 1 = President, 2 = Vice Presidents, 3 = Directors. Use higher tiers for any extra roles."
          : "Tier and ballot order are managed from the list, not this form."
      }
      size="md"
    >
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Name</Label>
          <Input
            id={nameId}
            placeholder="Director of Technical Department"
            aria-required="true"
            aria-invalid={form.formState.errors.name ? "true" : undefined}
            aria-describedby={
              form.formState.errors.name ? nameErrId : undefined
            }
            autoFocus
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <p
              id={nameErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
        {mode === "add" ? (
          <div className="grid gap-1.5">
            <Label htmlFor={tierId}>Tier</Label>
            <Select
              id={tierId}
              aria-required="true"
              aria-invalid={form.formState.errors.tier ? "true" : undefined}
              aria-describedby={
                form.formState.errors.tier ? tierErrId : undefined
              }
              {...form.register("tier")}
            >
              {[1, 2, 3, 4].map((t) => (
                <option key={t} value={t}>
                  {t} · {TIER_LABELS[t] ?? `Tier ${t}`}
                </option>
              ))}
            </Select>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Cascade rule: higher tiers vote first; their winners are
              removed from lower-tier ballots they listed.
            </p>
            {form.formState.errors.tier ? (
              <p
                id={tierErrId}
                role="alert"
                className="text-xs text-[var(--color-destructive)]"
              >
                {form.formState.errors.tier.message}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {mode === "add" ? (
              <>
                <Plus className="h-4 w-4" aria-hidden /> Add
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
