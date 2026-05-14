import * as React from "react";

import { cn } from "@/lib/utils";

export function AdminDataTable({
  caption,
  children,
  className,
  tableClassName,
  maxHeight,
}: {
  caption: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tableClassName?: string;
  maxHeight?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-md border border-[var(--ink-line)] bg-[var(--paper)]",
        className,
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className={cn("w-full text-sm", tableClassName)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function AdminDataTableHeader({
  children,
  sticky = false,
}: {
  children: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <thead className={sticky ? "sticky top-0 z-10" : undefined}>
      {children}
    </thead>
  );
}

export function AdminDataTableRow({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--ink-line)] last:border-b-0",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function AdminDataTableHead({
  children,
  className,
  scope = "col",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cn(
        "px-3 py-2 text-left font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function AdminDataTableCell({
  children,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2 align-top", className)} {...props}>
      {children}
    </td>
  );
}

export function AdminDataTableRowHead({
  children,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="row"
      className={cn("px-3 py-2 text-left font-normal align-top", className)}
      {...props}
    >
      {children}
    </th>
  );
}
