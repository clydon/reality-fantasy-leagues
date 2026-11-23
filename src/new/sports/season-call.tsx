"use client";

// The season call (docs/PLAN-sports-couch.md C4; the design: docs/design-round/solo-fan-spec.md (Intent), -first-view.md (PFD),
// -shape.md (Impeccable)). "Lions finish 12–4–1": one call a fan a team a season, pinned to the record it was made at. A row on the
// team's page under the call (none yet: the record now and Call the season; called: the record called, at what, and a track of the
// games it covers; settled: the record it finished and Spot on or Off by 1), and the sheet that makes it: the record now, a stepper
// whose figure is the season's record it makes, the games left as a track filled by the call (the call drawn, not described), one
// call a season, Call it. Never the page's yellow on the row; the sheet's one yellow is Call it.
//
// Hide sports scores: the called record stays (made before anything happened); how it's going and how it finished wait for Show the
// season, as the page's other records do.

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useOwnPick } from "../data";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { TeamMark } from "./parts";
import { teamKeyOf } from "@/lib/sports/team-badge";
import { paceWins, recordWords, recordOf, seasonCallState, type SeasonCall, type SeasonGame } from "@/lib/sports/own-calls";

type TeamLite = { id: string; short: string; abbreviation: string | null; color: string | null };

/** A season's games laid flat: one segment a game, won teal, lost a muted fill, tied half, to come hollow (called wins: ink). */
function Track({ cells, label }: { cells: ("W" | "L" | "T" | "open" | "call" | "rest")[]; label: string }) {
  return (
    <span role="img" aria-label={label} data-season-track className="mt-2 flex h-1.5 w-full gap-[3px]">
      {cells.map((c, i) => (
        <i
          key={i}
          data-cell={c}
          className={`block h-full min-w-0 flex-1 rounded-[1px] ${
            c === "W"
              ? "bg-(--nd-good)"
              : c === "L"
                ? "bg-muted-foreground opacity-45"
                : c === "T"
                  ? "bg-[linear-gradient(to_right,var(--nd-good)_50%,transparent_50%)] outline-1 -outline-offset-1 outline-muted-foreground"
                  : c === "call"
                    ? "bg-foreground motion-safe:transition-colors motion-safe:duration-150"
                    : "outline-1 -outline-offset-1 outline-edge"
          }`}
        />
      ))}
    </span>
  );
}

