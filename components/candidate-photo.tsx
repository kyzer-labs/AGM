"use client";

import { useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface CandidatePhotoProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  iconClassName?: string;
  loading?: "eager" | "lazy";
}

export function CandidatePhoto({
  src,
  alt = "",
  className,
  iconClassName,
  loading = "lazy",
}: CandidatePhotoProps) {
  const [failed, setFailed] = useState(false);
  const renderSrc = src ? normaliseCandidatePhotoSrc(src) : null;

  useEffect(() => {
    setFailed(false);
  }, [renderSrc]);

  if (renderSrc && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={renderSrc}
        alt={alt}
        className={className}
        loading={loading}
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <UserCircle2
      className={cn("text-[var(--color-muted-foreground)]", iconClassName)}
      aria-hidden
    />
  );
}

function normaliseCandidatePhotoSrc(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return trimmed;

  const driveFileId = extractDriveFileId(trimmed);
  if (driveFileId) {
    return `/api/drive-photo?id=${driveFileId}`;
  }

  return trimmed;
}

function extractDriveFileId(input: string): string | null {
  if (input.startsWith("/api/drive-photo")) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (url.hostname === "drive.google.com") {
    const fileMatch = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) return fileMatch[1];

    const id = url.searchParams.get("id");
    if (
      id &&
      (url.pathname === "/open" ||
        url.pathname === "/uc" ||
        url.pathname === "/thumbnail")
    ) {
      return id;
    }
  }

  if (url.hostname === "drive.usercontent.google.com") {
    const id = url.searchParams.get("id");
    if (id && url.pathname === "/download") return id;
  }

  if (url.hostname === "lh3.googleusercontent.com") {
    const match = url.pathname.match(/^\/d\/([a-zA-Z0-9_-]+)/);
    if (match?.[1]) return match[1];
  }

  return null;
}
