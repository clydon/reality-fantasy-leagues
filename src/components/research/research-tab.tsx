"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { useHeaderAction } from "@/lib/header-action-store";
import { signed } from "@/lib/game/lineup-view";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { BottomSheet, SheetAction } from "@/components/ui/bottom-sheet";
import { MoreButton, ToggleRow } from "@/components/setup/settings-ui";
import { cn } from "cn";
import { RankedBy, WINDOWS, WindowTabs, airedEpisodes, buildRows, eventRank, rulesIn, type EpisodeLine, type Row, type Window } from "./research-rows";

// Active Roster's scouting page (the canvas's "A · Draft, scouting & mid-season": Scouting): every
// castaway ranked by the points they've actually scored over a window of recent episodes -- who's
// worth starting, who's worth picking up. A castaway's OWN points (every event attributed to them),
// not any owner's cut of them.
//
// One screen, top to bottom: the window (a segmented control), who to show (Everyone / Free agents /
// Mine / one team), the ranking as hairline rows with a bar per episode, then one line naming free
// agents who score like starters. Tapping a row opens its episodes in a sheet. The rarer options --
// rank per episode, hide who's out, count episodes before the league started -- sit behind the page's
// ⋯ (in the header on a phone).
//
// The view is a per-browser convenience (localStorage), not league state. Preseason isn't remembered:
// each visit starts on what counts in this league.

