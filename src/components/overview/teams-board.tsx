"use client";

import type { Castaway, LeagueState, Player } from "@/lib/game/types";
import { useMyPlayerId } from "@/lib/store";
import { medalFor, MEDAL_EMOJI } from "@/lib/game/selectors";
import { cn } from "cn";
import { Chip, CastByTribe } from "./starters-board";

// Classic Draft's Board, in the shape of Active Roster's StartersBoard: every player's team as a row
// of photos, then the whole cast as compact chips by tribe. Classic has no lineups -- the team IS the
// draft -- so a row is the roster: still in first, then the ones who are out, most recent first, each
// with where they finished (that's this type's score) in the corner the way BoardGrid's cards show it.
// Replaces BoardGrid's full cards here; Your Team says the same for one player, so it's left to the
// commissioner's Customize panel whether both show.
export function TeamsBoard({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const players = state.players.filter((p) => p.active !== false);
  return (
    <div id="board" className="section-shell">
      <h3 className="mb-0.5 section-title">Teams</h3>
      <p className="mb-3 text-xs text-muted-foreground">Everyone&rsquo;s draft. The number is where each one finished.</p>
      <div className="flex flex-col divide-y divide-border">
        {players.map((p) => (
          <TeamRow key={p.id} state={state} player={p} isMe={p.id === myPlayerId} />
        ))}
      </div>
      <CastByTribe state={state} />
    </div>
  );
}

function TeamRow({ state, player, isMe }: { state: LeagueState; player: Player; isMe: boolean }) {
  const roster = state.castaways.filter((c) => c.ownerIds.includes(player.id));
  const inGame = roster.filter((c) => c.status !== "eliminated").sort((a, b) => a.name.localeCompare(b.name));
  // Swapped or replenished off this team (Mid-Season): the right-hand side, like Starters' bench.
  const dropped = state.castaways.filter((c) => c.formerOwnerId === player.id && !c.ownerIds.includes(player.id));
  const out = roster.filter((c) => c.status === "eliminated").sort((a, b) => (b.placementOrder ?? 0) - (a.placementOrder ?? 0));
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: player.color }} />
        <span className={cn("min-w-0 flex-1 truncate text-sm font-bold", isMe && "underline decoration-2 underline-offset-2")}>
          {player.name}
        </span>
        {roster.length > 0 && (
          <span className="shrink-0 text-[0.7rem] font-semibold text-muted-foreground">
            {inGame.length} of {roster.length} left
          </span>
        )}
      </div>
      {roster.length === 0 ? (
        <p className="text-xs text-muted-foreground">No one drafted.</p>
      ) : (
        // The team left, anyone dropped right; on a narrow screen the dropped wrap under, still
        // right-aligned (StartersBoard's starters/bench layout).
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1.5">
            {inGame.map((c) => (
              <Chip key={c.id} state={state} castaway={c} ring={player.color} />
            ))}
            {out.map((c) => (
              <OutChip key={c.id} state={state} castaway={c} ring={player.color} />
            ))}
          </div>
          {dropped.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
              <span className="mr-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">Dropped</span>
              {dropped.map((c) => (
                <span key={c.id} title={`${c.name} — ${c.departedVia === "trade" ? "swapped away" : "replenished away"}`}>
                  <Chip state={state} castaway={c} small />
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Out: faded, with the boot-order number -- except a podium finish, which keeps full colour and gets
// its medal (BoardGrid's cards do the same).
function OutChip({ state, castaway: c, ring }: { state: LeagueState; castaway: Castaway; ring: string }) {
  const medal = medalFor(state, c.placementOrder);
  return medal ? (
    <Chip state={state} castaway={c} ring={ring} points={MEDAL_EMOJI[medal]} badgeTone="medal" dim={false} />
  ) : (
    <Chip state={state} castaway={c} ring={ring} points={c.placementOrder ?? undefined} badgeTone="out" />
  );
}
