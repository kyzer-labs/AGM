"use client";

import * as React from "react";
import { X } from "lucide-react";

import {
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogShell,
  DialogTitle,
  type DialogSize,
} from "@/components/dialog/dialog";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: DialogSize;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  hideCloseButton?: boolean;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

let modalIdCounter = 0;
function useModalIds() {
  const id = React.useMemo(() => ++modalIdCounter, []);
  return {
    titleId: `modal-${id}-title`,
    descId: `modal-${id}-desc`,
  };
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "lg",
  initialFocusRef,
  hideCloseButton,
  children,
  className,
  bodyClassName,
}: ModalProps) {
  const { titleId, descId } = useModalIds();
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      size={size}
      initialFocusRef={initialFocusRef}
    >
      <div className={cn("relative", className)}>
        {!hideCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <DialogHeader className="pr-12">
          <DialogTitle id={titleId}>{title}</DialogTitle>
          {description ? (
            <DialogDescription id={descId}>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogBody className={bodyClassName}>{children}</DialogBody>
      </div>
    </DialogShell>
  );
}

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-4 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
