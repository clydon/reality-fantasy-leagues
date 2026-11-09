import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/server/auth-helpers";
import { GamePageScreen } from "@/new/show/game-page";

export const metadata: Metadata = { title: "Game" };

// A game's own page (docs/PLAN-start-a-game-gpt.md U1), over the show: generated from the game's spec (src/lib/game/game-page/).
export default async function GamePage({ params }: PageProps<"/show/[seasonId]/game/[leagueId]">) {
  const { seasonId, leagueId } = await params;
  if (!isUuid(seasonId) || !isUuid(leagueId)) notFound();
  return <GamePageScreen seasonId={seasonId} leagueId={leagueId} />;
}
