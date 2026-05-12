"use client";

import { useEffect, useId } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc } from "@/convex/_generated/dataModel";

const renameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(80, "At most 80 characters"),
});
type RenameFormValues = z.infer<typeof renameSchema>;

export function RenameModal({
  open,
  onClose,
  election,
}: {
  open: boolean;
  onClose: () => void;
  election: Doc<"elections">;
}) {
  const rename = useMutation(api.elections.rename);
  const nameId = useId();
  const errId = useId();

  const form = useForm<RenameFormValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: election.name },
  });

  useEffect(() => {
    if (open) form.reset({ name: election.name });
  }, [open, election.name, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.name === election.name) {
      onClose();
      return;
    }
    try {
      await rename({ electionId: election._id, name: values.name });
      toast.success("Renamed");
      onClose();
    } catch (err) {
      toast.error("Rename failed", {
        description: getConvexErrorMessage(err, "Rename failed."),
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!form.formState.isSubmitting) onClose();
      }}
      title="Rename cycle"
      description={
        <>
          The new name appears on every voter-facing surface that references
          this cycle.
        </>
      }
      size="md"
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Cycle name</Label>
          <Input
            id={nameId}
            aria-required="true"
            aria-invalid={form.formState.errors.name ? "true" : undefined}
            aria-describedby={
              form.formState.errors.name ? errId : undefined
            }
            autoFocus
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <p
              id={errId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {form.formState.errors.name.message}
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
            <Save className="h-4 w-4" aria-hidden /> Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
