"use client";

import { useEffect, useId, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { getConvexErrorMessage } from "@/lib/convex-error";

const createSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80, "At most 80 characters"),
  year: z.coerce
    .number({ invalid_type_error: "Year must be a number" })
    .int("Year must be a whole number")
    .min(2024, "Year must be 2024 or later")
    .max(2100, "Year must be 2100 or earlier"),
});
type CreateFormValues = z.infer<typeof createSchema>;

export function CreateCycleModal({
  open,
  onClose,
  existingYears,
}: {
  open: boolean;
  onClose: () => void;
  existingYears: number[];
}) {
  const createElection = useMutation(api.elections.create);
  const nameId = useId();
  const yearId = useId();
  const nameErrId = useId();
  const yearErrId = useId();

  const schema = useMemo(
    () =>
      createSchema.superRefine((values, ctx) => {
        if (existingYears.includes(values.year)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["year"],
            message: `AGM ${values.year} already has a cycle. Delete it from Setup first if you want to recreate.`,
          });
        }
      }),
    [existingYears],
  );

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", year: new Date().getFullYear() },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: "", year: new Date().getFullYear() });
    }
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createElection(values);
      toast.success("Cycle created", {
        description: `${values.name} (AGM ${values.year}) is now in Setup.`,
      });
      onClose();
    } catch (err) {
      toast.error("Create failed", {
        description: getConvexErrorMessage(err, "Could not create cycle."),
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!form.formState.isSubmitting) onClose();
      }}
      title="New election cycle"
      description={
        <>
          Starts in <strong className="font-semibold">Setup</strong> phase
          with default weights (30% TC, 20% HE, 10% Y2, 40% Public) and the
          standard 5-criterion rubric. Both can be edited before opening
          internal evaluation.
        </>
      }
      size="md"
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Cycle name</Label>
          <Input
            id={nameId}
            placeholder="USM CSS AGM 2026"
            aria-required="true"
            aria-invalid={form.formState.errors.name ? "true" : undefined}
            aria-describedby={
              form.formState.errors.name ? nameErrId : undefined
            }
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
        <div className="grid gap-1.5">
          <Label htmlFor={yearId}>AGM year</Label>
          <Input
            id={yearId}
            type="number"
            min={2024}
            max={2100}
            step={1}
            aria-required="true"
            aria-invalid={form.formState.errors.year ? "true" : undefined}
            aria-describedby={
              form.formState.errors.year ? yearErrId : undefined
            }
            {...form.register("year")}
          />
          {form.formState.errors.year ? (
            <p
              id={yearErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {form.formState.errors.year.message}
            </p>
          ) : null}
        </div>
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
            <CalendarPlus className="h-4 w-4" aria-hidden /> Create cycle
          </Button>
        </div>
      </form>
    </Modal>
  );
}
