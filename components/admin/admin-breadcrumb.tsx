import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminBreadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="text-sm text-[var(--color-muted-foreground)]">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/admin" className="hover:text-[var(--color-foreground)]">
            Admin
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" aria-hidden />
            {item.href ? (
              <Link
                href={item.href}
                className={cn(
                  "hover:text-[var(--color-foreground)]",
                  i === items.length - 1 && "text-[var(--color-foreground)]",
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  i === items.length - 1 && "text-[var(--color-foreground)]",
                )}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
