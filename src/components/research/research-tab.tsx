"use client";

import { useEffect, useMemo, useState } from "react";
import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "cn";
import { isKnockedOut } from "@/lib/game/selectors";

// Active Roster's scouting page: every castaway ranked by the points they've actually scored, over a
// chosen window of recent episodes -- who's worth fielding, who's worth picking up. A castaway's OWN
// points (every event attributed to them), not any owner's cut of them, same as the board's badge.
//
// Filters are per-browser conveniences (localStorage), not league state.

type Window = "season" | "3" | "5" | "1";
type Sort = "points" | "avg" | "last";
const PREFS_KEY = "rfl.research.prefs";
const WINDOWS: [Window, string][] = [
  ["season", "Season"],
  ["5", "Last 5"],
  ["3", "Last 3"],
  ["1", "Last ep"],
];

interface Row {
  c: Castaway;
  points: number;
  played: number;
  avg: number;
  lastPoints: number;
  perEpisode: { n: number; points: number; played: boolean }[];
  byType: { label: string; count: number; points: number }[];
}

export function ResearchTab() {
  const state = useLeagueStore((s) => s.state);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const terms = useShowTerms();
  const [window, setWindow] = useState<Window>("season");
  const [includeOwned, setIncludeOwned] = useState(true);
  // One player's team only ("" = everyone). Overrides "Include owned" -- a team is all owned.
  const [team, setTeam] = useState("");
  const [hideOut, setHideOut] = useState(false);
  // Episodes before the league's start episode: scored for nobody, but still how a castaway played.
  // Off by default -- only what counts in this league -- and not remembered: each visit starts there.
  const [includePreseason, setIncludePreseason] = useState(false);
  const [sort, setSort] = useState<Sort>("points");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (saved) {
        /* eslint-disable react-hooks/set-state-in-effect -- one-time load from browser storage */
        if (WINDOWS.some(([w]) => w === saved.window)) setWindow(saved.window);
        if (typeof saved.includeOwned === "boolean") setIncludeOwned(saved.includeOwned);
        if (typeof saved.hideOut === "boolean") setHideOut(saved.hideOut);
        if (["points", "avg", "last"].includes(saved.sort)) setSort(saved.sort);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      /* defaults are fine */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ window, includeOwned, hideOut, sort }));
    } catch {
      /* not remembered this time */
    }
  }, [window, includeOwned, hideOut, sort]);

  const startEp = StateLogic.startEpisode(state);
  const { rows, episodeNumbers } = useMemo(
    () => buildRows(state, window, includePreseason || startEp <= 1),
    [state, window, includePreseason, startEp]
  );

  if (!StateLogic.getLeagueType(state).hasActiveRoster) {
    return (
      <>
        <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Research</h2>
        <p className="text-sm text-muted-foreground">Research is for Active Roster leagues.</p>
      </>
    );
  }

  const shown = rows
    .filter((r) => (team ? r.c.ownerIds.includes(team) : includeOwned || r.c.ownerIds.length === 0 || r.c.ownerIds.includes(myPlayerId ?? "")))
    .filter((r) => !hideOut || r.c.status !== "eliminated")
    .sort((a, b) => {
      const key = (r: Row) => (sort === "avg" ? r.avg : sort === "last" ? r.lastPoints : r.points);
      return key(b) - key(a) || b.points - a.points || a.c.name.localeCompare(b.c.name);
    });
  const maxBar = Math.max(1, ...rows.flatMap((r) => r.perEpisode.map((e) => Math.abs(e.points))));
  const windowLabel =
    episodeNumbers.length === 0
      ? "no episodes scored yet"
      : episodeNumbers.length === 1
        ? `episode ${episodeNumbers[0]}`
        : `episodes ${episodeNumbers[0]}–${episodeNumbers[episodeNumbers.length - 1]}`;

  return (
    <>
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight max-nav:hidden">Research</h2>

      <div className="mb-3 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border">
            {WINDOWS.map(([w, label]) => (
              <button
                key={w}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold",
                  window === w ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"
                )}
                onClick={() => setWindow(w)}
              >
                {label}
              </button>
            ))}
          </div>
          <Select size="sm" value={team} onChange={(e) => setTeam(e.target.value)} title="Show one player's team">
            <option value="">All teams</option>
            {state.players
              .filter((p) => !p.disabled)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === myPlayerId ? `Your team (${p.name})` : `${p.name}'s team`}
                </option>
              ))}
          </Select>
          <Select size="sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)} title="Sort by">
            <option value="points">Most points</option>
            <option value="avg">Best per episode</option>
            <option value="last">Best last episode</option>
          </Select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <label className={cn("flex items-center gap-1.5", team && "opacity-50")}>
            <input type="checkbox" checked={includeOwned || !!team} disabled={!!team} onChange={(e) => setIncludeOwned(e.target.checked)} />
            Include owned {terms.castaways}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={hideOut} onChange={(e) => setHideOut(e.target.checked)} />
            Hide eliminated
          </label>
          {/* Only where there's a preseason: a league that started after episode 1. */}
          {startEp > 1 && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={includePreseason} onChange={(e) => setIncludePreseason(e.target.checked)} />
              Include {startEp === 2 ? "episode 1" : `episodes 1–${startEp - 1}`} (before the league started)
            </label>
          )}
          <span className="ml-auto">Scoring {windowLabel}</span>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          {includeOwned || team ? `No ${terms.castaways} match.` : `Every ${terms.castaway} is owned — tick "Include owned" to see them.`}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {shown.map((r, i) => {
            const owners = r.c.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is NonNullable<typeof p> => !!p);
            const tribe = r.c.tribeId ? StateLogic.Core.getTribe(state, r.c.tribeId) : null;
            const out = isKnockedOut(state, r.c);
            const isOpen = open === r.c.id;
            return (
              <div key={r.c.id} className="border-t border-border first:border-t-0">
                <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary/50" onClick={() => setOpen(isOpen ? null : r.c.id)}>
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <CastawayAvatar
                    castaway={r.c}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold",
                      out && "opacity-40 grayscale"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm font-semibold", out && "text-muted-foreground line-through decoration-1")}>{r.c.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      {tribe && (
                        <span className="rounded px-1.5 py-px text-[0.6rem] font-bold uppercase text-white" style={{ background: tribe.color }}>
                          {tribe.name}
                        </span>
                      )}
                      {owners.length > 0 ? (
                        owners.map((o) => (
                          <Badge key={o.id} className="h-4 px-1.5 text-[0.6rem] text-white" style={{ background: o.color }}>
                            {o.id === myPlayerId ? "You" : o.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[0.65rem] font-semibold text-good">Free agent</span>
                      )}
                    </div>
                  </div>
                  <Sparkbars perEpisode={r.perEpisode} max={maxBar} />
                  <div className="w-12 shrink-0 text-right">
                    <div className="font-mono text-base font-bold leading-tight">{sort === "avg" ? r.avg.toFixed(1) : sort === "last" ? r.lastPoints : r.points}</div>
                    <div className="text-[0.6rem] text-muted-foreground">
                      {sort === "avg" ? `${r.points} pts` : sort === "last" ? "last ep" : `${r.avg.toFixed(1)}/ep`}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="bg-secondary/40 px-3 py-2 text-xs">
                    {r.byType.length === 0 ? (
                      <span className="italic text-muted-foreground">No scoring events in this window.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.byType.map((t) => (
                          <span key={t.label} className="inline-flex items-center gap-1 rounded bg-card px-1.5 py-0.5">
                            {t.label}
                            {t.count > 1 && <span className="text-muted-foreground">×{t.count}</span>}
                            <span className="font-mono font-bold">{t.points >= 0 ? `+${t.points}` : t.points}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-muted-foreground">
                      {r.perEpisode.map((e) => (
                        <span key={e.n}>
                          Ep {e.n}: <b className="text-foreground">{e.played ? e.points : "—"}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// One small bar per episode in the window: how much they scored each week, at a glance.
function Sparkbars({ perEpisode, max }: { perEpisode: Row["perEpisode"]; max: number }) {
  if (perEpisode.length < 2) return null;
  return (
    <div className="flex h-7 shrink-0 items-end gap-px max-[380px]:hidden" aria-hidden>
      {perEpisode.map((e) => (
        <span
          key={e.n}
          className={cn("w-1.5 rounded-sm", !e.played ? "bg-border" : e.points > 0 ? "bg-primary" : "bg-muted-foreground/30")}
          style={{ height: `${e.played ? Math.max(8, (Math.abs(e.points) / max) * 100) : 8}%` }}
          title={`Ep ${e.n}: ${e.played ? e.points : "out"}`}
        />
      ))}
    </div>
  );
}

function buildRows(state: LeagueState, window: Window, includePreseason: boolean): { rows: Row[]; episodeNumbers: number[] } {
  const defs = StateLogic.formatOf(state).events;
  // Episodes that have happened: anything with results recorded and revealed to this league --
  // including ones before the league's start episode. Those don't score for anyone, but they're
  // still how a castaway has played, which is what scouting is for.
  const aired = [...state.episodes]
    .filter((ep) => StateLogic.RevealLogic.isRevealed(state, ep.number))
    .filter((ep) => includePreseason || StateLogic.inPlay(state, ep.number))
    .filter((ep) => ep.events.length > 0 || StateLogic.ActiveRosterLogic.episodeEvents(state, ep).length > 0)
    .sort((a, b) => a.number - b.number);
  const inWindow = window === "season" ? aired : aired.slice(-Number(window));
  const lastEp = aired[aired.length - 1];

  // The episode each castaway left in (they played it, then no more).
  const exitEp: Record<string, number> = {};
  for (const ep of state.episodes) for (const ev of ep.events) exitEp[ev.castawayId] = Math.min(exitEp[ev.castawayId] ?? Infinity, ep.number);

  const rows = state.castaways.map((c) => {
    const perEpisode = inWindow.map((ep) => ({ n: ep.number, points: 0, played: !(exitEp[c.id] < ep.number) }));
    const counts: Record<string, number> = {};
    let lastPoints = 0;
    inWindow.forEach((ep, i) => {
      for (const sev of StateLogic.ActiveRosterLogic.episodeEvents(state, ep)) {
        if (sev.castawayId !== c.id) continue;
        const pts = StateLogic.ActiveRosterLogic.pointsFor(state, sev.type);
        perEpisode[i].points = StateLogic.roundPoints(perEpisode[i].points + pts);
        counts[sev.type] = (counts[sev.type] || 0) + 1;
      }
    });
    if (lastEp) {
      for (const sev of StateLogic.ActiveRosterLogic.episodeEvents(state, lastEp)) {
        if (sev.castawayId === c.id) lastPoints = StateLogic.roundPoints(lastPoints + StateLogic.ActiveRosterLogic.pointsFor(state, sev.type));
      }
    }
    const points = StateLogic.roundPoints(perEpisode.reduce((s, e) => s + e.points, 0));
    const played = perEpisode.filter((e) => e.played).length;
    const byType = defs
      .filter((d) => counts[d.id] > 0)
      .map((d) => ({ label: d.label, count: counts[d.id], points: StateLogic.roundPoints(counts[d.id] * StateLogic.ActiveRosterLogic.pointsFor(state, d.id)) }));
    return { c, points, played, avg: played ? points / played : 0, lastPoints, perEpisode, byType };
  });
  return { rows, episodeNumbers: inWindow.map((ep) => ep.number) };
}
