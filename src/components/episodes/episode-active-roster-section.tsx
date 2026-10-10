"use client";

import { useState } from "react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { rosterAtEpisode } from "@/lib/game/active-roster-rows";
import { cn } from "cn";

type Scored = { events: ReturnType<typeof StateLogic.ActiveRosterLogic.episodeEvents>; points: number };

// Active Roster's per-episode UI inside EpisodeCard: each player's episode laid out like the
// Scoreboard's breakdown -- who they started and what each earned them, then their bench players who
// scored (what starting them would have been worth) -- plus the commissioner's lineup lock and the
// scoring-event log. Read-only for lineups: see lineup/lineup-page.tsx for where
// they're actually SET, tap by tap, the same self-service pattern as Eliminator Pool's pick.
//
// Lineups are per-episode by design (see ActiveRosterLogic): this component only ever reads
// `ep.lineups`, so there's no way for it to touch a different episode's lineup and change what that
// episode already scored.
//
// Doesn't use useMutate: lock/event calls have real validation messages worth showing inline rather
// than useMutate's generic alert(), and Active Roster isn't reachable in mock mode (the demo league is
// classic-draft), so a mock branch would be dead code.
export function EpisodeActiveRosterSection({ ep, state }: { ep: Episode; state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
  const canManage = useCanManage();

  const events = StateLogic.formatOf(state).events;
  // Implied events come from exits and roles on their own, so only the rest can be logged by hand.
  const loggable = events.filter((e) => !e.implied);
  const episodeEvents = StateLogic.ActiveRosterLogic.episodeEvents(state, ep);
  const [eventType, setEventType] = useState(loggable[0]?.id ?? "");
  const [eventCastawayId, setEventCastawayId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The castaway line whose events are showing, keyed per player, so the same castaway can be open
  // under one player and not another (shared ownership).
  const [openLine, setOpenLine] = useState<string | null>(null);

  // Locks on its own when the episode airs (ep.airsAt) or its results land; the commissioner's
  // manual lock is only offered where neither can happen -- a season with no schedule.
  const locked = StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id);
  const manualLock = !ep.airsAt && !StateLogic.episodeHasResults(ep);
  const activeSlots = state.settings.activeSlots;

  // This episode's events per castaway, with what each is worth.
  const byCastaway = new Map<string, Scored>();
  for (const sev of episodeEvents) {
    const entry = byCastaway.get(sev.castawayId) ?? { events: [], points: 0 };
    entry.events.push(sev);
    entry.points = StateLogic.roundPoints(entry.points + StateLogic.ActiveRosterLogic.pointsFor(state, sev.type));
    byCastaway.set(sev.castawayId, entry);
  }
  const pointsOf = (cid: string) => byCastaway.get(cid)?.points ?? 0;
  const byPoints = (a: string, b: string) => pointsOf(b) - pointsOf(a);
  // Highest-scoring player first, like the Scoreboard. The bench is anyone else on their roster that
  // episode who scored, either way.
  const lineups = state.players
    .map((p) => {
      const ids = StateLogic.activeRosterLineupFor(state, ep.id, p.id);
      const started = new Set(ids);
      return {
        player: p,
        carried: ids.length > 0 && StateLogic.ActiveRosterLogic.lineupIsCarried(state, ep.id, p.id),
        ids: [...ids].sort(byPoints),
        bench: rosterAtEpisode(state, p.id, ep.id)
          .map((c) => c.id)
          .filter((cid) => !started.has(cid) && pointsOf(cid) !== 0)
          .sort(byPoints),
        total: StateLogic.roundPoints(ids.reduce((sum, cid) => sum + pointsOf(cid), 0)),
      };
    })
    .filter((l) => l.player.active !== false || l.ids.length > 0)
    .sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name));
  const shown = new Set(lineups.flatMap((l) => [...l.ids, ...l.bench]));
  // Everyone who scored without being on a roster above -- free agents, mostly.
  const others = [...byCastaway.keys()].filter((cid) => !shown.has(cid)).sort(byPoints);

  async function run(fn: () => Promise<LeagueState>) {
    setBusy(true);
    setError(null);
    try {
      setState(await fn());
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // One castaway's line: photo, name, points; tap it for the events behind the number (and, for the
  // commissioner, to remove one). `benched` fades it -- its number is what they would have scored.
  const line = (cid: string, key: string, benched = false) => {
    const c = StateLogic.getCastaway(state, cid);
    const scored = byCastaway.get(cid);
    const isOpen = openLine === key;
    const total = scored?.points ?? 0;
    return (
      <div key={key}>
        <button
          className={cn("flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-secondary", benched && "opacity-60")}
          aria-expanded={isOpen}
          onClick={() => setOpenLine(isOpen ? null : key)}
        >
          {c && (
            <CastawayAvatar
              castaway={c}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-[0.6rem] font-bold"
            />
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {c?.name ?? "?"}
            {ep.events.some((ev) => ev.castawayId === cid) && (
              <span className="ml-1 text-destructive" title="Left the game this episode">
                ✕
              </span>
            )}
          </span>
          <span
            className={cn("w-10 shrink-0 text-right font-mono text-sm font-bold", total < 0 && "text-destructive")}
            title={benched ? "What they would have scored, started" : undefined}
          >
            {fmt(total)}
          </span>
        </button>
        {isOpen && scored && (
          <div className="mb-1.5 ml-10 mr-1 flex flex-col gap-0.5 text-xs">
            {scored.events.map((sev) => {
              const pts = StateLogic.ActiveRosterLogic.pointsFor(state, sev.type);
              return (
                <div key={sev.id} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-muted-foreground">{events.find((e) => e.id === sev.type)?.label || sev.type}</span>
                  <span className="flex shrink-0 items-baseline gap-1.5">
                    <span className={cn("font-mono", pts < 0 && "text-destructive")}>{fmt(pts)}</span>
                    {!sev.implied && canManage && (
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove event"
                        disabled={busy}
                        onClick={() => run(() => api.removeScoringEvent(leagueId!, ep.id, sev.id))}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Lineups</h4>
        {!locked && <Badge variant="secondary">Open</Badge>}
        {canManage && manualLock && (
          <Button
            variant="secondary"
            size="xs"
            disabled={busy}
            onClick={() => run(() => (locked ? api.unlockLineups(leagueId!, ep.id) : api.lockLineups(leagueId!, ep.id)))}
          >
            {locked ? "Reopen lineups" : "Lock lineups"}
          </Button>
        )}
      </div>
      {episodeEvents.length === 0 && <p className="mb-2 text-sm italic text-muted-foreground">No scoring logged for this episode yet.</p>}
      <div className="mb-3 flex flex-col gap-2">
        {lineups.map(({ player: p, ids, bench, total, carried }) => {
          const scorers = ids.filter((cid) => pointsOf(cid) !== 0);
          // Starters who scored nothing share one line, so the list is just what moved the total.
          const blanks = ids.filter((cid) => pointsOf(cid) === 0);
          const missed = StateLogic.roundPoints(bench.reduce((sum, cid) => sum + Math.max(0, pointsOf(cid)), 0));
          return (
            <div key={p.id} className="rounded-md border border-border px-2 py-1.5">
              <div className="flex items-center gap-2 px-1 py-0.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="min-w-0 flex-1 truncate font-bold">{p.name}</span>
                {ids.length < activeSlots && (
                  <span className="text-xs text-muted-foreground" title="Starting slots filled">
                    {ids.length}/{activeSlots}
                  </span>
                )}
                <span className="w-10 shrink-0 text-right font-mono text-base font-bold">{total}</span>
              </div>
              {carried && (
                <div className="px-1 text-[0.7rem] text-muted-foreground" title="No lineup was set for this episode, so the last one chosen is used">
                  Last lineup reused
                </div>
              )}
              {ids.length === 0 ? (
                <div className="px-1 py-1 text-xs italic text-muted-foreground">No lineup set</div>
              ) : (
                <>
                  {scorers.map((cid) => line(cid, `${p.id}:${cid}`))}
                  {blanks.length > 0 && (
                    <div className="flex items-baseline gap-2 px-1 py-1 text-xs text-muted-foreground">
                      <span className="min-w-0 flex-1">
                        {scorers.length > 0 ? "Also started: " : "Started: "}
                        {blanks.map((cid) => StateLogic.getCastaway(state, cid)?.name ?? "?").join(", ")}
                      </span>
                      <span className="w-10 shrink-0 text-right font-mono">0</span>
                    </div>
                  )}
                </>
              )}
              {bench.length > 0 && (
                <div className="mt-1 border-t border-dashed border-border pt-1">
                  <div className="flex items-baseline justify-between gap-2 px-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
                    <span>Bench</span>
                    {missed > 0 && <span className="font-mono normal-case tracking-normal">+{missed} left on the bench</span>}
                  </div>
                  {bench.map((cid) => line(cid, `${p.id}:bench:${cid}`, true))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {others.length > 0 && (
        <details className="mb-3 rounded-md border border-border px-2 py-1.5">
          <summary className="cursor-pointer px-1 text-xs text-muted-foreground">
            Scored, not on anyone&rsquo;s roster ({others.length})
          </summary>
          <div className="mt-1">{others.map((cid) => line(cid, `other:${cid}`, true))}</div>
        </details>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-1.5">
          <Select size="sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {loggable.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
          <Select size="sm" value={eventCastawayId} onChange={(e) => setEventCastawayId(e.target.value)}>
            <option value="">— {terms.castaway} —</option>
            {state.castaways.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={busy || !eventCastawayId}
            onClick={async () => {
              markResultsSeen(ep.number); // entering it is seeing it -- see episode-card.tsx
              const ok = await run(() => api.addScoringEvent(leagueId!, ep.id, eventType, eventCastawayId));
              if (ok) setEventCastawayId("");
            }}
          >
            + Log Event
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}

// "+2", "-0.5", "0".
function fmt(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
