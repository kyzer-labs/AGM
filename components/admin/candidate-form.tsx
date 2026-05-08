"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowDown, ArrowUp, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const candidateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  matric: z.string().trim().min(6).max(20),
  bio: z.string().trim().max(1000).optional(),
});
export type CandidateFormValues = z.infer<typeof candidateSchema>;

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
    matric: string;
    bio: string | null;
    photoStorageId: Id<"_storage"> | null;
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

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      fullName: initial?.fullName ?? "",
      matric: initial?.matric ?? "",
      bio: initial?.bio ?? "",
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
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image is too large (max 4 MB).");
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
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const json = (await res.json()) as { storageId: Id<"_storage"> };
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
      setPhotoStorageId(json.storageId);
      setPhotoPreview(URL.createObjectURL(file));
    } catch (err) {
      const m = err instanceof Error ? err.message : "Upload failed.";
      toast.error("Upload failed", { description: m });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const togglePosition = (id: Id<"positions">) => {
    setOrderedPositionIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
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
    setSubmitting(true);
    try {
      let candidateId = initial?.candidateId;

      if (isEdit && candidateId) {
        await updateCandidate({
          candidateId,
          fullName: values.fullName,
          matric: values.matric,
          bio: values.bio ?? "",
          photoStorageId: photoStorageId ?? undefined,
          clearPhoto: photoStorageId === null,
        });
      } else {
        candidateId = await addCandidate({
          electionId,
          fullName: values.fullName,
          matric: values.matric,
          bio: values.bio ?? undefined,
          photoStorageId: photoStorageId ?? undefined,
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
      const m = err instanceof Error ? err.message : "Save failed.";
      toast.error("Save failed", { description: m });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-[120px_1fr]">
        <div>
          <Label className="mb-1.5 block">Photo</Label>
          <div
            className={cn(
              "grid aspect-square w-30 place-items-center overflow-hidden rounded-lg border bg-[var(--color-muted)]",
            )}
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt=""
                className="h-full w-full object-cover"
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
              accept="image/*"
              className="sr-only"
              onChange={onPickFile}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {photoStorageId ? "Replace" : "Upload"}
            </Button>
            {photoStorageId ? (
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
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cand-name">Full name</Label>
            <Input id="cand-name" {...form.register("fullName")} />
            {form.formState.errors.fullName ? (
              <p className="text-xs text-[var(--color-destructive)]">
                {form.formState.errors.fullName.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cand-matric">Matric number</Label>
            <Input id="cand-matric" {...form.register("matric")} />
            {form.formState.errors.matric ? (
              <p className="text-xs text-[var(--color-destructive)]">
                {form.formState.errors.matric.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cand-bio">Short bio (optional)</Label>
            <Textarea id="cand-bio" rows={3} {...form.register("bio")} />
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <Label>Eligible positions (in order of preference)</Label>
        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
            Top of the list is the candidate&apos;s first choice. If they
            win that, they are removed from the lower-preference ballots.
            If they lose, they remain on the next one.
          </p>
          {orderedPositionIds.length === 0 ? (
            <p className="rounded border border-dashed p-3 text-xs text-[var(--color-muted-foreground)]">
              No positions selected yet.
            </p>
          ) : (
            <ul className="divide-y">
              {orderedPositionIds.map((id, idx) => {
                const p = positionsById.get(id);
                if (!p) return null;
                return (
                  <li key={id} className="flex items-center gap-2 py-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--color-secondary)] text-xs">
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
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={idx === orderedPositionIds.length - 1}
                      onClick={() => movePosition(idx, "down")}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => togglePosition(id)}
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {availablePositions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {availablePositions.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => togglePosition(p._id)}
                  className="rounded-full border px-3 py-1 text-xs hover:bg-[var(--color-muted)]"
                >
                  + {p.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
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
