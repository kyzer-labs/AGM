import { Skeleton } from "@/components/ui/skeleton";

export function AdminPageSkeleton() {
  return (
    <main className="container-narrow space-y-6 py-12 sm:py-16">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-32 w-full" />
    </main>
  );
}
