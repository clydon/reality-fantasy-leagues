"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Castaway, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { signed } from "@/lib/game/lineup-view";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { RangeSlider } from "@/components/ui/range-slider";
import { ToggleRow } from "@/components/setup/settings-ui";
import { cn } from "cn";
import { pickWindow } from "@/lib/game/pool-view";
import { RankedBy, SAFETY_RULE, SAFETY_RULE_ID, hasSafety, airedEpisodes, buildRows, eventRank, rulesIn, type EpisodeLine, type Row } from "./research-rows";

// The scouting page, in every game (docs/PLAN-league-tabs.md; first Active Roster's, the canvas's
// "A · Draft, scouting & mid-season": Scouting): every
// castaway ranked by the points they've actually scored over a window of recent episodes -- who's
// worth starting, who's worth picking up. A castaway's OWN points (every event attributed to them),
// not any owner's cut of them.
//
// One screen, top to bottom: a single Filter bar that says what's showing, the ranking as hairline rows
// with a bar per episode, then one line naming free agents who score like starters. Tapping a row opens
// its episodes in a sheet. Every filter lives in the Filter sheet: which episodes (a range slider over
// every revealed episode, including ones before the league started -- a first-episode idol find still
// says something), who to show, which tribe, rank per episode, hide who's out.
//
// The view is a per-browser convenience (localStorage), not league state. The episode range isn't
// remembered: each visit starts on the league's own episodes, up to the latest.