/** The season call's row on a team's page: none yet, called, or settled. */
export function SeasonCallRow(p: {
  league: string;
  team: TeamLite;
  season: SeasonGame[];
  call: SeasonCall | null;
  /** The page's results are shown (hiding sports scores: how it's going waits). */
  told: boolean;
  now: number;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const left = p.season.filter((g) => !g.result && !g.off && (!g.at || Date.parse(g.at) > p.now));
  const record = recordOf(p.season);
  if (p.loading) return <div data-season-call="loading" className="mt-4 h-[58px] animate-pulse rounded-[4px] bg-card" />;
  if (!p.call && !left.length) return null;
  if (!p.call) {
    return (
      <div data-season-call="none" className="mt-4 flex items-center gap-3 border-t border-border pt-3">
        {/* The record is the head's and the season chart's just below: the row asks the question (the check). */}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug">Where do they finish?</span>
          <span className="block text-[13px] text-muted-foreground">
            {left.length} {left.length === 1 ? "game" : "games"} left · one call a season
          </span>
        </span>
        <button
          type="button"
          data-season-call-open
          onClick={() => setOpen(true)}
          className="nd-press inline-flex h-11 flex-none items-center rounded-[4px] px-3.5 text-[14px] font-semibold outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Call the season
        </button>
        <SeasonCallSheet open={open} onOpenChange={setOpen} league={p.league} team={p.team} record={p.told ? record : null} left={left.length} />
      </div>
    );
  }
  const st = seasonCallState(p.call, p.season);
  const cells = p.season
    .filter((g) => p.call!.games.includes(g.id) && !g.off)
    .map((g) => (p.told && g.result ? g.result : "open") as "W" | "L" | "T" | "open");
  return (
    <div data-season-call={st.settled && p.told ? "settled" : "called"} className="mt-4 border-t border-border pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[13px] text-muted-foreground">{st.settled && p.told ? "You called" : "Your season call"}</span>
          {/* Hidden: the wins called over the games left, never a record (the record it was made at is a result). */}
          <span data-season-called className="type-num text-[22px] leading-none">{p.told ? recordWords(st.called) : `${p.call.wins} of ${st.count}`}</span>
        </span>
        {st.settled && p.told ? (
          <span data-season-verdict className="type-caption flex-none text-[19px] leading-tight tracking-[0.01em]">
            {st.off === 0 ? "Spot on" : `Off by ${Math.abs(st.off ?? 0)}`}
          </span>
        ) : null}
      </div>
      <p data-season-line className="mt-1 text-[13px] text-muted-foreground">
        {st.settled && p.told
          ? `Finished ${recordWords(st.finished)} · called at ${recordWords(st.at)}`
          : p.told
            ? `At ${recordWords(st.at)} · needs ${p.call.wins} of ${st.count}, has ${st.so.w}`
            : "wins in the games left · how it's going is hidden"}
      </p>
      {p.told && <Track cells={cells} label={`${st.so.w} won, ${st.so.l} lost, ${st.left} to play of the ${st.count} it covers`} />}
    </div>
  );
}

/** Call the season: the record now, a stepper whose figure is the season's record it makes, the games left filled by the call. */
export function SeasonCallSheet(p: { open: boolean; onOpenChange: (o: boolean) => void; league: string; team: TeamLite; record: { w: number; l: number; t: number } | null; left: number }) {
  const rec = p.record ?? { w: 0, l: 0, t: 0 };
  const [wins, setWins] = useState(() => paceWins(rec, p.left));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const pick = useOwnPick(p.league);
  const called = { w: rec.w + wins, l: rec.l + (p.left - wins), t: rec.t };
  const save = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await pick({ team: p.team.id, wins });
      p.onOpenChange(false);
    } catch (e) {
      setFailed((e as Error).message || "Didn’t save · Try again");
    } finally {
      setBusy(false);
    }
  };
  const step = "nd-press flex size-12 flex-none items-center justify-center rounded-full outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-35";
  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange} title="Call the season" subtitle={p.team.short}>
      <div data-season-sheet className="flex flex-col pb-2">
        <div className="flex items-center gap-2">
          <TeamMark abbr={p.team.abbreviation ?? p.team.short.slice(0, 3)} color={p.team.color} size="xs" team={teamKeyOf(p.league, p.team.id)} />
          <span className="text-[15px] font-semibold">
            {p.team.short}
            {p.record ? <span className="type-num ml-1.5 text-[16px]">{recordWords(rec)}</span> : null}
          </span>
          <span className="text-[13px] text-muted-foreground">· {p.left} {p.left === 1 ? "game" : "games"} left</span>
        </div>
        <div className="mt-6 flex items-center justify-center gap-5" role="group" aria-label="How many more wins">
          <button type="button" data-season-less aria-label="One fewer win" disabled={wins <= 0} onClick={() => setWins((n) => Math.max(0, n - 1))} className={step}>
            <Minus className="size-5" aria-hidden />
          </button>
          <span className="flex min-w-[8.5rem] flex-col items-center">
            <span data-season-figure aria-live="polite" className="type-num text-[44px] leading-none">
              {p.record ? recordWords(called) : `${wins}–${p.left - wins}`}
            </span>
            <span className="mt-1.5 text-[13px] text-muted-foreground">
              {wins} more {wins === 1 ? "win" : "wins"} of {p.left}
            </span>
          </span>
          <button type="button" data-season-more aria-label="One more win" disabled={wins >= p.left} onClick={() => setWins((n) => Math.min(p.left, n + 1))} className={step}>
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
        <span className="mt-5">
          <Track cells={Array.from({ length: p.left }, (_, i) => (i < wins ? "call" : "rest"))} label={`${wins} of the ${p.left} games left called as wins`} />
        </span>
        <p className="mt-4 text-[13px] text-muted-foreground">One call a season. It&rsquo;s pinned once their next game starts.</p>
        <Btn tone="must" wide data-season-call-it disabled={busy} onClick={() => void save()} className="mt-4">
          {busy ? "Calling…" : "Call it"}
        </Btn>
        {failed && (
          <p role="alert" className="mt-2 text-[13px] font-semibold">
            {failed}
          </p>
        )}
      </div>
    </Sheet>
  );
}
