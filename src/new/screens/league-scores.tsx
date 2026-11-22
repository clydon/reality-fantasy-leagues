"use client";

// A league's Scores (docs/PLAN-sports-couch.md B1, session 2; the design: docs/design-round/league-scores-spec.md, -first-view.md,
// -shape.md): the league's own front page, any week (football) or game day (the NBA, NHL, MLB, soccer) of its season, now by
// default. A sticky switcher under the league's bar, then the couch's games (solo: your teams') and every other game a day at a
// time, each the shared game row (the hub's scorebug, full width: sports/scorebug.tsx). Kickoff order everywhere, never by state,
// so where a game sits tells nothing to someone hiding scores. Finals show their score (the sports pages' rule, B1's decision 2);
// hidden, a game that has begun says Started, its eye asks, and one Show scores shows the chosen week's.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Eye } from "lucide-react";
import { useHome, useMySportsGames, useSportsRecordings, type WeekGame } from "../data";
import { SportsLabel } from "../sports/parts";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { AskSheet, bugStateOf, Scorebug, type Bug, type Fan } from "../sports/scorebug";
import { begun, showScore, useHideSports, useHideSportsKnown, useNow, useShownScores } from "../sports/scores";
import { LeagueDays, useLeagueWeek } from "../sports/sheets";
import { useTableTeams } from "./league-page";
import type { LeagueNow } from "@/lib/sports/league-now";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const md = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
const weekdayOf = (d: string) => WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()];
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const mondayOf = (d: string) => addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
/** Today in the East, as the league's days are (slate.ts). */
const eastToday = (now: number) => new Date(now).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
/** "Nov 19–24", "Nov 26–Dec 1". */
const spanOf = (from: string, to: string) => (from === to ? md(from) : from.slice(0, 7) === to.slice(0, 7) ? `${md(from)}–${Number(to.slice(8, 10))}` : `${md(from)}–${md(to)}`);
/** A playoff week as fans say it: "Divisional", "Conference" (the chip is 76 px). */
const shortWeek = (label: string) => label.replace(/ Round$/i, "").replace(/ Championship$/i, "").replace(/^Conference$/i, "Conference");

type Step = { key: string; label: string; sub: string; from: string; to: string; now: boolean };

/** The switcher's chips: a week-cut league's weeks, or a daily league's game days; and the one that's now. */
function stepsOf(lnow: LeagueNow, today: string): { steps: Step[]; current: string | null; byDay: boolean } {
  if (lnow.weeks.length) {
    const cur = lnow.weeks.find((w) => w.from === lnow.from) ?? lnow.weeks.find((w) => w.to >= today) ?? lnow.weeks[lnow.weeks.length - 1];
    return {
      steps: lnow.weeks.map((w) => ({ key: w.from, label: shortWeek(w.label), sub: spanOf(w.from, w.to), from: w.from, to: w.to, now: w === cur })),
      current: cur.from,
      byDay: false,
    };
  }
  if (lnow.days.length) {
    const cur = lnow.days.includes(today) ? today : (lnow.days.find((d) => d > today) ?? lnow.days[lnow.days.length - 1]);
    return { steps: lnow.days.map((d) => ({ key: d, label: weekdayOf(d), sub: md(d), from: d, to: d, now: d === cur })), current: cur, byDay: true };
  }
  return { steps: [], current: null, byDay: false };
}

export function LeagueScores({ league, name, lnow, loading }: { league: string; name: string; lnow: LeagueNow | null; loading: boolean }) {
  const now = useNow();
  const today = eastToday(now);
  const { steps, current, byDay } = useMemo(() => (lnow ? stepsOf(lnow, today) : { steps: [], current: null, byDay: false }), [lnow, today]);
  const [chosen, setChosen] = useState<string | null>(null);
  const key = chosen ?? current;
  const step = steps.find((s) => s.key === key) ?? null;

  if (!lnow) return loading ? <RowsLoading /> : <LeagueDays league={league} leagueName={name} />;
  // Off-season: the bar already says when it's back, so the tab says only what isn't here (the check: the line said twice).
  if (!lnow.on)
    return (
      <p data-scores-off className="mt-5 text-[15px] text-muted-foreground">
        No {name} games until the season starts.
      </p>
    );
  // A league with neither weeks nor game days listed (a tour's, a calendar the provider didn't give): the week from today.
  if (!steps.length || !step) return <LeagueDays league={league} leagueName={name} />;
  const i = steps.indexOf(step);
  return (
    <div data-league-scores={byDay ? "day" : "week"}>
      <Switcher steps={steps} chosen={step.key} byDay={byDay} onChoose={setChosen} away={step.key !== current} />
      <ScoresList key={step.key} league={league} step={step} next={steps[i + 1] ?? null} onNext={(k) => setChosen(k)} byDay={byDay} today={today} now={now} />
    </div>
  );
}

/** The weeks (or game days) as one scroller of chips, the chosen one marked by a foreground rule (the tab bar's form, not its
 *  yellow: the check, one yellow a view, kept for a move); away from now, This week (or Today) pinned at its end. */
