"use client";

import { useState } from "react";
import type { Castaway, Episode, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { castawayEpisodeStats } from "@/lib/game/active-roster-rows";
import { useMyPlayerId } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { cn } from "cn";

// Active Roster's Board: who each player is starting, then the whole cast as compact chips grouped
// by current tribe. Replaces BoardGrid's full cards for this league type -- with starters being the
// thing that actually scores, "who's fielding whom" is the question the board has to answer first.
//
// Other players' starters stay hidden for the upcoming episode until the commissioner locks lineups
// (or results land), so nobody can copy a lineup before it counts. Until then the rows show the most
// recent scored episode's starters instead, plus whether each player has set this week's. This is a
// courtesy, not a secret: every lineup is in the league state the client already holds.
export function StartersBoard({ state }: { state: LeagueState }) {
  const myPlayerId = useMyPlayerId();
  const cur = StateLogic.currentEpisode(state);
  const scored = (ep: Episode) => StateLogic.ActiveRosterLogic.episodeEvents(state, ep).length > 0 || ep.events.length > 0;
  const curVisible = !!cur && (StateLogic.ActiveRosterLogic.isLineupLocked(state, cur.id) || scored(cur));
  const lastScored =
    [...state.episodes]
      .filter((ep) => StateLogic.inPlay(state, ep.number) && scored(ep))
      .sort((a, b) => b.number - a.number)[0] ?? null;
  const shown = curVisible ? cur : lastScored;
  const activeSlots = StateLogic.ActiveRosterLogic.activeSlots(state);
  const players = state.players.filter((p) => p.active !== false);

  return (
    <div id="board" className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
        {shown ? `Episode ${shown.number} starters` : "Starters"}
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {!shown
          ? cur
            ? `Yours are below; everyone else's episode ${cur.number} starters appear once lineups lock.`
            : "No episode to field a lineup for yet."
          : shown === cur
            ? "Lineups are locked."
            : cur
              ? `Last scored episode. Episode ${cur.number}'s starters appear once lineups lock.`
              : "Last scored episode."}
      </p>
      <div className="flex flex-col divide-y divide-border">
        {players.map((p) => (
          <StarterRow
            key={p.id}
            state={state}
            player={p}
            isMe={p.id === myPlayerId}
            shown={shown}
            upcoming={cur && cur !== shown ? cur : null}
            activeSlots={activeSlots}
          />
        ))}
      </div>
      <CastByTribe state={state} />
    </div>
  );
}

function StarterRow({
  state,
  player,
  isMe,
  shown,
  upcoming,
  activeSlots,
}: {
  state: LeagueState;
  player: Player;
  isMe: boolean;
  shown: Episode | null;
  upcoming: Episode | null;
  activeSlots: number;
}) {
  // Which episode this row shows. Normally the board's; before any episode has been scored there's
  // none, and then your own row shows your upcoming lineup (it's yours -- nothing to keep from you)
  // while everyone else's shows only whether they're set. Their bench is hidden too: a bench is just
  // the starters by omission.
  const rowEp = shown ?? (isMe ? upcoming : null);
  const lineupIds = rowEp ? StateLogic.activeRosterLineupFor(state, rowEp.id, player.id) : [];
  const starters = lineupIds.map((id) => StateLogic.getCastaway(state, id)).filter((c): c is Castaway => !!c);
  // The bench is "now": everyone still in the game on the roster who isn't starting in the shown episode.
  const bench = state.castaways.filter(
    (c) => c.ownerIds.includes(player.id) && c.status !== "eliminated" && !lineupIds.includes(c.id)
  );
  const upcomingSet = upcoming ? StateLogic.activeRosterLineupFor(state, upcoming.id, player.id).length : 0;
  const empty = Math.max(0, activeSlots - starters.length);
  const showPoints = !!rowEp && rowEp !== upcoming && StateLogic.ActiveRosterLogic.episodeEvents(state, rowEp).length > 0;

  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: player.color }} />
        <span className={cn("min-w-0 flex-1 truncate text-sm font-bold", isMe && "underline decoration-2 underline-offset-2")}>
          {player.name}
        </span>
        {upcoming && (
          <span
            className={cn(
              "shrink-0 text-[0.7rem] font-semibold",
              upcomingSet >= activeSlots ? "text-good" : "text-amber-600"
            )}
          >
            Ep {upcoming.number}: {upcomingSet >= activeSlots ? "set ✓" : `${upcomingSet}/${activeSlots} set`}
          </span>
        )}
      </div>
      {!rowEp ? (
        <p className="text-xs italic text-muted-foreground">Starters hidden until lineups lock.</p>
      ) : (
        // Starters left, bench right; on a narrow screen the bench wraps under, still right-aligned.
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1.5">
            {starters.map((c) => (
              <Chip
                key={c.id}
                castaway={c}
                ring={player.color}
                points={showPoints ? castawayEpisodeStats(state, rowEp.id, c.id).total : undefined}
              />
            ))}
            {Array.from({ length: empty }, (_, i) => (
              <div key={i} className="h-10 w-10 rounded-lg border-2 border-dashed border-border" title="Empty slot" />
            ))}
          </div>
          {bench.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
              <span className="mr-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">Bench</span>
              {bench.map((c) => (
                <Chip key={c.id} castaway={c} small />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ castaway: c, ring, points, small }: { castaway: Castaway; ring?: string; points?: number; small?: boolean }) {
  return (
    <div className="relative shrink-0" title={c.name}>
      <div
        className={cn("overflow-hidden rounded-lg border-2", small ? "h-7 w-7 opacity-80" : "h-10 w-10", c.status === "eliminated" && "grayscale")}
        style={{ borderColor: ring ?? "var(--border)" }}
      >
        <CastawayAvatar
          castaway={c}
          className={cn(
            "flex h-full w-full items-center justify-center bg-secondary font-mono font-bold text-muted-foreground",
            small ? "text-[0.55rem]" : "text-[0.65rem]"
          )}
        />
      </div>
      {points !== undefined && (
        <span className="absolute -bottom-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-card bg-primary px-0.5 font-mono text-[0.55rem] font-bold leading-none text-primary-foreground">
          {points}
        </span>
      )}
    </div>
  );
}

// The whole cast, compact: a small photo per castaway grouped by current tribe (biggest group first,
// same as BoardGrid), a dot per owner beneath. Tap one for its full stat card.
function CastByTribe({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = [{ id: null as string | null, name: "Unassigned", color: "#4a5245" }, ...state.tribes]
    .map((g) => ({
      g,
      members: state.castaways
        .filter((c) => (c.tribeId || null) === g.id)
        .sort(
          (a, b) =>
            Number(a.status === "eliminated") - Number(b.status === "eliminated") ||
            (a.status === "eliminated" ? (b.placementOrder ?? 0) - (a.placementOrder ?? 0) : a.name.localeCompare(b.name))
        ),
    }))
    .filter((x) => x.members.length > 0)
    .sort((a, b) => b.members.length - a.members.length);
  const open = openId ? StateLogic.getCastaway(state, openId) : null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
        {terms.castaways.replace(/^./, (ch) => ch.toUpperCase())}
      </h3>
      <div className="flex flex-col gap-3">
        {groups.map(({ g, members }) => (
          <div key={g.id ?? "unassigned"} className="flex gap-2">
            {state.tribes.length > 0 && <div className="w-1 shrink-0 rounded-full" style={{ background: g.color }} title={g.name} />}
            <div className="min-w-0 flex-1">
              {state.tribes.length > 0 && (
                <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide" style={{ color: g.color }}>
                  {g.name}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {members.map((c) => {
                  const owners = c.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is Player => !!p);
                  return (
                    <button
                      key={c.id}
                      className={cn(
                        "flex w-11 flex-col items-center gap-0.5 rounded-md p-0.5 hover:bg-secondary",
                        c.status === "eliminated" && "opacity-45",
                        openId === c.id && "bg-secondary"
                      )}
                      onClick={() => setOpenId(openId === c.id ? null : c.id)}
                      aria-expanded={openId === c.id}
                    >
                      <div
                        className={cn("h-9 w-9 overflow-hidden rounded-md border-2", c.status === "eliminated" && "grayscale")}
                        style={{ borderColor: owners[0]?.color ?? "var(--border)" }}
                      >
                        <CastawayAvatar
                          castaway={c}
                          className="flex h-full w-full items-center justify-center bg-secondary font-mono text-[0.55rem] font-bold text-muted-foreground"
                        />
                      </div>
                      <span className="w-full truncate text-center text-[0.6rem] leading-tight">{c.name.split(" ")[0]}</span>
                      <span className="flex h-1.5 gap-0.5">
                        {owners.map((o) => (
                          <span key={o.id} className="h-1.5 w-1.5 rounded-full" style={{ background: o.color }} title={o.name} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              {open && members.some((m) => m.id === open.id) && (
                <div className="mt-2 max-w-[260px]">
                  <CastawayStatCard
                    state={state}
                    castaway={open}
                    owners={open.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is Player => !!p)}
                    showPlacementBadge={false}
                    expanded
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
