"use client";

import { useState } from "react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { ChevronDown, Clock, Lock, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { MoreOptions } from "@/components/setup/settings-ui";
import { ActButton, Notice } from "@/components/admin/admin-ui";
import { CaptionPlate } from "@/components/ui/caption-plate";
import { ordinal } from "@/components/scoreboard/scoreboard-tab";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { rosterAtEpisode } from "@/lib/game/active-roster-rows";
import { cn } from "cn";

type Scored = { events: ReturnType<typeof StateLogic.ActiveRosterLogic.episodeEvents>; points: number };

// This episode's events per castaway, with what each is worth.
function scoredByCastaway(state: LeagueState, ep: Episode) {
  const byCastaway = new Map<string, Scored>();
  for (const sev of StateLogic.ActiveRosterLogic.episodeEvents(state, ep)) {
    const entry = byCastaway.get(sev.castawayId) ?? { events: [], points: 0 };
    entry.events.push(sev);
    entry.points = StateLogic.roundPoints(entry.points + StateLogic.ActiveRosterLogic.pointsFor(state, sev.type));
    byCastaway.set(sev.castawayId, entry);
  }
  return byCastaway;
}

// Active Roster on an episode's page, led by the question everyone opens it with: how did I do, and
// how did that compare? A "You" plate answers it in one line (your points and where they put you this
// episode), then the episode's own leaderboard: every player ranked by what their lineup scored, your
// row lifted and open, anyone else's opening on a tap to show who they started and what each earned
// (then their bench players who scored -- what starting them would have been worth). The commissioner's
// lineup lock and scoring log are EpisodeActiveRosterTools, at the foot of the page. Read-only for
// lineups: see lineup/lineup-page.tsx for where they're actually SET.
//
// Lineups are per-episode by design (see ActiveRosterLogic): this component only ever reads
// `ep.lineups`, so there's no way for it to touch a different episode's lineup and change what that
// episode already scored.
export function EpisodeActiveRosterSection({ ep, state }: { ep: Episode; state: LeagueState }) {
  const me = useMyPlayerId();
  const canManage = useCanManage();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const events = StateLogic.formatOf(state).events;
  const byCastaway = scoredByCastaway(state, ep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which players' rows are open (yours starts open), and which castaway line's events are showing,
  // keyed per player so the same castaway can be open under one player and not another.
  const [openRows, setOpenRows] = useState<Set<string>>(() => new Set(me ? [me] : []));
  const [openLine, setOpenLine] = useState<string | null>(null);

  const locked = StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id);
  const activeSlots = state.settings.activeSlots;
  const scoredAny = byCastaway.size > 0;

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
  // Ties read "T2" and nobody's rank is chyron when everyone's level (the Scoreboard's rules).
  const ranks = lineups.map((l) => {
    const first = lineups.findIndex((o) => o.total === l.total);
    const tied = lineups.filter((o) => o.total === l.total).length > 1;
    return { n: first + 1, tied };
  });
  const level = lineups.every((l) => l.total === lineups[0]?.total);
  const shown = new Set(lineups.flatMap((l) => [...l.ids, ...l.bench]));
  // Everyone who scored without being on a roster above -- free agents, mostly.
  const others = [...byCastaway.keys()].filter((cid) => !shown.has(cid)).sort(byPoints);

  const mineAt = me ? lineups.findIndex((l) => l.player.id === me) : -1;
  const mine = mineAt >= 0 ? lineups[mineAt] : null;

  function toggleRow(id: string) {
    setOpenRows((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
                "flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-secondary text-[0.65rem] font-bold [&_img]:object-top",
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
                      onClick={async () => {
                        setBusy(true);
                        setError(null);
                        try {
                          setState(await api.removeScoringEvent(leagueId!, ep.id, sev.id));
                        } catch (e) {
                          setError(e instanceof ApiError ? e.message : "That didn't work.");
                        } finally {
                          setBusy(false);
                        }
                      }}
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
    <>
      {mine && scoredAny && (
        <YouPlate
          total={mine.total}
          rank={ranks[mineAt]}
          of={lineups.length}
          started={mine.ids.length > 0}
          benchPts={StateLogic.roundPoints(mine.bench.reduce((sum, cid) => sum + Math.max(0, pointsOf(cid)), 0))}
          top={mine.ids.find((cid) => pointsOf(cid) > 0)}
          state={state}
          pointsOf={pointsOf}
        />
      )}

      <section className="flex flex-col gap-2">
        <h3 className="section-title">{scoredAny ? "This episode" : "Lineups"}</h3>
        {/* Only worth a line while it says something: a scored episode is locked as a matter of course. */}
        {(!locked || !scoredAny) && (
          <p className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
            {locked ? <Lock className="size-4 shrink-0" aria-hidden /> : <Clock className="size-4 shrink-0" aria-hidden />}
            {locked ? "Locked" : "Open: lineups can still change"}
            {!scoredAny && " · no scoring logged yet"}
          </p>
        )}

        <ul className="flex flex-col">
          {lineups.map(({ player: p, ids, bench, total, carried }, i) => {
            const isMe = p.id === me;
            const open = openRows.has(p.id);
            const scorers = ids.filter((cid) => pointsOf(cid) !== 0);
            // Starters who scored nothing share one line, so the list is just what moved the total.
            const blanks = ids.filter((cid) => pointsOf(cid) === 0);
            const missed = StateLogic.roundPoints(bench.reduce((sum, cid) => sum + Math.max(0, pointsOf(cid)), 0));
            // Closed, the line under the name previews where the points came from; open, it says how
            // the lineup was set, since the scorers are right there.
            const preview = scorers
              .slice(0, 2)
              .map((cid) => `${StateLogic.getCastaway(state, cid)?.name.split(" ")[0] ?? "?"} ${fmt(pointsOf(cid))}`)
              .join(" · ");
            const how = [ids.length > 0 && ids.length < activeSlots && `${ids.length} of ${activeSlots} started`, carried && "Last lineup reused"]
              .filter(Boolean)
              .join(" · ");
            // Before any scoring there's nothing to open or total: the row just says who's starting.
            const starting = ids.map((cid) => StateLogic.getCastaway(state, cid)?.name.split(" ")[0] ?? "?").join(", ");
            const sub =
              ids.length === 0
                ? "No lineup set"
                : !scoredAny
                  ? [`Starting ${starting}`, how].filter(Boolean).join(" · ")
                  : open
                    ? how
                    : preview || how || "Nobody in the lineup scored";
            const expandable = scoredAny && ids.length > 0;
            const rank = ranks[i];
            return (
              <li key={p.id} className={cn("border-t border-border first:border-t-0", isMe && "-mx-2 rounded-[3px] border-t-0 bg-muted px-2 [&+li]:border-t-0")}>
                <button
                  type="button"
                  aria-expanded={expandable ? open : undefined}
                  disabled={!expandable}
                  onClick={() => toggleRow(p.id)}
                  className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left focus-visible:outline-3 focus-visible:outline-chyron-line disabled:cursor-default"
                >
                  {scoredAny && (
                    <span className={cn("type-num w-8 shrink-0 text-[22px] text-muted-foreground", rank.n === 1 && !level && "text-chyron-line")}>
                      {rank.tied ? "T" : ""}
                      {rank.n}
                    </span>
                  )}
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-base font-semibold">{p.name}</span>
                      {isMe && (
                        <span className="shrink-0 rounded-[2px] bg-foreground px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-background">You</span>
                      )}
                    </span>
                    {sub && (
                      <span
                        className="truncate text-[13px] text-muted-foreground"
                        title={carried ? "No lineup was set for this episode, so the last one chosen is used" : undefined}
                      >
                        {sub}
                      </span>
                    )}
                  </span>
                  {expandable && (
                    <>
                      <span className={cn("type-num shrink-0 text-[26px] leading-none", total < 0 && "text-muted-foreground")}>{fmt(total)}</span>
                      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
                    </>
                  )}
                </button>
                {open && expandable && (
                  <div className="flex flex-col pb-3 pl-[52px] max-[359px]:pl-0">
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
                    {bench.length > 0 && (
                      <div className="mt-1.5 flex flex-col">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="type-caption text-[13px] tracking-[0.04em] text-muted-foreground">Bench</span>
                          {missed > 0 && <span className="text-[13px] text-muted-foreground">+{missed} left on the bench</span>}
                        </div>
                        <ul className="flex flex-col">{bench.map((cid) => line(cid, `${p.id}:bench:${cid}`, true))}</ul>
                      </div>
                    )}
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
        {error && <Notice tone="bad">{error}</Notice>}
      </section>
    </>
  );
}

// Your episode in one line, under the Out plates (the Overview's "last week" plate, plus the rank):
// "+6 · 2nd of 4", then the nudge -- what sat on your bench -- or who carried you.
function YouPlate({
  total,
  rank,
  of,
  started,
  benchPts,
  top,
  state,
  pointsOf,
}: {
  total: number;
  rank: { n: number; tied: boolean };
  of: number;
  started: boolean;
  benchPts: number;
  top?: string;
  state: LeagueState;
  pointsOf: (cid: string) => number;
}) {
  const terms = useShowTerms();
  const place = `${rank.tied ? "tied " : ""}${ordinal(rank.n)} of ${of}`;
  const topName = top ? StateLogic.getCastaway(state, top)?.name.split(" ")[0] : null;
  return (
    <CaptionPlate
      tag="You"
      tone="good"
      size="sm"
      title={`${fmt(total)} · ${place}`}
      subtitle={
        !started
          ? "You had no lineup this episode"
          : benchPts > 0
            ? `${benchPts} more ${benchPts === 1 ? "point" : "points"} sat on your bench`
            : topName
              ? `${topName} led your lineup with ${fmt(pointsOf(top!))}`
              : `Nothing from your ${terms.castaways} in the lineup scored`
      }
    />
  );
}

// The commissioner's side of an episode's lineups, folded away at the foot of the page: the manual
// lock (only where neither airtime nor results can lock them -- a season with no schedule) and logging
// a scoring event by hand. Lock/event calls have real validation messages worth showing inline, so
// this doesn't use useMutate's generic alert().
export function EpisodeActiveRosterTools({ ep, state }: { ep: Episode; state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const markResultsSeen = useLeagueStore((s) => s.markResultsSeen);
  const loggable = StateLogic.formatOf(state).events.filter((e) => !e.implied);
  const [eventType, setEventType] = useState(loggable[0]?.id ?? "");
  const [eventCastawayId, setEventCastawayId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id);
  const manualLock = !ep.airsAt && !StateLogic.episodeHasResults(ep);

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

  return (
    <MoreOptions label="Commissioner tools">
      <div className="-mt-2 flex flex-col gap-4">
        {manualLock && (
          <ActButton
            className="self-start"
            disabled={busy}
            onClick={() => run(() => (locked ? api.unlockLineups(leagueId!, ep.id) : api.lockLineups(leagueId!, ep.id)))}
          >
            {locked ? "Reopen lineups" : "Lock lineups"}
          </ActButton>
        )}
        <div className="flex flex-col gap-2">
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
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </MoreOptions>
  );
}

// "+2", "-0.5", "0".
function fmt(n: number) {
  return n > 0 ? `+${n}` : String(n);
}
