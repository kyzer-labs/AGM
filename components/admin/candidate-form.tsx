"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Link as LinkIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { CandidatePhoto } from "@/components/candidate-photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getConvexErrorMessage } from "@/lib/convex-error";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const ALLOWED_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const candidateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(120, "At most 120 characters"),
  photoUrl: z
    .string()
    .trim()
    .max(500, "URL is too long")
    .optional()
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      "Photo link must start with http:// or https://",
    ),
});
export type CandidateFormValues = z.infer<typeof candidateSchema>;

function normaliseCandidatePhotoPreview(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === "drive.google.com") {
      const fileMatch = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/);
      const id =
        fileMatch?.[1] ??
        (["/open", "/uc", "/thumbnail"].includes(url.pathname)
          ? url.searchParams.get("id")
          : null);
      if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export interface PositionAssignment {
  positionId: Id<"positions">;
  fallbackOrder: number;
}

interface CandidateFormProps {
  electionId: Id<"elections">;
  positions: Doc<"positions">[];
  initial?: {
    candidateId: Id<"candidates">;
    fullName: string;
    photoStorageId: Id<"_storage"> | null;
    photoLinkUrl: string | null;
    photoUrl: string | null;
    assignments: PositionAssignment[];
  };
  onSaved: () => void;
  onCancel?: () => void;
}

