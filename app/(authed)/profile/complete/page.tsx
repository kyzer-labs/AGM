"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/errors";

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name is too short")
    .max(120, "Full name is too long"),
  matric: z
    .string()
    .trim()
    .min(6, "Matric number is too short")
    .max(20, "Matric number is too long"),
  yearOfStudy: z.coerce
    .number()
    .int()
    .min(1, "Pick a valid year")
    .max(6, "Pick a valid year"),
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
      const message =
        friendlyError(err, "Could not save your profile.");
      toast.error("Save failed", { description: message });
    }
  });

  return (
    <main className="container-narrow py-12">
      <Card>
        <CardHeader>
          <CardTitle>Complete your voter profile</CardTitle>
          <CardDescription>
            We need a few details before you can take part in the internal
            evaluation or vote in the AGM. Your email is taken from your
            Microsoft sign-in and cannot be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-5">
            <div className="grid gap-1.5">
              <Label>Email (read-only)</Label>
              <Input value={me?.email ?? ""} readOnly disabled />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fullName">Full name (as in matric card)</Label>
              <Input id="fullName" {...form.register("fullName")} />
              {form.formState.errors.fullName ? (
                <p className="text-xs text-[var(--color-destructive)]">
                  {form.formState.errors.fullName.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="matric">Matric number</Label>
              <Input id="matric" {...form.register("matric")} />
              {form.formState.errors.matric ? (
                <p className="text-xs text-[var(--color-destructive)]">
                  {form.formState.errors.matric.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="yearOfStudy">Year of study</Label>
              <select
                id="yearOfStudy"
                className="flex h-10 w-full rounded-md border bg-[var(--color-background)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                {...form.register("yearOfStudy")}
              >
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
              {form.formState.errors.yearOfStudy ? (
                <p className="text-xs text-[var(--color-destructive)]">
                  {form.formState.errors.yearOfStudy.message}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                loading={form.formState.isSubmitting}
                size="lg"
              >
                Save profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