type Who = "all" | "free" | "mine" | `team:${string}`;
const PREFS_KEY = "rfl.research.prefs";
export function ResearchTab() {
  const state = useLeagueStore((s) => s.state);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const terms = useShowTerms();
  const setHeaderAction = useHeaderAction((s) => s.set);
  const [window, setWindow] = useState<Window>("season");
  const [who, setWho] = useState<Who>("all");
  const [perEpisode, setPerEpisode] = useState(false);
  const [hideOut, setHideOut] = useState(false);
  const [includePreseason, setIncludePreseason] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);
  // Rank by one scoring rule (an event id) instead of points. Not remembered: rules differ by show.
  const [rankBy, setRankBy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (saved) {
        /* eslint-disable react-hooks/set-state-in-effect -- one-time load from browser storage */
        if (WINDOWS.some(([w]) => w === saved.window)) setWindow(saved.window);
        if (saved.who === "all" || saved.who === "free" || saved.who === "mine") setWho(saved.who);
        if (typeof saved.hideOut === "boolean") setHideOut(saved.hideOut);
        if (typeof saved.perEpisode === "boolean") setPerEpisode(saved.perEpisode);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      /* defaults are fine */
    }
  }, []);
  useEffect(() => {
    try {
      // One team isn't remembered: next visit, that player may have left.
      localStorage.setItem(PREFS_KEY, JSON.stringify({ window, who: who.startsWith("team:") ? "all" : who, hideOut, perEpisode }));
    } catch {
      /* not remembered this time */
    }
  }, [window, who, hideOut, perEpisode]);

  // The page's options in the phone header's ⋯, like the finished Draft's.
  useEffect(() => {
    setHeaderAction({ label: "Research options", onClick: () => setOptionsOpen(true) });
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  const startEp = StateLogic.startEpisode(state);
  const preseason = includePreseason || startEp <= 1;
  const aired = useMemo(() => airedEpisodes(state, preseason), [state, preseason]);
  // Only windows shorter than what's aired: "Last 5" of three episodes is just the season.
  const windows = WINDOWS.filter(([w]) => w === "season" || Number(w) < aired.length);
  const shownWindow = windows.some(([w]) => w === window) ? window : "season";
  const rows = useMemo(() => buildRows(state, aired, shownWindow), [state, aired, shownWindow]);

  if (!StateLogic.getLeagueType(state).hasActiveRoster) {
    return (
      <>
        <h2 className="type-caption mb-4 text-[28px] max-nav:hidden">Research</h2>
        <p className="text-base text-muted-foreground">Research is for Active Roster leagues.</p>
      </>
    );
  }

  const players = state.players.filter((p) => !p.disabled && p.active !== false);
  const team = who.startsWith("team:") ? players.find((p) => p.id === who.slice(5)) ?? null : null;
  const mine = (c: Castaway) => !!myPlayerId && c.ownerIds.includes(myPlayerId);
  const free = (c: Castaway) => c.ownerIds.length === 0;
  // The rules that happened at least once in this window, in the show's own order -- what you can
  // rank by. A rule that's gone from the window drops you back to points.
  const rules = rulesIn(state, rows);
  const rule = rankBy ? rules.find((x) => x.type === rankBy) ?? null : null;
  // Under a rule, each episode's "points" is how many times it happened, so the bars and the column
  // both show that rule alone.
  const lines = (r: Row) => (rule ? r.perEpisode.map((e) => ({ ...e, points: e.events.filter((x) => x.type === rule.type).length })) : r.perEpisode);
  const times = (r: Row) => lines(r).reduce((n, e) => n + e.points, 0);
  const score = (r: Row) => (rule ? times(r) : perEpisode ? r.avg : r.points);
  const shown = rows
    .filter((r) => (who === "free" ? free(r.c) : who === "mine" ? mine(r.c) : team ? r.c.ownerIds.includes(team.id) : true))
    .filter((r) => !hideOut || r.c.status !== "eliminated")
    .sort((a, b) => score(b) - score(a) || b.points - a.points || a.c.name.localeCompare(b.c.name));
  const epNumbers = rows[0]?.perEpisode.map((e) => e.n) ?? [];
  const range = epNumbers.length === 0 ? null : epNumbers.length === 1 ? `Ep ${epNumbers[0]}` : `Ep ${epNumbers[0]}–${epNumbers[epNumbers.length - 1]}`;
  const maxBar = Math.max(1, ...rows.flatMap((r) => lines(r).map((e) => Math.abs(e.points))));
  const bars = epNumbers.length >= 2;

  // Who's on your bench this week, for "Yours · bench".
  const ep = StateLogic.currentEpisode(state);
  const myLineup: string[] = ep && myPlayerId ? (StateLogic.activeRosterLineupFor(state, ep.id, myPlayerId) as string[]) : [];
  const ownerLine = (c: Castaway): ReactNode => {
    if (c.status === "eliminated") {
      const exit = state.episodes.find((e) => e.events.some((x) => x.castawayId === c.id));
      return exit ? `Out · Episode ${exit.number}` : "Out";
    }
    if (free(c)) return <span className="font-semibold text-good">Free agent</span>;
    // "bench" only once you've started someone: before that, nobody's on it yet.
    const yours = myLineup.length > 0 && !myLineup.includes(c.id) ? "Yours · bench" : "Yours";
    return c.ownerIds
      .map((id) => (id === myPlayerId ? yours : StateLogic.getPlayer(state, id)?.name))
      .filter(Boolean)
      .join(", ");
  };
  const steals = who === "all" || who === "free" ? freeAgentSteals(state, rows) : [];
  const open = openId ? rows.find((r) => r.c.id === openId) ?? null : null;

  const options = (
    <>
      <ToggleRow label="Rank by points per episode" hint="Fairer to someone who joined late or sat out" checked={perEpisode} onChange={setPerEpisode} />
      <ToggleRow label={`Hide ${terms.castaways} who are out`} checked={hideOut} onChange={setHideOut} />
      {/* Only where there's a preseason: a league that started after episode 1. */}
      {startEp > 1 && (
        <ToggleRow
          label={`Include ${startEp === 2 ? "episode 1" : `episodes 1–${startEp - 1}`}`}
          hint="Before this league started. Scored for nobody, but it's still how they played."
          checked={includePreseason}
          onChange={setIncludePreseason}
        />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-11 items-center gap-3 max-nav:hidden">
        <h2 className="type-caption flex-1 text-[28px]">Research</h2>
        <MoreButton label="Research options" onClick={() => setOptionsOpen(true)} />
      </div>

      <WindowTabs windows={windows} value={shownWindow} onChange={setWindow} />

      <div role="group" aria-label="Whose" className="flex flex-wrap gap-2">
        <FilterChip on={who === "all"} onClick={() => setWho("all")}>
          Everyone
        </FilterChip>
        <FilterChip on={who === "free"} onClick={() => setWho("free")}>
          Free agents
        </FilterChip>
        {myPlayerId && (
          <FilterChip on={who === "mine"} onClick={() => setWho("mine")}>
            Mine
          </FilterChip>
        )}
        {players.some((p) => p.id !== myPlayerId) && (
          <FilterChip on={!!team} onClick={() => setTeamsOpen(true)}>
            <span className="max-w-[96px] truncate">{team ? team.name : "Team"}</span>
            <ChevronDown className="size-4" strokeWidth={2.4} aria-hidden />
          </FilterChip>
        )}
      </div>

      {epNumbers.length === 0 ? (
        <p className="border-t border-border pt-3 text-base text-muted-foreground">
          Nothing scored yet. The ranking fills in as episodes are revealed.
        </p>
      ) : shown.length === 0 ? (
        <p className="border-t border-border pt-3 text-base text-muted-foreground">
          {who === "free" ? `Every ${terms.castaway} is on someone's roster.` : `No ${terms.castaways} here.`}
        </p>
      ) : (
        <div data-tour="research-list">
          {/* The header is the ranking control: what the right-hand column counts, tap to change it. */}
          <div className="flex min-h-11 items-center gap-3 text-[12px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            <RankedBy rules={rules} rule={rule} pointsLabel={perEpisode ? "Points per episode" : "Points"} onChange={setRankBy} className="flex-1" />
            {bars && <span className="shrink-0 text-center">{range}</span>}
            <span className="w-11 shrink-0 text-right">{rule ? "Times" : perEpisode ? "Avg" : "Pts"}</span>
          </div>
          <ol className="border-b border-border">
            {shown.map((r, i) => {
              const out = r.c.status === "eliminated";
              return (
                <li key={r.c.id} className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => setOpenId(r.c.id)}
                    className={cn("flex min-h-[58px] w-full items-center gap-3 py-2 text-left outline-none focus-visible:bg-accent", out && "opacity-55")}
                  >
                    <span className="type-num w-5 shrink-0 text-[18px] text-muted-foreground">{i + 1}</span>
                    <CastawayAvatar
                      castaway={r.c}
                      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-muted text-xs font-bold text-muted-foreground [&_img]:object-top"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-base font-semibold">{r.c.name}</span>
                      <span className="truncate text-[13px] text-muted-foreground">{ownerLine(r.c)}</span>
                    </span>
                    {bars && <Sparkbars perEpisode={lines(r)} max={maxBar} bad={!!rule && rule.points < 0} />}
                    <span className="type-num w-11 shrink-0 text-right text-[22px]">{rule ? times(r) : perEpisode ? fmtAvg(r.avg) : r.points}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {steals.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {listNames(steals.map((c) => c.name))} {steals.length === 1 ? `is a free agent` : `are free agents`} scoring like{" "}
          {steals.length === 1 ? "a starter" : "starters"}.
        </p>
      )}

      {/* Each toggle applies as it's flipped, so the sheet closes with Done, not Cancel. */}
      <BottomSheet open={optionsOpen} onOpenChange={setOptionsOpen} title="Research" hideCancel>
        <div className="flex flex-col [&>*]:border-t [&>*]:border-border">{options}</div>
        <button
          type="button"
          onClick={() => setOptionsOpen(false)}
          className="mt-3 min-h-12 rounded-[3px] border border-border bg-secondary text-[15px] font-bold text-foreground"
        >
          Done
        </button>
      </BottomSheet>


      <BottomSheet open={teamsOpen} onOpenChange={setTeamsOpen} title="Show one team">
        {players
          .filter((p) => p.id !== myPlayerId)
          .map((p) => (
            <SheetAction
              key={p.id}
              detail={team?.id === p.id ? "Showing" : undefined}
              onClick={() => {
                setWho(`team:${p.id}`);
                setTeamsOpen(false);
              }}
            >
              <span className="flex items-center gap-3">
                <span className="size-3 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
                {p.name}&rsquo;s team
              </span>
            </SheetAction>
          ))}
      </BottomSheet>

      <BottomSheet
        open={!!open}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={open?.c.name ?? ""}
        description={open ? ownerLine(open.c) : undefined}
      >
        {open && <CastawayEpisodes row={open} />}
      </BottomSheet>
    </div>
  );
}

// A castaway's window in two reads. Habits first: each thing that scored for them, how many times and
// in which episodes -- "voted with the majority 4 times" at a glance. Deliberately no "out of": not
// every episode is a chance (no Tribal after an immunity win), and that can't be known for every show.
// Then the episodes, newest first, each event its own tag instead of a run-on line.
function CastawayEpisodes({ row }: { row: Row }) {
  const state = useLeagueStore((s) => s.state);
  const played = row.perEpisode.filter((e) => e.played);
  const habits = habitsOf(played, eventRank(state));
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        <b className="type-num mr-1 text-[22px] text-foreground">{row.points}</b>
        {row.played === 1 ? "in 1 episode" : `in ${row.played} episodes · ${fmtAvg(row.avg)} per episode`}
      </p>

      {habits.length > 0 && played.length > 1 && (
        <section aria-label="What they do">
          <h3 className="type-caption pb-1.5 text-[17px]">What they do</h3>
          <ul className="flex flex-col border-b border-border">
            {habits.map((h, i) => (
              // A little more room where one scoring group ends and the next begins.
              <li key={h.type} className={cn("flex items-center gap-3 border-t border-border py-2.5", i > 0 && group(h.rank) !== group(habits[i - 1].rank) && "mt-3")}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{h.label}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {h.hits === 1 ? "Once" : `${h.hits} times`} · {h.eps.length === 1 ? "Episode" : "Episodes"} {[...h.eps].sort((x, y) => x - y).join(", ")}
                  </span>
                </span>
                <span className={cn("type-num w-12 shrink-0 text-right text-[19px]", h.points < 0 && "text-destructive")}>{signed(h.points)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="By episode">
        <h3 className="type-caption pb-1.5 text-[17px]">By episode</h3>
        <ol className="flex flex-col border-b border-border">
          {[...row.perEpisode].reverse().map((e) => (
            <li key={e.n} className="flex items-start gap-3 border-t border-border py-2.5">
              <span className="type-num w-9 shrink-0 pt-0.5 text-[15px] text-muted-foreground">Ep {e.n}</span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {!e.played ? (
                  <span className="text-[13px] leading-6 text-muted-foreground">Out of the game</span>
                ) : e.events.length ? (
                  e.events.map((x, i) => (
                    <span key={i} className="rounded-[2px] bg-muted px-2 py-1 text-[13px] leading-[1.3] font-semibold">
                      {x.label}
                      <span className={cn("type-num ml-1.5 whitespace-nowrap", x.points < 0 ? "text-destructive" : "text-good")}>{signed(x.points)}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] leading-6 text-muted-foreground">Nothing that scores</span>
                )}
              </span>
              <span className={cn("type-num w-12 shrink-0 text-right text-[22px]", !e.played && "text-muted-foreground")}>{e.played ? signed(e.points) : "–"}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/** Each scoring event across the episodes a castaway played: in how many, which, and its points
 *  together. In the show's own order (eventRank), the same for every castaway, so two are easy to
 *  compare. */
function habitsOf(played: EpisodeLine[], rank: (type: string) => number) {
  const by = new Map<string, { type: string; label: string; rank: number; eps: number[]; hits: number; points: number }>();
  for (const e of played)
    for (const x of e.events) {
      const h = by.get(x.type) ?? { type: x.type, label: x.label, rank: rank(x.type), eps: [], hits: 0, points: 0 };
      if (!h.eps.includes(e.n)) {
        h.eps.push(e.n);
        h.hits++;
      }
      h.points = StateLogic.roundPoints(h.points + x.points);
      by.set(x.type, h);
    }
  return [...by.values()].sort((a, b) => a.rank - b.rank);
}


const group = (rank: number) => Math.floor(rank / 1000);

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-10 items-center gap-1.5 rounded-[3px] border px-3 text-sm",
        on ? "border-foreground bg-foreground font-bold text-background" : "border-input font-semibold text-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

// One small bar per episode in the window: how much they scored each week, at a glance. Teal for a
// week that scored (red when ranking by a rule that costs points), muted for one that didn't, a
// stub once they're out.
function Sparkbars({ perEpisode, max, bad }: { perEpisode: EpisodeLine[]; max: number; bad?: boolean }) {
  return (
    <span className="flex h-[26px] shrink-0 items-end gap-[3px]" aria-hidden>
      {perEpisode.slice(-6).map((e) => (
        <span
          key={e.n}
          className={cn("w-2 rounded-[1px]", !e.played ? "bg-border" : e.points > 0 ? (bad ? "bg-destructive" : "bg-good") : "bg-muted-foreground/35")}
          style={{ height: `${e.played && e.points !== 0 ? Math.max(18, (Math.abs(e.points) / max) * 100) : 12}%` }}
        />
      ))}
    </span>
  );
}



/** Free agents still in the game who'd make the league's starting lineups on points: at least as many
 *  as the weakest of the top N owned castaways, N being every team's starting slots together. */
function freeAgentSteals(state: LeagueState, rows: Row[]): Castaway[] {
  const slots = (state.settings.activeSlots ?? 0) * state.players.filter((p) => !p.disabled && p.active !== false).length;
  const owned = rows
    .filter((r) => r.c.ownerIds.length > 0 && r.c.status !== "eliminated")
    .map((r) => r.points)
    .sort((a, b) => b - a);
  if (!slots || owned.length === 0) return [];
  const bar = owned[Math.min(slots, owned.length) - 1];
  return rows
    .filter((r) => r.c.ownerIds.length === 0 && r.c.status !== "eliminated" && r.points > 0 && r.points >= bar)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((r) => r.c);
}

function fmtAvg(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function listNames(names: string[]) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
