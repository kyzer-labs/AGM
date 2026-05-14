import type { Metadata } from "next";
import { MeetingGuide } from "./_components/meeting-guide";

export const metadata: Metadata = {
  title: "AGM Meeting Deck | USM CSS AGM Election",
  description:
    "Presentation deck for explaining the AGM election portal, voter flows, admin flow, and meeting decisions.",
};

export default function GuidePage() {
  return <MeetingGuide />;
}
