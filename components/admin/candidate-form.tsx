"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, ImagePlus, Link as LinkIcon, X } from "lucide-react";
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
      (v) => !v || /^https?:\/\//i.test(v) || isDrivePhotoProxyUrl(v),
      "Photo link must start with http://, https://, or the saved Drive photo path",
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
      if (id) return `/api/drive-photo?id=${id}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

function isDrivePhotoProxyUrl(input: string): boolean {
  try {
    const url = new URL(input, "https://agm.local");
    return (
      url.origin === "https://agm.local" &&
      url.pathname === "/api/drive-photo" &&
      /^[a-zA-Z0-9_-]{10,}$/.test(url.searchParams.get("id") ?? "")
    );
  } catch {
    return false;
  }
}

export interface PositionAssignment {
  positionId: Id<"positions">;
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

  const [selectedPositionIds, setSelectedPositionIds] = useState<
    Id<"positions">[]
  >(initial?.assignments.map((a) => a.positionId) ?? []);
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

  const orderedPositions = positions
    .slice()
    .sort(
      (a, b) =>
        a.tier - b.tier || a.order - b.order || a.name.localeCompare(b.name),
    );
  const selectedPositionSet = new Set(selectedPositionIds);

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
    setSelectedPositionIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((p) => p !== id)
        : [...prev, id];
      if (next.length > 0) setPositionsError(null);
      return next;
    });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (selectedPositionIds.length === 0) {
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
          positionAssignments: selectedPositionIds.map((positionId) => ({
            positionId,
          })),
        });
      }

      if (isEdit && candidateId) {
        await setAssignments({
          candidateId,
          assignments: selectedPositionIds.map((positionId) => ({
            positionId,
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
      <div className="grid gap-5 sm:grid-cols-[176px_1fr]">
        <div>
          <Label className="mb-1.5 block">Photo</Label>
          <div
            className={cn(
              "grid aspect-[3/4] w-44 place-items-center overflow-hidden rounded-lg border bg-[var(--paper)]",
            )}
          >
            {photoPreview ? (
              <CandidatePhoto
                src={photoPreview}
                className="h-full w-full object-contain"
                iconClassName="h-6 w-6"
              />
            ) : (
              <ImagePlus
                className="h-6 w-6 text-[var(--color-muted-foreground)]"
                aria-hidden
              />
            )}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label
                htmlFor={photoUrlId}
                className="flex items-center gap-1.5"
              >
                <LinkIcon className="h-3.5 w-3.5" aria-hidden /> Or paste a
                photo link
              </Label>
              <div className="flex flex-wrap items-center gap-2">
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
            </div>
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
        <Label htmlFor={positionsListId}>Contending positions</Label>
        <div
          id={positionsListId}
          className="rounded-md border p-3"
          aria-describedby={positionsError ? positionsErrId : undefined}
          aria-invalid={positionsError ? "true" : undefined}
        >
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            Select every position this candidate is competing for. The
            precedence order is controlled on the Positions page.
          </p>
          {selectedPositionIds.length === 0 ? (
            <p className="rounded border border-dashed p-3 text-xs text-[var(--color-muted-foreground)]">
              No positions selected yet.
            </p>
          ) : (
            <ol className="divide-y">
              {orderedPositions
                .filter((p) => selectedPositionSet.has(p._id))
                .map((p, idx) => {
                  return (
                    <li key={p._id} className="flex items-center gap-2 py-2">
                      <span
                        className="grid h-6 w-6 place-items-center rounded-md bg-[var(--color-secondary)] font-mono text-xs tabular-nums"
                        aria-hidden
                      >
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm">{p.name}</span>
                      <Badge tone="muted" className="text-[0.6875rem]">
                        Tier {p.tier}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => togglePosition(p._id)}
                        aria-label={`Remove ${p.name} from contending positions`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    </li>
                  );
                })}
            </ol>
          )}

          {orderedPositions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {orderedPositions.map((p) => {
                const selected = selectedPositionSet.has(p._id);
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => togglePosition(p._id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]",
                      selected
                        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] hover:bg-[color-mix(in_oklab,var(--ink)_92%,var(--paper)_8%)]"
                        : "border-[var(--ink-line)] text-[var(--ink)] hover:bg-[var(--color-muted)]",
                    )}
                    aria-pressed={selected}
                    aria-label={`${selected ? "Remove" : "Add"} ${p.name} ${selected ? "from" : "to"} contending positions`}
                  >
                    {selected ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <span aria-hidden>+</span>
                    )}
                    {p.name}
                  </button>
                );
              })}
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