function Switcher({ steps, chosen, byDay, onChoose, away }: { steps: Step[]; chosen: string; byDay: boolean; onChoose: (k: string | null) => void; away: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // Scrolled so the chosen chip sits second from the left (the one before it says there's a past), on open and on a jump back.
  useLayoutEffect(() => {
    const box = ref.current;
    const chip = box?.querySelector<HTMLElement>(`[data-step="${chosen}"]`);
    if (!box || !chip) return;
    if (chip.offsetLeft >= box.scrollLeft && chip.offsetLeft + chip.offsetWidth <= box.scrollLeft + box.clientWidth) return;
    box.scrollLeft = Math.max(0, chip.offsetLeft - chip.offsetWidth - 8);
  }, [chosen]);
  return (
    <div className="sticky top-[calc(var(--nd-top,0px)+var(--league-bar,96px))] z-10 -mx-4 flex items-stretch border-b border-border bg-background">
      <div
        ref={ref}
        role="group"
        aria-label={byDay ? "Game days" : "Weeks"}
        data-scores-switcher
        className="flex min-w-0 flex-1 snap-x gap-1 overflow-x-auto px-2 [scrollbar-width:none] [mask-image:linear-gradient(90deg,transparent,#000_10px,#000_calc(100%_-_20px),transparent)]"
      >
        {steps.map((s) => {
          const on = s.key === chosen;
          return (
            <button
              key={s.key}
              type="button"
              data-step={s.key}
              data-now={s.now || undefined}
              aria-pressed={on}
              aria-label={`${s.label}, ${s.now ? (byDay ? "today" : "this week") : s.sub}`}
              onClick={() => onChoose(s.key)}
              className={`relative flex h-14 flex-none snap-start flex-col items-center justify-center gap-[3px] rounded-[3px] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--foreground)] ${byDay ? "w-14" : "min-w-[78px] px-2.5"} ${on ? "text-foreground" : "text-muted-foreground"}`}
            >
              <span className="type-caption whitespace-nowrap text-[15px] leading-none tracking-[0.03em]">{s.label}</span>
              {/* Now's chip says so, lit only while chosen (the check: two chips looked chosen). */}
              <span className={`whitespace-nowrap text-[12px] leading-none ${s.now ? "font-bold" : ""}`}>{s.now ? (byDay ? "Today" : "This week") : s.sub}</span>
              {on && <i aria-hidden className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-[2px] bg-foreground" />}
            </button>
          );
        })}
      </div>
      {away && (
        <button
          type="button"
          data-scores-now
          onClick={() => onChoose(null)}
          className="nd-press flex flex-none items-center gap-0.5 border-l border-border pl-3 pr-3 text-[14px] font-semibold focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--foreground)]"
        >
          {byDay ? "Today" : "This week"}
          <ChevronRight className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** The chosen week's (or day's) games: the couch's first, then every other game a day at a time, each the shared game row. */
function ScoresList({ league, step, next, onNext, byDay, today, now }: { league: string; step: Step; next: Step | null; onNext: (k: string) => void; byDay: boolean; today: string; now: number }) {
  // A game day reads its Monday-to-Sunday week (one read a week, so the next chip in it is instant).
  const from = byDay ? mondayOf(step.from) : step.from;
  const to = byDay ? addDays(from, 6) : step.to;
  const week = useLeagueWeek(league, from, to);
  const home = useHome().data;
  const { teams, solo, meId } = useTableTeams(league);
  const mine = useMySportsGames(true).data?.games;
  const recordings = useSportsRecordings().data?.recordings;
  const hide = useHideSports();
  // Nothing drawn until Hide sports scores is known: a moment's open row would be a spoiler (scores.tsx useHideSportsKnown).
  const known = useHideSportsKnown();
  const shownNow = useShownScores();
  const [asking, setAsking] = useState<WeekGame | null>(null);
  const [showing, setShowing] = useState(false);

  const days = week.days.filter((d) => d.day >= step.from && d.day <= step.to);
  const games = days.flatMap((d) => d.games);
  const recorded = new Set((recordings ?? []).map((r) => r.game));
  const played = new Map((mine ?? []).filter((m) => m.league === league).map((m) => [m.event, m]));
  const fansBy = new Map(teams.map((t) => [t.id, t.followers as Fan[]]));
  const hiddenOf = (g: WeekGame) => recorded.has(g.id) || (hide && !shownNow.has(g.id));
  const bugOf = (g: WeekGame): Bug => {
    const p = played.get(g.id) ?? null;
    const due = !!p && !!home?.moves.some((m) => m.leagueId === p.leagueId && (m.episode == null || m.episode === p.episode));
    return { g, bucket: bugStateOf(g, hiddenOf(g), now), fans: [fansBy.get(g.sides[0].id) ?? [], fansBy.get(g.sides[1].id) ?? []], played: p, due };
  };
  const ours = (g: WeekGame) => played.has(g.id) || g.sides.some((s) => fansBy.has(s.id));
  const couch = games.filter(ours);
  // Hidden games that have begun (not ones you're watching as if live: those wait for "I've watched it").
  const hiddenBegun = games.filter((g) => begun(g, now) && !recorded.has(g.id) && hide && !shownNow.has(g.id));
  const label = byDay ? (step.from === today ? "today" : `${weekdayOf(step.from)} ${md(step.from)}`) : step.label;

  // `dated`: a row outside the day headings (the couch's games, in a week) says its day (the check: "2:39 PM" with no day).
  const row = (g: WeekGame, dated = false) => (
    <li key={g.id}>
      <Scorebug bug={bugOf(g)} meId={meId} now={now} onAsk={() => setAsking(g)} wide grouped={!dated} finalsOpen pollOnScreen />
    </li>
  );
  const dayName = (d: string) => `${d === today ? "Today · " : ""}${new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: d === today ? "short" : "long", month: "short", day: "numeric" })}`;

  return (
    <div data-scores-list={step.key}>
      {/* Hiding scores: one way to show the chosen week's, which asks first (the check: one tap showed a week for good). */}
      {known && hiddenBegun.length > 0 && (
        <button
          type="button"
          data-show-scores
          onClick={() => setShowing(true)}
          className="nd-press mt-3 inline-flex h-11 items-center gap-1.5 rounded-[4px] px-3 text-[14px] font-semibold outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <Eye className="size-4" aria-hidden /> Show scores
        </button>
      )}
      {!known || (week.loading && !games.length) ? (
        <RowsLoading />
      ) : week.error && !games.length ? (
        <p data-scores-failed className="mt-5 flex flex-wrap items-center gap-x-2 text-[14px] text-muted-foreground">
          {byDay ? "This day's games didn't load." : `${step.label}'s games didn't load.`}
          <button type="button" onClick={() => void week.refetch()} className="nd-press inline-flex h-11 items-center font-semibold text-foreground underline underline-offset-[3px]">
            Try again
          </button>
        </p>
      ) : !games.length ? (
        <p data-scores-empty className="mt-5 flex flex-wrap items-center gap-x-2 text-[14px] text-muted-foreground">
          {step.to < today ? `No games ${byDay ? "on " : "in "}${label}.` : `No games listed for ${label} yet.`}
          {next && (
            <button type="button" data-scores-next onClick={() => onNext(next.key)} className="nd-press inline-flex h-11 items-center gap-0.5 font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-foreground">
              {byDay ? `${weekdayOf(next.from)} ${md(next.from)}` : next.label} <ChevronRight className="size-4" aria-hidden />
            </button>
          )}
        </p>
      ) : (
        <>
          {couch.length > 0 && (
            <section data-scores-couch={couch.length}>
              <SportsLabel>{solo ? "Your teams’ games" : "The couch’s games"}</SportsLabel>
              <ul className="flex flex-col gap-2">{couch.map((g) => row(g, !byDay))}</ul>
            </section>
          )}
          {days.map((d) => {
            const rest = d.games.filter((g) => !ours(g));
            if (!rest.length) return null;
            return (
              <section key={d.day} data-scores-day={d.day}>
                <SportsLabel>{couch.length && byDay ? "Every other game" : dayName(d.day)}</SportsLabel>
                <ul className="flex flex-col gap-2">{rest.map((g) => row(g))}</ul>
              </section>
            );
          })}
        </>
      )}
      <AskSheet g={asking} onClose={() => setAsking(null)} />
      <Sheet open={showing} onOpenChange={setShowing} title={`Show ${byDay ? (step.from === today ? "today's" : `${weekdayOf(step.from)}'s`) : `${step.label}'s`} scores?`} subtitle={`${hiddenBegun.length} ${hiddenBegun.length === 1 ? "game has" : "games have"} started`}>
        <div data-show-scores-ask className="flex flex-col gap-2.5 pb-1">
          <Btn
            tone="ink"
            wide
            data-show-scores-yes
            onClick={() => {
              setShowing(false);
              hiddenBegun.forEach((g) => showScore(g.id, league));
            }}
          >
            Show {hiddenBegun.length === 1 ? "the score" : `all ${hiddenBegun.length}`}
          </Btn>
          <Btn wide data-show-scores-no onClick={() => setShowing(false)}>
            Keep hiding
          </Btn>
          {/* What it moves, as the one game's Show the score says it. */}
          <p className="text-[14px] leading-snug text-muted-foreground">
            They show everywhere until you close the app, and how far you&rsquo;ve watched moves to {byDay ? "this day" : "this week"} on every season you follow with them.
            To watch one as if live instead, tap its eye.
          </p>
        </div>
      </Sheet>
    </div>
  );
}

function RowsLoading() {
  return (
    <div aria-busy aria-label="Loading games" className="mt-6 flex animate-pulse flex-col gap-2 motion-reduce:animate-none">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[72px] rounded-[3px] bg-secondary" />
      ))}
    </div>
  );
}
