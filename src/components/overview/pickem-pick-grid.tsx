"use client";

import type { Episode, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { XMarkIcon } from "@/components/icons";
import { useShowTerms } from "@/lib/use-show-terms";
import { cn } from "cn";
import { RevealFirst, useHiddenResults } from "@/components/results-in-banner";
import { Chip } from "./starters-board";

// Pick'em: YOUR pick for the upcoming episode, plus (above it) who ELSE in the league has picked --
// a nudge for stragglers, without giving away what they picked. Everyone's full pick history lives
// on the Episodes tab; this is the one thing each player does every week, so it sits on Overview.
//
// Status rows: a grey "?" square once someone's locked in a pick (hidden -- the point is knowing
// WHO'S set, not what they went with, same trust model as Active Roster's hideStartersUntilLock),
// an empty dashed square if they haven't, revealed as the actual pick once the episode airs or its
// eliminations are logged -- matching the lock PickEmLogic.setPick itself enforces.
//
// Each card in the pick-it grid below is one of:
//   your pick     -- highlighted
//   available     -- tap to pick
//   used          -- grayed, with the episode you picked them in: already picked this cycle (no one
//                    twice until you've picked everyone still in the game), or last time (never back
//                    to back). See PickEmLogic.eligibility for both rules.
//   eliminated    -- a big X
// Grouped by current tribe (biggest group first, same ordering as BoardGrid/CastByTribe) so a long
// cast is easier to scan than one flat grid.
export function PickEmPickGrid({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const myPlayerId = useMyPlayerId();
  const { hidden: hiddenResults } = useHiddenResults();
  const mutate = useMutate();

  if (!myPlayerId) return null;
  if (hiddenResults.length > 0) {
    // Still show the picks for the first unrevealed episode -- locked before it aired, so nothing in
    // them gives a result away, and otherwise you'd have no idea who you went with.
    const lockedEp = hiddenResults[0];
    return (
      <>
        <RevealFirst what="make your next pick" />
        <div className="mb-5 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
            Picks for episode {lockedEp.number}
          </h3>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {state.players
              .filter((p) => p.active !== false)
              .map((p) => (
                <PickStatusRow key={p.id} state={state} player={p} isMe={p.id === myPlayerId} ep={lockedEp} open={false} />
              ))}
          </div>
        </div>
      </>
    );
  }
  const ep = StateLogic.pickEmUpcomingEpisode(state);
  const history = StateLogic.pickEmHistory(state, myPlayerId);
  const aired = !!ep && !!ep.airsAt && Date.now() >= Date.parse(ep.airsAt);
  const decided = !!ep && ep.events.length > 0;
  const closed = !ep || decided;
  const open = !!ep && !aired && !decided;
  const eligibility = ep ? StateLogic.pickEmEligibility(state, ep.id, myPlayerId) : { available: [], blocked: {} };
  const myPick = ep ? StateLogic.pickEmPickFor(state, ep.id, myPlayerId) : null;
  const players = state.players.filter((p) => p.active !== false);

  async function pick(castawayId: string) {
    if (!ep || closed || !myPlayerId) return;
    await mutate(
      (s) => StateLogic.setPickEmPick(s, ep.id, myPlayerId, castawayId),
      () => api.setPickEmPick(leagueId!, ep.id, myPlayerId, castawayId)
    );
  }

  const groups = [{ id: null as string | null, name: "Unassigned", color: "#4a5245" }, ...state.tribes]
    .map((g) => ({ g, members: state.castaways.filter((c) => (c.tribeId || null) === g.id) }))
    .filter((x) => x.members.length > 0)
    .sort((a, b) => b.members.length - a.members.length);

  return (
    <div id="pickem-grid" className="mb-5 scroll-mt-20 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
          {ep ? `Your pick for episode ${ep.number}` : "Your pick"}
        </h3>
        <span className="ml-auto text-xs text-muted-foreground">
          Streak <b className="text-foreground">{history.currentStreak}</b> · Longest{" "}
          <b className="text-foreground">{history.longestStreak}</b> · {history.total} pts
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {!ep
          ? "There's no episode to pick for yet."
          : closed
          ? "Picks are closed — this episode's results are in."
          : myPick
            ? `Picked ${StateLogic.getCastaway(state, myPick.castawayId)?.name ?? "?"} to survive. Tap another to change it.`
            : `Pick a ${terms.castaway} you think survives this episode. No repeats until you've picked everyone still in, and never the same one twice in a row.`}
      </p>
      {ep && (
        <div className="mb-4 flex flex-col divide-y divide-border rounded-lg border border-border">
          {players.map((p) => (
            <PickStatusRow key={p.id} state={state} player={p} isMe={p.id === myPlayerId} ep={ep} open={open} />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-4">
        {groups.map(({ g, members }) => (
          <div key={g.id ?? "unassigned"}>
            {state.tribes.length > 0 && (
              <h4 className="mb-2 text-[0.65rem] font-bold uppercase tracking-wide" style={{ color: g.color }}>
                {g.name}
              </h4>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2.5">
              {members.map((c) => {
                const out = c.status === "eliminated";
                const mine = myPick?.castawayId === c.id;
                const used = eligibility.blocked[c.id];
                const canPick = !closed && !out && !mine && eligibility.available.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!canPick}
                    onClick={() => pick(c.id)}
                    title={
                      out
                        ? `${c.name} is out`
                        : used
                          ? used.reason === "backToBack"
                            ? `Your last pick (episode ${used.episode}) -- not twice in a row`
                            : `Already picked this cycle (episode ${used.episode})`
                          : undefined
                    }
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-lg border-2 bg-card p-2 text-center transition-colors",
                      mine ? "border-primary bg-primary/5" : "border-border",
                      canPick && "cursor-pointer hover:border-primary",
                      (used || out) && !mine && "opacity-45"
                    )}
                  >
                    <div className="relative h-11 w-11">
                      <CastawayAvatar
                        castaway={c}
                        className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-xs font-bold"
                      />
                      {out && (
                        <div
                          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/10"
                          aria-hidden
                        >
                          <XMarkIcon className="h-7 w-7 text-destructive drop-shadow-[0_1px_2px_rgba(0,0,0,.4)]" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium leading-tight">{c.name}</span>
                    {mine && (
                      <span className="rounded bg-primary px-1.5 py-px text-[0.6rem] font-bold text-primary-foreground">Your pick</span>
                    )}
                    {used && !out && !mine && (
                      <span className="rounded bg-muted-foreground px-1.5 py-px text-[0.6rem] font-bold text-white">
                        Ep. {used.episode}
                        {used.reason === "backToBack" ? " · last" : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PickStatusRow({
  state,
  player,
  isMe,
  ep,
  open,
}: {
  state: LeagueState;
  player: Player;
  isMe: boolean;
  ep: Episode;
  open: boolean;
}) {
  const pk = StateLogic.pickEmPickFor(state, ep.id, player.id);
  const castaway = pk ? StateLogic.getCastaway(state, pk.castawayId) : null;
  const set = !!pk;
  const hidden = open && !isMe;

  return (
    <div className="flex items-center gap-3 px-3 py-2 first:pt-2.5 last:pb-2.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: player.color }} />
      <span className={cn("min-w-0 flex-1 truncate text-sm font-bold", isMe && "underline decoration-2 underline-offset-2")}>
        {player.name}
      </span>
      <span className={cn("shrink-0 text-[0.7rem] font-semibold", set ? "text-good" : "text-amber-600")}>
        {set ? "Set ✓" : "Not set"}
      </span>
      {hidden ? (
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 font-bold text-muted-foreground",
            set ? "border-border bg-muted" : "border-dashed border-border"
          )}
          title={set ? "Hidden until the episode airs" : "Hasn't picked yet"}
        >
          {set ? "?" : ""}
        </div>
      ) : castaway ? (
        <Chip state={state} castaway={castaway} ring={player.color} large />
      ) : (
        <div className="h-14 w-14 shrink-0 rounded-lg border-2 border-dashed border-border" title="No pick" />
      )}
    </div>
  );
}
