import { CalendarPlus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";

export function NoElection() {
  return (
    <main className="container-narrow py-12">
      <EmptyState
        icon={<CalendarPlus className="h-5 w-5" aria-hidden />}
        title="No election cycle yet"
        description="Create the AGM election cycle first. Positions, candidates, and the internal whitelist all attach to a cycle."
        action={
          <LinkButton href="/admin/election">Go to Election cycle</LinkButton>
        }
      />
    </main>
  );
}
