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

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
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
