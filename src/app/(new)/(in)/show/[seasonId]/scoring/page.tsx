import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/server/auth-helpers";
import { ScoringScreen } from "@/new/show/scoring";

export const metadata: Metadata = { title: "Scoring" };

// The maker's scoring (docs/PLAN-maker-scoring.md step 4): a made game's points and moments, over the show.
export default async function ScoringPage({ params }: PageProps<"/show/[seasonId]/scoring">) {
  const { seasonId } = await params;
  if (!isUuid(seasonId)) notFound();
  return <ScoringScreen seasonId={seasonId} />;
}
