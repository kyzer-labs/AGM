"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type DialogSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  labelledBy: string;
  describedBy?: string;
  size?: DialogSize;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function DialogShell({
  open,
  onClose,
  children,
  initialFocusRef,
  labelledBy,
  describedBy,
  size = "md",
}: DialogShellProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      setVisible(true);
      const target = initialFocusRef?.current ?? contentRef.current;
      if (target) {
        if (target instanceof HTMLElement) {
          target.focus({ preventScroll: true });
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, initialFocusRef]);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const root = contentRef.current;
        if (!root) return;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter(
          (el) => !el.hasAttribute("data-dialog-skip-focus") && el.offsetParent !== null,
        );
        if (focusables.length === 0) {
          event.preventDefault();
          root.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey) {
          if (active === first || !root.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open, onClose]);

  React.useEffect(() => {
    if (open) return;
    setVisible(false);
    const previous = previousFocusRef.current;
    if (previous && document.contains(previous)) {
      previous.focus({ preventScroll: true });
    }
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center p-4",
        "bg-black/40 backdrop-blur-sm transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn(
          "w-full rounded-xl border bg-[var(--color-card)] text-[var(--color-card-foreground)] shadow-xl",
          "max-h-[calc(100vh-2rem)] overflow-y-auto",
          SIZE_CLASS[size],
          "transition-all duration-150 outline-none",
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0",
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-1.5 p-6 pb-3", className)}>{children}</div>;
}

export function DialogTitle({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 id={id} className={cn("text-lg font-semibold leading-tight", className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      className={cn("text-sm text-[var(--color-muted-foreground)]", className)}
    >
      {children}
    </div>
  );
}

export function DialogBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-6 pb-4 pt-1", className)}>{children}</div>;
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-[var(--color-border)] p-4 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
