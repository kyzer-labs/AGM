"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Id } from "@/convex/_generated/dataModel";
import {
  isPlausibleUsmEmail,
  USM_DOMAIN,
  VOTER_CLASS_LABEL,
  VOTER_CLASS_OPTIONS,
  type VoterClass,
} from "./whitelist-model";

export function AddSingleModal({
  open,
  electionId,
  onClose,
}: {
  open: boolean;
  electionId: Id<"elections">;
  onClose: () => void;
}) {
  const add = useMutation(api.whitelist.add);

  const emailId = useId();
  const classId = useId();
  const emailErrId = useId();

  const [email, setEmail] = useState("");
  const [cls, setCls] = useState<VoterClass>("year2Committee");
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setCls("year2Committee");
      setEmailError(null);
    }
  }, [open]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      setEmailError("Enter an email address.");
      return;
    }
    if (!isPlausibleUsmEmail(trimmed)) {
      setEmailError(`Email must end in ${USM_DOMAIN}.`);
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    try {
      await add({
        electionId,
        email: trimmed,
        voterClass: cls,
      });
      toast.success("Evaluator added", {
        description: `${trimmed} (${VOTER_CLASS_LABEL[cls]}).`,
      });
      onClose();
    } catch (err) {
      toast.error("Add failed", {
        description: getConvexErrorMessage(err, "Add failed."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="Add evaluator"
      description={
        <>
          The email must end in <code>{USM_DOMAIN}</code>. The evaluator
          gains access the next time they sign in.
        </>
      }
      size="md"
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor={emailId}>Student email</Label>
          <Input
            id={emailId}
            type="email"
            autoComplete="off"
            placeholder={`someone${USM_DOMAIN}`}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            aria-required="true"
            aria-invalid={emailError ? "true" : undefined}
            aria-describedby={emailError ? emailErrId : undefined}
            autoFocus
          />
          {emailError ? (
            <p
              id={emailErrId}
              role="alert"
              className="text-xs text-[var(--color-destructive)]"
            >
              {emailError}
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={classId}>Class</Label>
          <Select
            id={classId}
            value={cls}
            onChange={(e) => setCls(e.target.value as VoterClass)}
            aria-required="true"
          >
            {VOTER_CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {VOTER_CLASS_LABEL[c]}
              </option>
            ))}
          </Select>
          <p className="text-[11px] text-[var(--color-muted-foreground)]">
            The cycle&apos;s configured weight for this class applies to
            every score this evaluator submits.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            <Plus className="h-4 w-4" aria-hidden /> Add evaluator
          </Button>
        </div>
      </form>
    </Modal>
  );
}