export function CandidateForm({
  electionId,
  positions,
  initial,
  onSaved,
  onCancel,
}: CandidateFormProps) {
  const isEdit = initial !== undefined;
  const generateUploadUrl = useMutation(api.candidates.generatePhotoUploadUrl);
  const addCandidate = useMutation(api.candidates.add);
  const updateCandidate = useMutation(api.candidates.update);
  const setAssignments = useMutation(api.candidates.setPositionAssignments);

  const fullNameId = useId();
  const photoUrlId = useId();
  const fullNameErrId = useId();
  const photoUrlErrId = useId();
  const photoHintId = useId();
  const positionsListId = useId();
  const positionsErrId = useId();

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      fullName: initial?.fullName ?? "",
      photoUrl: initial?.photoLinkUrl ?? "",
    },
  });

  const [orderedPositionIds, setOrderedPositionIds] = useState<
    Id<"positions">[]
  >(
    initial?.assignments
      .slice()
      .sort((a, b) => a.fallbackOrder - b.fallbackOrder)
      .map((a) => a.positionId) ?? [],
  );
  const [positionsError, setPositionsError] = useState<string | null>(null);

  const [photoStorageId, setPhotoStorageId] = useState<Id<"_storage"> | null>(
    initial?.photoStorageId ?? null,
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initial?.photoUrl ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const positionsById = new Map<Id<"positions">, Doc<"positions">>();
  for (const p of positions) positionsById.set(p._id, p);

  const availablePositions = positions
    .filter((p) => !orderedPositionIds.includes(p._id))
    .sort((a, b) => a.tier - b.tier || a.order - b.order);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_PHOTO_MIME_TYPES.has(file.type)) {
      toast.error("Photo format not supported", {
        description:
          "Use JPG, PNG, GIF, or WebP. SVG, HEIC, and other formats are not supported.",
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      toast.error("Photo is too large", {
        description: `Selected file is ${sizeMb} MB. Maximum is 4 MB.`,
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({ electionId });
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) {
        throw new Error(
          `Convex Storage rejected the upload (HTTP ${res.status}).`,
        );
      }
      const json = (await res.json()) as { storageId: Id<"_storage"> };
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
      setPhotoStorageId(json.storageId);
      setPhotoPreview(URL.createObjectURL(file));
      form.setValue("photoUrl", "", { shouldValidate: true });
    } catch (err) {
      const m = getConvexErrorMessage(err, "Upload failed.");
      toast.error("Upload failed", { description: m });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const togglePosition = (id: Id<"positions">) => {
    setOrderedPositionIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((p) => p !== id)
        : [...prev, id];
      if (next.length > 0) setPositionsError(null);
      return next;
    });
  };

  const movePosition = (idx: number, direction: "up" | "down") => {
    setOrderedPositionIds((prev) => {
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const a = next[idx];
      const b = next[target];
      if (a === undefined || b === undefined) return prev;
      next[idx] = b;
      next[target] = a;
      return next;
    });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (orderedPositionIds.length === 0) {
      setPositionsError(
        "Pick at least one contending position before saving.",
      );
      return;
    }
    setPositionsError(null);
    setSubmitting(true);
    try {
      let candidateId = initial?.candidateId;
      const photoUrlInput = values.photoUrl?.trim() ?? "";
      const usingUpload = photoStorageId !== null;
      const usingLink = !usingUpload && photoUrlInput.length > 0;

      if (isEdit && candidateId) {
        await updateCandidate({
          candidateId,
          fullName: values.fullName,
          photoStorageId: usingUpload
            ? (photoStorageId ?? undefined)
            : undefined,
          photoUrl: usingLink ? photoUrlInput : "",
          clearPhoto: !usingUpload && !usingLink,
        });
      } else {
        candidateId = await addCandidate({
          electionId,
          fullName: values.fullName,
          photoStorageId: usingUpload
            ? (photoStorageId ?? undefined)
            : undefined,
          photoUrl: usingLink ? photoUrlInput : undefined,
          positionAssignments: orderedPositionIds.map((positionId, i) => ({
            positionId,
            fallbackOrder: i,
          })),
        });
      }

      if (isEdit && candidateId) {
        await setAssignments({
          candidateId,
          assignments: orderedPositionIds.map((positionId, i) => ({
            positionId,
            fallbackOrder: i,
          })),
        });
      }

      toast.success(isEdit ? "Candidate updated" : "Candidate added");
      onSaved();
    } catch (err) {
      const m = getConvexErrorMessage(err, "Save failed.");
      toast.error("Save failed", { description: m });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-[120px_1fr]">
        <div>
          <Label className="mb-1.5 block">Photo</Label>
          <div
            className={cn(
              "grid aspect-square w-30 place-items-center overflow-hidden rounded-lg border bg-[var(--color-muted)]",
            )}
          >
            {photoPreview ? (
              <CandidatePhoto
                src={photoPreview}
                className="h-full w-full object-cover"
                iconClassName="h-6 w-6"
              />
            ) : (
              <ImagePlus
                className="h-6 w-6 text-[var(--color-muted-foreground)]"
                aria-hidden
              />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={onPickFile}
              aria-hidden="true"
              tabIndex={-1}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
              aria-describedby={photoHintId}
            >
              {photoStorageId ? "Replace" : "Upload"}
            </Button>
            {photoStorageId || photoPreview ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPhotoStorageId(null);
                  if (photoPreview && photoPreview.startsWith("blob:")) {
                    URL.revokeObjectURL(photoPreview);
                  }
                  setPhotoPreview(null);
                  form.setValue("photoUrl", "", { shouldValidate: true });
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <p
            id={photoHintId}
            className="mt-2 text-[11px] text-[var(--color-muted-foreground)]"
          >
            JPG, PNG, GIF, or WebP. Max 4 MB.
          </p>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={fullNameId}>Full name</Label>
            <Input
              id={fullNameId}
              aria-required="true"
              aria-invalid={
                form.formState.errors.fullName ? "true" : undefined
              }
              aria-describedby={
                form.formState.errors.fullName ? fullNameErrId : undefined
              }
              autoComplete="off"
              autoFocus
              {...form.register("fullName")}
            />
            {form.formState.errors.fullName ? (
              <p
                id={fullNameErrId}
                role="alert"
                className="text-xs text-[var(--color-destructive)]"
              >
                {form.formState.errors.fullName.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor={photoUrlId}
              className="flex items-center gap-1.5"
            >
              <LinkIcon className="h-3.5 w-3.5" aria-hidden /> Or paste a
              photo link
            </Label>
            <Input
              id={photoUrlId}
              type="url"
              placeholder="https://drive.google.com/file/d/..."
              aria-invalid={
                form.formState.errors.photoUrl ? "true" : undefined
              }
              aria-describedby={
                form.formState.errors.photoUrl ? photoUrlErrId : undefined
              }
              autoComplete="off"
              {...form.register("photoUrl")}
              onChange={(e) => {
                form.setValue("photoUrl", e.target.value, {
                  shouldValidate: true,
                });
                if (e.target.value && photoStorageId) {
                  setPhotoStorageId(null);
                }
                if (!photoStorageId) {
                  setPhotoPreview(
                    e.target.value
                      ? normaliseCandidatePhotoPreview(e.target.value)
                      : null,
                  );
                }
              }}
            />
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              Google Drive share links are auto-converted. Otherwise paste a
              direct image URL.
            </p>
            {form.formState.errors.photoUrl ? (
              <p
                id={photoUrlErrId}
                role="alert"
                className="text-xs text-[var(--color-destructive)]"
              >
                {form.formState.errors.photoUrl.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <Label htmlFor={positionsListId}>
          Contending positions (in order of preference)
        </Label>
        <div
          id={positionsListId}
          className="rounded-md border p-3"
          aria-describedby={positionsError ? positionsErrId : undefined}
          aria-invalid={positionsError ? "true" : undefined}
        >
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            Top of the list is the candidate&apos;s first choice. If they
            win that, they are removed from the lower-preference ballots.
            If they lose, they remain on the next one.
          </p>
          {orderedPositionIds.length === 0 ? (
            <p className="rounded border border-dashed p-3 text-xs text-[var(--color-muted-foreground)]">
              No positions selected yet. Pick from the list below.
            </p>
          ) : (
            <ol className="divide-y">
              {orderedPositionIds.map((id, idx) => {
                const p = positionsById.get(id);
                if (!p) return null;
                return (
                  <li key={id} className="flex items-center gap-2 py-2">
                    <span
                      className="grid h-6 w-6 place-items-center rounded-md bg-[var(--color-secondary)] font-mono text-xs tabular-nums"
                      aria-hidden
                    >
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm">{p.name}</span>
                    <Badge tone="muted" className="text-[10px]">
                      Tier {p.tier}
                    </Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={idx === 0}
                      onClick={() => movePosition(idx, "up")}
                      aria-label={`Move ${p.name} up in preference`}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={idx === orderedPositionIds.length - 1}
                      onClick={() => movePosition(idx, "down")}
                      aria-label={`Move ${p.name} down in preference`}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => togglePosition(id)}
                      aria-label={`Remove ${p.name} from preferences`}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}

          {availablePositions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {availablePositions.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => togglePosition(p._id)}
                  className="rounded-full border px-3 py-1 text-xs hover:bg-[var(--color-muted)]"
                  aria-label={`Add ${p.name} to preferences`}
                >
                  + {p.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {positionsError ? (
          <p
            id={positionsErrId}
            role="alert"
            className="text-xs text-[var(--color-destructive)]"
          >
            {positionsError}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={submitting}>
          {isEdit ? "Save changes" : "Add candidate"}
        </Button>
      </div>
    </form>
  );
}
