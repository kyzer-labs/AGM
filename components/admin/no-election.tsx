import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function NoElection() {
  return (
    <main className="container-narrow py-12">
      <EmptyState
        icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
        title="No election cycle yet"
        description="Create the AGM election cycle first. Positions, candidates, and the internal whitelist all attach to a cycle."
        action={
          <Link href="/admin/election">
            <Button>Go to Election cycle</Button>
          </Link>
        }
      />
    </main>
  );
}
