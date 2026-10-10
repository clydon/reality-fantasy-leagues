"use client";

import { useState } from "react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { ChevronDown, Clock, Lock, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { MoreOptions } from "@/components/setup/settings-ui";
import { ActButton, Notice } from "@/components/admin/admin-ui";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { rosterAtEpisode } from "@/lib/game/active-roster-rows";
import { cn } from "cn";

type Scored = { events: ReturnType<typeof StateLogic.ActiveRosterLogic.episodeEvents>; points: number };

// Active Roster's per-episode lineups on an episode's page (flat rows, DESIGN.md): each player's episode laid out like the
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
  // commissioner, to remove one). `benched` mutes it -- its number is what they would have scored.
  const line = (cid: string, key: string, benched = false) => {
    const c = StateLogic.getCastaway(state, cid);
    const scored = byCastaway.get(cid);
    const isOpen = openLine === key;
    const total = scored?.points ?? 0;
    const left = ep.events.some((ev) => ev.castawayId === cid);
    return (
      <li key={key}>
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2.5 rounded-[3px] py-1 text-left hover:bg-accent focus-visible:outline-3 focus-visible:outline-chyron-line"
          aria-expanded={isOpen}
          onClick={() => setOpenLine(isOpen ? null : key)}
        >
          {c && (
            <CastawayAvatar
              castaway={c}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-secondary text-[0.65rem] font-bold",
                benched && "opacity-70 grayscale"
              )}
            />
          )}
          <span className={cn("min-w-0 flex-1 truncate text-[15px] font-semibold", benched && "text-muted-foreground")}>{c?.name ?? "?"}</span>
          {left && (
            <span
              className="shrink-0 rounded-[2px] bg-live px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-live-foreground"
              title="Left the game this episode"
            >
              Out
            </span>
          )}
          {/* Lost points are muted, not red: losing points isn't leaving the game (DESIGN.md). */}
          <span
            className={cn("type-num w-12 shrink-0 text-right text-[18px]", (benched || total < 0) && "text-muted-foreground")}
            title={benched ? "What they would have scored, started" : undefined}
          >
            {fmt(total)}
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180", !scored && "invisible")}
            aria-hidden
          />
        </button>
        {isOpen && scored && (
          <ul className="mb-1.5 ml-[46px] flex flex-col border-l border-border pl-3">
            {scored.events.map((sev) => {
              const pts = StateLogic.ActiveRosterLogic.pointsFor(state, sev.type);
              return (
                <li key={sev.id} className="flex min-h-9 items-center gap-2 text-[14px]">
                  <span className="min-w-0 flex-1 text-muted-foreground">{events.find((e) => e.id === sev.type)?.label || sev.type}</span>
                  <span className={cn("type-num shrink-0 text-[15px]", pts < 0 && "text-muted-foreground")}>{fmt(pts)}</span>
                  {!sev.implied && canManage && (
                    <button
                      type="button"
                      className="-mr-2 flex size-9 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive"
                      aria-label="Remove this event"
                      disabled={busy}
                      onClick={() => run(() => api.removeScoringEvent(leagueId!, ep.id, sev.id))}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex min-h-11 items-center gap-3">
        <h3 className="section-title flex-1">Lineups</h3>
        {canManage && manualLock && (
          <ActButton disabled={busy} onClick={() => run(() => (locked ? api.unlockLineups(leagueId!, ep.id) : api.lockLineups(leagueId!, ep.id)))}>
            {locked ? "Reopen lineups" : "Lock lineups"}
          </ActButton>
        )}
      </div>
      <p className="-mt-1 flex items-center gap-1.5 text-[14px] text-muted-foreground">
        {locked ? <Lock className="size-4 shrink-0" aria-hidden /> : <Clock className="size-4 shrink-0" aria-hidden />}
        {locked ? "Locked" : "Open: lineups can still change"}
        {episodeEvents.length === 0 && " · no scoring logged yet"}
      </p>

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {lineups.map(({ player: p, ids, bench, total, carried }) => {
          const scorers = ids.filter((cid) => pointsOf(cid) !== 0);
          // Starters who scored nothing share one line, so the list is just what moved the total.
          const blanks = ids.filter((cid) => pointsOf(cid) === 0);
          const missed = StateLogic.roundPoints(bench.reduce((sum, cid) => sum + Math.max(0, pointsOf(cid)), 0));
          const sub = [ids.length > 0 && ids.length < activeSlots && `${ids.length} of ${activeSlots} started`, carried && "Last lineup reused"]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={p.id} className="flex flex-col gap-0.5 py-3">
              <div className="flex min-h-11 items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-semibold">{p.name}</span>
                  {sub && (
                    <span
                      className="text-[13px] text-muted-foreground"
                      title={carried ? "No lineup was set for this episode, so the last one chosen is used" : undefined}
                    >
                      {sub}
                    </span>
                  )}
                </div>
                <span className="type-num shrink-0 text-[26px] leading-none">{total}</span>
              </div>
              {ids.length === 0 ? (
                <p className="text-[14px] text-muted-foreground">No lineup set</p>
              ) : (
                <ul className="flex flex-col">
                  {scorers.map((cid) => line(cid, `${p.id}:${cid}`))}
                  {blanks.length > 0 && (
                    <li className="flex min-h-9 items-center gap-2.5 text-[14px] text-muted-foreground">
                      <span className="min-w-0 flex-1">
                        {scorers.length > 0 ? "Also started: " : "Started: "}
                        {blanks.map((cid) => StateLogic.getCastaway(state, cid)?.name ?? "?").join(", ")}
                      </span>
                      <span className="type-num w-12 shrink-0 text-right text-[18px]">0</span>
                      <span className="w-4 shrink-0" aria-hidden />
                    </li>
                  )}
                </ul>
              )}
              {bench.length > 0 && (
                <div className="mt-1.5 flex flex-col">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="type-caption text-[13px] tracking-[0.04em] text-muted-foreground">Bench</span>
                    {missed > 0 && <span className="text-[13px] text-muted-foreground">+{missed} left on the bench</span>}
                  </div>
                  <ul className="flex flex-col">{bench.map((cid) => line(cid, `${p.id}:bench:${cid}`, true))}</ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {others.length > 0 && (
        <MoreOptions label={`Scored, not on anyone’s roster (${others.length})`}>
          <ul className="-mt-3 flex flex-col">{others.map((cid) => line(cid, `other:${cid}`, true))}</ul>
        </MoreOptions>
      )}

      {canManage && (
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[15px] font-semibold">Log a scoring event</span>
          <Select className="w-full" aria-label="Event" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {loggable.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
          <Select className="w-full" aria-label={terms.castaway} value={eventCastawayId} onChange={(e) => setEventCastawayId(e.target.value)}>
            <option value="">Choose a {terms.castaway}</option>
            {state.castaways.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <ActButton
            className="self-start"
            disabled={busy || !eventCastawayId}
            onClick={async () => {
              markResultsSeen(ep.number); // entering it is seeing it
              const ok = await run(() => api.addScoringEvent(leagueId!, ep.id, eventType, eventCastawayId));
              if (ok) setEventCastawayId("");
            }}
          >
            Log event
          </ActButton>
        </div>
      )}

      {error && <Notice tone="bad">{error}</Notice>}
    </section>
  );
}

// "+2", "-0.5", "0".
function fmt(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
