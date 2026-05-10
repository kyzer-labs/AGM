"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getConvexErrorMessage } from "@/lib/convex-error";

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(120, "Full name cannot exceed 120 characters."),
  matric: z
    .string()
    .trim()
    .min(6, "Matric number must be at least 6 characters.")
    .max(20, "Matric number cannot exceed 20 characters."),
  yearOfStudy: z.coerce
    .number()
    .int()
    .min(1, "Pick a year between 1 and 6.")
    .max(6, "Pick a year between 1 and 6."),
});

type FormValues = z.infer<typeof schema>;

export default function ProfileCompletePage() {
  const router = useRouter();
  const me = useQuery(api.voters.me);
  const completeProfile = useMutation(api.voters.completeProfile);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      matric: "",
      yearOfStudy: 1,
    },
  });

  useEffect(() => {
    if (me?.profileComplete) {
      router.replace("/dashboard");
    }
  }, [me, router]);

  useEffect(() => {
    if (me) {
      form.reset({
        fullName: me.fullName ?? "",
        matric: me.matric ?? "",
        yearOfStudy: me.yearOfStudy ?? 1,
      });
    }
  }, [me, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await completeProfile(values);
      toast.success("Profile saved");
      router.replace("/dashboard");
    } catch (err) {
      const message = getConvexErrorMessage(
        err,
        "Could not save your profile. Try again, or contact the AGM admin team if it keeps happening.",
      );
      toast.error("Save failed", { description: message });
    }
  });

  if (me === undefined) {
    return (
      <main className="container-narrow space-y-6 py-16 sm:py-20">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-3 w-2/3" />
        <div className="space-y-5 pt-8">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </main>
    );
  }

  const errs = form.formState.errors;

  return (
    <main className="container-narrow py-16 sm:py-20">
      <header className="space-y-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-[var(--ink-muted)]">
          01 · Voter profile
        </p>
        <h1 className="text-3xl font-medium leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-4xl">
          Complete your voter profile
        </h1>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          Recorded once per AGM cycle. Your name and matric number become the
          audit identity used to print the official voters list and to match
          against the internal evaluator whitelist. Your USM student email is
          read from sign-in and is the only identifier the system trusts.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mt-12 grid gap-8"
        aria-describedby="profile-form-help"
      >
        <Field
          fieldId="email"
          label="USM student email"
          hint="Read from your sign-in. Contact the AGM admin team if this is wrong."
        >
          <Input
            id="email"
            value={me?.email ?? ""}
            readOnly
            disabled
            autoComplete="email"
          />
        </Field>

        <Field
          fieldId="fullName"
          label="Full name"
          hint="Use your name exactly as it appears on your matric card."
          required
          error={errs.fullName?.message}
          errorId="fullName-error"
        >
          <Input
            id="fullName"
            autoComplete="name"
            aria-required
            aria-invalid={errs.fullName ? true : undefined}
            aria-describedby={errs.fullName ? "fullName-error" : undefined}
            {...form.register("fullName")}
          />
        </Field>

        <Field
          fieldId="matric"
          label="Matric number"
          hint="As shown on your USM matric card."
          required
          error={errs.matric?.message}
          errorId="matric-error"
        >
          <Input
            id="matric"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            aria-required
            aria-invalid={errs.matric ? true : undefined}
            aria-describedby={errs.matric ? "matric-error" : undefined}
            {...form.register("matric")}
          />
        </Field>

        <Field
          fieldId="yearOfStudy"
          label="Year of study"
          hint="Used by admins to verify your membership tier."
          required
          error={errs.yearOfStudy?.message}
          errorId="yearOfStudy-error"
        >
          <Select
            id="yearOfStudy"
            aria-required
            aria-invalid={errs.yearOfStudy ? true : undefined}
            aria-describedby={
              errs.yearOfStudy ? "yearOfStudy-error" : undefined
            }
            {...form.register("yearOfStudy")}
          >
            {[1, 2, 3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-col gap-4 border-t border-[var(--ink-line)] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p
            id="profile-form-help"
            className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-muted)]"
          >
            Save once. Routes you to the surface for the current AGM phase.
          </p>
          <Button
            type="submit"
            loading={form.formState.isSubmitting}
            size="lg"
          >
            Save profile
          </Button>
        </div>
      </form>
    </main>
  );
}

interface FieldProps {
  fieldId: string;
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  errorId?: string;
  children: ReactNode;
}

function Field({
  fieldId,
  label,
  hint,
  required,
  error,
  errorId,
  children,
}: FieldProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={fieldId} className="text-sm">
          {label}
        </Label>
        {required ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Required
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            Read only
          </span>
        )}
      </div>
      {children}
      {hint ? (
        <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-[var(--color-destructive)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
