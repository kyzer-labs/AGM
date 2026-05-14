import { Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  VOTER_CLASS_LABEL,
  VOTER_CLASS_TONE,
  type VoterClass,
} from "./whitelist-model";

export function VoterClassBadge({ voterClass }: { voterClass: VoterClass }) {
  return (
    <Badge tone={VOTER_CLASS_TONE[voterClass]}>
      <Circle className="h-2.5 w-2.5 fill-current" aria-hidden />
      {VOTER_CLASS_LABEL[voterClass]}
    </Badge>
  );
}