type Who = "all" | "free" | "mine" | `team:${string}`;
type PoolWho = "open" | "used" | "all";
const PREFS_KEY = "rfl.research.prefs";
export function ResearchTab() {
  const state = useLeagueStore((s) => s.state);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const terms = useShowTerms();
  const [who, setWho] = useState<Who>("all");
  const [perEpisode, setPerEpisode] = useState(false);
  const [hideOut, setHideOut] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // Indexes into every revealed episode (allAired); null = the default, the league's own episodes.
  const [pickedRange, setRange] = useState<[number, number] | null>(null);
  // Combines with Whose; not remembered (tribes merge and swap).
  const [tribeId, setTribeId] = useState<string | null>(null);
  // Rank by one scoring rule (an event id) instead of points. Not remembered: rules differ by show.
  // (undefined = not chosen yet: an Eliminator Pool starts on Safety, everything else on points.)
  const [rankBy, setRankBy] = useState<string | null | undefined>(undefined);
  // An Eliminator Pool's "who": from your own pick history (not remembered: it changes every week).
  const [poolWho, setPoolWho] = useState<PoolWho>("open");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from browser storage
        if (saved.who === "all" || saved.who === "free" || saved.who === "mine") setWho(saved.who);
        if (typeof saved.hideOut === "boolean") setHideOut(saved.hideOut);
        if (typeof saved.perEpisode === "boolean") setPerEpisode(saved.perEpisode);
      }
    } catch {
      /* defaults are fine */
    }
  }, []);
  useEffect(() => {
    try {
      // One team isn't remembered: next visit, that player may have left.
      localStorage.setItem(PREFS_KEY, JSON.stringify({ who: who.startsWith("team:") ? "all" : who, hideOut, perEpisode }));
    } catch {
      /* not remembered this time */
    }
  }, [who, hideOut, perEpisode]);

  // Every revealed episode with results, before the league started too; the range picks from these.
  const startEp = StateLogic.startEpisode(state);
  const allAired = useMemo(() => airedEpisodes(state, true), [state]);
  const lastIdx = allAired.length - 1;
  const firstInPlay = allAired.findIndex((e) => e.number >= startEp);
  const startIdx = firstInPlay < 0 ? Math.max(0, lastIdx) : firstInPlay;
  const defaultRange: [number, number] = [startIdx, Math.max(0, lastIdx)];
  // A remembered range can outgrow the list (an episode un-revealed): clamp, falling back to the default.
  const shownRange: [number, number] = pickedRange && pickedRange[1] <= lastIdx ? pickedRange : defaultRange;
  const rangeIsDefault = shownRange[0] === defaultRange[0] && shownRange[1] === defaultRange[1];
  const aired = useMemo(() => allAired.slice(shownRange[0], shownRange[1] + 1), [allAired, shownRange[0], shownRange[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => buildRows(state, aired, "season"), [state, aired]);

  // Owners exist only in roster games (Classic, Active Roster). An Eliminator Pool has nobody's team,
  // so its rows say only who's in or out, and Whose comes down to Everyone; its own filters (Open to you /
  // Used / Everyone) read your pick history.
  const hasRoster = !!StateLogic.getLeagueType(state).hasRoster;
  const shownWho: Who = hasRoster ? who : "all";

  const players = state.players.filter((p) => !p.disabled && p.active !== false);
  // Tribes are the show's, so every game can filter by them (not just roster games).
  const tribe = tribeId ? state.tribes.find((t) => t.id === tribeId) ?? null : null;
  const team = shownWho.startsWith("team:") ? players.find((p) => p.id === who.slice(5)) ?? null : null;
  const mine = (c: Castaway) => !!myPlayerId && c.ownerIds.includes(myPlayerId);
  const free = (c: Castaway) => c.ownerIds.length === 0;
  // The rules that happened at least once in this window, in the show's own order -- what you can
  // rank by. A rule that's gone from the window drops you back to points.
  // An Eliminator Pool picks one survivor a week, so surviving matters more than scoring: Safety
  // (immunity, Tribals with no votes, votes survived) sits first among the things to rank by.
  const isPool = !!StateLogic.getLeagueType(state).hasWeeklyPicks && !hasRoster;
  const safety = isPool && hasSafety(state);
  const rules = safety ? [SAFETY_RULE, ...rulesIn(state, rows)] : rulesIn(state, rows);
  const rankKey = rankBy === undefined ? (safety ? SAFETY_RULE_ID : null) : rankBy;
  const rule = rankKey ? rules.find((x) => x.type === rankKey) ?? null : null;
  const bySafety = rule?.type === SAFETY_RULE_ID;
  // Under a rule, each episode's "points" is how many times it happened, so the bars and the column
  // both show that rule alone.
  const lines = (r: Row) =>
    rule ? r.perEpisode.map((e) => ({ ...e, points: bySafety ? e.safe : e.events.filter((x) => x.type === rule.type).length })) : r.perEpisode;
  const times = (r: Row) => lines(r).reduce((n, e) => n + e.points, 0);
  const score = (r: Row) => (rule ? times(r) : perEpisode ? r.avg : r.points);

  // The pick this page would help with: the next episode's. Open to you = who you could pick now;
  // Used = who the cycle and no-back-to-back rules hold back (the Pick page's own words).
  const pickEp = isPool && myPlayerId ? pickWindow(state).ep : null;
  const eligibility = pickEp && myPlayerId ? StateLogic.pickEmEligibility(state, pickEp.id, myPlayerId) : null;
  const shownPool: PoolWho = eligibility ? poolWho : "all";
  const poolHolds = (c: Castaway) => (shownPool === "open" ? eligibility!.available.includes(c.id) : shownPool === "used" ? !!eligibility!.blocked[c.id] : true);
  // Who to show, as one list: a pool's comes from your pick history, a roster game's from ownership.
  const whoChoices: { key: string; label: string; color?: string; pick: () => void }[] = eligibility
    ? [
        { key: "open", label: "Open to you", pick: () => setPoolWho("open") },
        { key: "used", label: "Used", pick: () => setPoolWho("used") },
        { key: "all", label: "Everyone", pick: () => setPoolWho("all") },
      ]
    : hasRoster
      ? [
          { key: "all", label: "Everyone", pick: () => setWho("all") },
          { key: "free", label: "Free agents", pick: () => setWho("free") },
          ...(myPlayerId ? [{ key: "mine", label: "Mine", pick: () => setWho("mine") }] : []),
          ...players
            .filter((p) => p.id !== myPlayerId)
            .map((p) => ({ key: `team:${p.id}`, label: `${p.name}’s team`, color: p.color, pick: () => setWho(`team:${p.id}`) })),
        ]
      : [];
  const whoKey = eligibility ? poolWho : team ? `team:${team.id}` : who;
  const shown = rows
    .filter((r) => (shownWho === "free" ? free(r.c) : shownWho === "mine" ? mine(r.c) : team ? r.c.ownerIds.includes(team.id) : true))
    .filter((r) => !tribe || r.c.tribeId === tribe.id)
    .filter((r) => !hideOut || r.c.status !== "eliminated")
    .filter((r) => poolHolds(r.c))
    .sort((a, b) => score(b) - score(a) || b.points - a.points || a.c.name.localeCompare(b.c.name));
  const epNumbers = rows[0]?.perEpisode.map((e) => e.n) ?? [];
  const range = epNumbers.length === 0 ? null : epNumbers.length === 1 ? `Ep ${epNumbers[0]}` : `Ep ${epNumbers[0]}–${epNumbers[epNumbers.length - 1]}`;
  const maxBar = Math.max(1, ...rows.flatMap((r) => lines(r).map((e) => Math.abs(e.points))));
  const bars = epNumbers.length >= 2;

  // Who's on your bench this week, for "Yours · bench".
  const ep = StateLogic.currentEpisode(state);
  const myLineup: string[] = ep && myPlayerId ? (StateLogic.activeRosterLineupFor(state, ep.id, myPlayerId) as string[]) : [];
  const ownerLine = (c: Castaway): ReactNode => {
    const tr = state.tribes.find((t) => t.id === c.tribeId);
    const tribeTag = tr && c.status !== "eliminated" ? (
      <span className="inline-flex items-center gap-1">
        <span className="size-2 rounded-full" style={{ background: tr.color }} aria-hidden />
        {tr.name}
      </span>
    ) : null;
    const withTribe = (n: ReactNode): ReactNode => (tribeTag ? <>{n} · {tribeTag}</> : n);
    if (c.status === "eliminated") {
      const exit = state.episodes.find((e) => e.events.some((x) => x.castawayId === c.id));
      return exit ? `Out · Episode ${exit.number}` : "Out";
    }
    if (!hasRoster) {
      const used = eligibility?.blocked[c.id];
      if (used) return used.reason === "backToBack" ? `Last pick · Ep ${used.episode}` : `Used Ep ${used.episode}`;
      return withTribe(eligibility?.available.includes(c.id) ? <span className="font-semibold text-good">Open to you</span> : "Still in");
    }
    if (free(c)) return withTribe(<span className="font-semibold text-good">Free agent</span>);
    // "bench" only once you've started someone: before that, nobody's on it yet.
    const yours = myLineup.length > 0 && !myLineup.includes(c.id) ? "Yours · bench" : "Yours";
    return withTribe(
      c.ownerIds
        .map((id) => (id === myPlayerId ? yours : StateLogic.getPlayer(state, id)?.name))
        .filter(Boolean)
        .join(", ")
    );
  };
  // "Scoring like starters" is a lineup idea: Active Roster only.
  const steals = StateLogic.getLeagueType(state).hasActiveRoster && (shownWho === "all" || shownWho === "free") ? freeAgentSteals(state, rows) : [];
  const open = openId ? rows.find((r) => r.c.id === openId) ?? null : null;

  const epName = (i: number) => String(allAired[i]?.number ?? "");
  const rangeLabel =
    allAired.length === 0 ? null : shownRange[0] === shownRange[1] ? `Ep ${epName(shownRange[0])}` : `Ep ${epName(shownRange[0])}–${epName(shownRange[1])}`;
  const whoLabel = whoChoices.find((c) => c.key === whoKey)?.label ?? whoChoices[0]?.label;
  // What the Filter bar says is showing: each filter in play, the ones you've changed in full ink.
  const summary: { text: string; changed: boolean; color?: string }[] = [
    ...(whoChoices.length > 1 ? [{ text: whoLabel!, changed: whoKey !== whoChoices[0].key, color: team?.color }] : []),
    ...(state.tribes.length > 0 ? [{ text: tribe ? tribe.name : `Any ${terms.tribe}`, changed: !!tribe, color: tribe?.color }] : []),
    ...(rangeLabel ? [{ text: rangeLabel, changed: !rangeIsDefault }] : []),
    ...(perEpisode ? [{ text: "Per episode", changed: true }] : []),
    ...(hideOut ? [{ text: "Out hidden", changed: true }] : []),
  ];
  const anyChanged = summary.some((s) => s.changed);
  const resetAll = () => {
    setRange(null);
    setTribeId(null);
    setPerEpisode(false);
    setHideOut(false);
    whoChoices[0]?.pick();
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="type-caption min-h-11 content-center text-[28px] max-nav:hidden">Research</h2>

      {/* One bar for every filter: it reads back what's showing, and opens them all in one sheet. */}
      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        className="flex min-h-12 w-full items-center gap-3 rounded-[3px] border border-border py-1.5 pr-1.5 pl-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-chyron-line"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {summary.map((s, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {s.color && <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: s.color }} aria-hidden />}
              <span className={cn(s.changed && "font-semibold text-foreground")}>{s.text}</span>
            </span>
          ))}
        </span>
        <span
          className={cn(
            "flex min-h-9 shrink-0 items-center gap-1.5 rounded-[2px] px-3 text-sm font-bold",
            anyChanged ? "bg-foreground text-background" : "bg-secondary text-foreground",
          )}
        >
          <SlidersHorizontal className="size-4" strokeWidth={2.4} aria-hidden />
          Filter
        </span>
      </button>

      {epNumbers.length === 0 ? (
        <p className="border-t border-border pt-3 text-base text-muted-foreground">
          Nothing scored yet. The ranking fills in as episodes are revealed.
        </p>
      ) : shown.length === 0 ? (
        <p className="border-t border-border pt-3 text-base text-muted-foreground">
          {shownWho === "free"
            ? `Every ${terms.castaway} is on someone's roster.`
            : shownPool === "used"
              ? `Nobody is held back for this pick.`
              : `No ${terms.castaways} here.`}
        </p>
      ) : (
        <div data-tour="research-list">
          {/* The header is the ranking control: what the right-hand column counts, tap to change it. */}
          <div className="flex min-h-11 items-center gap-3 text-[12px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            <RankedBy rules={rules} rule={rule} pointsLabel={perEpisode ? "Points per episode" : "Points"} onChange={setRankBy} className="flex-1" />
            {bars && <span className="shrink-0 text-center">{range}</span>}
            <span className="w-11 shrink-0 text-right">{bySafety ? "Safe" : rule ? "Times" : perEpisode ? "Avg" : "Pts"}</span>
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

      {/* Every filter in one sheet. Each applies as it changes (the list behind updates), so it closes
          with Done, not Cancel. */}
      <BottomSheet open={filterOpen} onOpenChange={setFilterOpen} title="Filter" hideCancel>
        <div className="flex flex-col gap-5">
          {allAired.length > 1 && (
            <FilterGroup title="Episodes" value={rangeLabel}>
              <RangeSlider
                label="Episodes"
                count={allAired.length}
                value={shownRange}
                onChange={setRange}
                stepLabel={epName}
                mark={startIdx > 0 ? { at: startIdx, caption: "League start" } : undefined}
              />
              {/* Earlier episodes scored for nobody, but they're still how someone played. */}
              {shownRange[0] < startIdx && (
                <p className="text-[13px] text-muted-foreground">
                  {startIdx - shownRange[0] === 1 ? `Episode ${epName(shownRange[0])} was` : `Episodes ${epName(shownRange[0])}–${epName(startIdx - 1)} were`} before
                  this league started: counted here, scored for nobody.
                </p>
              )}
            </FilterGroup>
          )}

          {whoChoices.length > 1 && (
            <FilterGroup title="Show">
              <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
                {whoChoices.map((c) => (
                  <FilterChip key={c.key} on={whoKey === c.key} onClick={c.pick}>
                    {c.color && <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: c.color }} aria-hidden />}
                    {c.label}
                  </FilterChip>
                ))}
              </div>
            </FilterGroup>
          )}

          {state.tribes.length > 0 && (
            <FilterGroup title={terms.tribe}>
              <div role="group" aria-label={terms.tribe} className="flex flex-wrap gap-2">
                <FilterChip on={!tribe} onClick={() => setTribeId(null)}>
                  Any {terms.tribe}
                </FilterChip>
                {state.tribes.map((t) => (
                  <FilterChip key={t.id} on={tribe?.id === t.id} onClick={() => setTribeId(t.id)}>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
                    {t.name}
                  </FilterChip>
                ))}
              </div>
            </FilterGroup>
          )}

          <div className="flex flex-col [&>*]:border-t [&>*]:border-border">
            <ToggleRow label="Rank by points per episode" hint="Fairer to someone who joined late or sat out" checked={perEpisode} onChange={setPerEpisode} />
            <ToggleRow label={`Hide ${terms.castaways} who are out`} checked={hideOut} onChange={setHideOut} />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {anyChanged && (
            <button type="button" onClick={resetAll} className="min-h-12 rounded-[3px] border border-border px-4 text-[15px] font-bold text-foreground">
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="min-h-12 flex-1 rounded-[3px] bg-foreground text-[15px] font-bold text-background"
          >
            {shown.length === 1 ? `Show 1 ${terms.castaway}` : `Show ${shown.length} ${terms.castaways}`}
          </button>
        </div>
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

/** One group in the Filter sheet: a small caps heading, with what it's set to on the right. */
function FilterGroup({ title, value, children }: { title: string; value?: string | null; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[12px] font-bold uppercase tracking-[0.05em] text-muted-foreground">{title}</h3>
        {value && <span className="type-num text-[17px] text-foreground">{value}</span>}
      </div>
      {children}
    </section>
  );
}

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
