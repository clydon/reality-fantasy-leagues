import { PlayerScorePage } from "@/components/scoreboard/player-score-page";

// One player's own Scoreboard page (docs/PLAN-ux-redesign.md, 2f), opened from their row.
export default async function PlayerPage({ params }: PageProps<"/scoreboard/[player]">) {
  const { player } = await params;
  return <PlayerScorePage playerId={decodeURIComponent(player)} />;
}
