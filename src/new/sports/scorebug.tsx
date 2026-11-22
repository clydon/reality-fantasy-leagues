"use client";

// The shared game row (docs/design-round/league-scores-spec.md, "The shared game row"; round 1's first-view R3: one game row
// everywhere): a game as a broadcast scorebug, the hub's scores strip's (A1, docs/design-round/hub-scorebug-shape.md) and a league's
// Scores tab's (B1). On the strip it's a 208 × 72 bug with the teams' codes; full width (`wide`) it names the teams. Its ask sheet
// (Show the score, or Watch it as if live) moved here with it.
//
// Nothing here tells a game to someone it's hidden from (Sports scores too, or watching it as if live: hide.ts's rule, the user's
// 2026-11-09 call): a hidden game that has begun says "Started" and its time, never live or final, a clock, a score or a record.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, Gamepad2, Tv } from "lucide-react";
import { useLiveNow, useSetRecording, useSportsRecordings, type WeekGame } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { teamBg } from "./parts";
import { clockOf, dayOf, noteSeen, showScore, useGameScore, useHideSports, useHideSportsKnown, useShownScores } from "./scores";
import { openSports } from "./sheets";
import type { StripBucket } from "@/lib/sports/strip";

export type Fan = { id: string; name: string };
export type Played = { seasonId: string; episode: number; leagueId: string; pick: string | null };
/** A game's state for its bug: the strip's buckets (strip.ts), and "called" (postponed or canceled: a list shows those too). */
export type BugState = StripBucket | "called";
export type Bug = { g: WeekGame; bucket: BugState; fans: [Fan[], Fan[]]; played: Played | null; due: boolean };

/** A game's state for a list that shows every game (a league's Scores): its bucket, never by anything hidden from you. */
export function bugStateOf(g: WeekGame, hidden: boolean, now: number): BugState {
  if (g.called && g.called !== "suspended") return "called";
  const begun = g.state !== "pre" || (!!g.at && Date.parse(g.at) <= now);
  // To come: today's says its time; a later day's (a bug outside a day's heading) its day too.
  if (!begun) return g.at && dayOf(g.at, now) !== "Today" ? "next" : "today";
  if (hidden) return "started";
  return g.state === "post" || g.final ? "final" : "live";
}

/** Whether an element is on screen (a live row polls only then). */
function useOnScreen<T extends Element>(on: boolean) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: "40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [on]);
  return [ref, seen] as const;
}

const SPORT = (league: string) => league.split("/")[0];
const ORD = ["", "first", "second", "third", "fourth"];

/** The period as a scorebug writes it: Q3, P2, OT, Half; ESPN's own words where the sport has no short form yet (A1b). */
function periodOf(league: string, period: number | null, half: boolean, detail: string | null): { short: string; words: string } {
  const sport = SPORT(league);
  if (half) return { short: "Half", words: "halftime" };
  if (period != null && (sport === "football" || sport === "basketball")) {
    return period <= 4 ? { short: `Q${period}`, words: `${ORD[period]} quarter` } : { short: period === 5 ? "OT" : `${period - 4}OT`, words: "overtime" };
  }
  if (period != null && sport === "hockey") return period <= 3 ? { short: `P${period}`, words: `${ORD[period]} period` } : { short: "OT", words: "overtime" };
  const d = (detail ?? "").split(" - ").pop() ?? "";
  return { short: d.slice(0, 6) || "Live", words: detail ?? "on now" };
}

/** "2nd & 7" in words for a screen reader. */
const downWords = (d: string) => d.replace("&", "and");

/**
 * A game as a broadcast scorebug (72 px tall): two team rows (the team's colour as a slab, its abbreviation or, `wide`, its name, up
 * to two couch faces of who follows it, the score or, before it, the record) and a status column behind a hairline that speaks the
 * game's state. Live wears the one live-red rule; your pick is the chyron underline; a move due, the chyron dot. A hidden game
 * shows no numbers, only Show (or Watching), and a tap asks before anything shows.
 *
 * `grouped`: in a list under day headings (a league's Scores), a game to come says its time, never its day again, and a final
 * says Final alone. `finalsOpen`: a final shows its score unless hidden (the sports pages' rule: B1's decision 2); without it, a
 * final asks first (the hub's: A1). `pollOnScreen`: a live game asks for its clock only while on screen (a list of many).
 */
export function Scorebug({
  bug,
  meId,
  now,
  onAsk,
  wide,
  onOpened,
  grouped,
  finalsOpen,
  pollOnScreen,
}: {
  bug: Bug;
  meId: string;
  now: number;
  onAsk: () => void;
  wide?: boolean;
  onOpened?: () => void;
  grouped?: boolean;
  finalsOpen?: boolean;
  pollOnScreen?: boolean;
}) {
  const { g, bucket, fans, played, due } = bug;
  const s = useGameScore(g);
  const shownNow = useShownScores();
  const hide = useHideSports();
  const known = useHideSportsKnown();
  const live = bucket === "live";
  const [ref, onScreen] = useOnScreen<HTMLElement>(!!pollOnScreen && live);
  const on = useLiveNow(g.league, g.id, known && live && s.open && !s.recording && (!pollOnScreen || onScreen)).data;
  // Watching it live here is seeing it: its final shows straight away this visit, and a later visit is done with it. Only once
  // Hide sports scores is known: before it, a hidden game looks open for a moment, and marking it seen would let it out for good.
  useEffect(() => {
    if (known && live && s.open && !s.recording) noteSeen(g.id);
  }, [known, live, s.open, s.recording, g.id]);
  const situation = on && on.status === "in" ? on : null;
  const final = bucket === "final";
  // A final shows its score once you've chosen (Show the score, or seen it live), or straight away on a sports page; a hidden game
  // never.
  const scored = (live || (final && (finalsOpen || shownNow.has(g.id)))) && s.open && !s.recording;
  const ask = bucket === "started" || (final && !scored);
  const scoreOf = (i: number) => (situation ? String(situation.scores[g.sides[i].id] ?? g.sides[i].score ?? 0) : (g.sides[i].score ?? "0"));
  const nums = scored ? [Number(scoreOf(0)), Number(scoreOf(1))] : null;
  const lead = nums ? (nums[0] > nums[1] ? 0 : nums[1] > nums[0] ? 1 : -1) : -1;
  const possession = scored && live ? (situation?.possession ?? null) : null;
  const down = scored && live ? (situation?.down ?? null) : null;
  const clock = situation ? { period: situation.period, display: situation.clock, detail: situation.detail, half: situation.half } : g.clock;
  const period = periodOf(g.league, clock?.period ?? null, !!clock?.half, clock?.detail ?? null);
  const records = !hide && (bucket === "today" || bucket === "next");
  const today = g.at ? dayOf(g.at, now) === "Today" : false;
  const time = g.at ? clockOf(g.at) : "";
  const [hm, ampm] = time.split(" ");
  const day = g.at ? new Date(g.at) : null;
  const pick = played?.pick ?? null;
  // The status column's small lines: 12 px (on the strip the line 11.5: it's the longest, "JAX by 6.5", in 66 px; full width the
  // column is 78 px, so it and AM/PM keep the 12 px floor: the Scores check), muted on the raised panel.
  const small = "whitespace-nowrap text-[12px] leading-tight text-muted-foreground";
  const tiny = wide ? "text-[12px]" : "text-[11.5px]";

  // The status column, by state.
  let status: ReactNode;
  let said: string;
  if (live && scored) {
    status = (
      <>
        <b className="type-caption flex items-center gap-1 text-[17px] leading-none">
          <i className="size-1.5 flex-none animate-pulse rounded-full bg-live motion-reduce:animate-none" aria-hidden />
          {period.short}
        </b>
        {clock?.display && !clock.half && <span className="type-num text-[14px] font-bold leading-tight">{clock.display}</span>}
        {down && <small className={small}>{down}</small>}
      </>
    );
    said = `${period.words}${clock?.display && !clock.half ? `, ${clock.display}` : ""}`;
  } else if (bucket === "started" || (live && !scored)) {
    // Hidden: only that it started, and when (hide.ts). Watching it as if live says so instead.
    status = (
      <>
        <b className="type-caption text-[15px] leading-none text-muted-foreground">{s.recording ? "Watching" : "Started"}</b>
        <span className="type-num text-[12.5px] font-bold leading-tight">{!g.at ? "" : today || grouped ? time : dayOf(g.at, now).replace(/,.*/, "")}</span>
      </>
    );
    said = s.when;
  } else if (bucket === "called") {
    // Postponed or canceled: never played, so saying so gives nothing away (hide.ts).
    status = <b className="type-caption text-[14px] leading-none text-muted-foreground">{g.called === "canceled" ? "Canceled" : "Postponed"}</b>;
    said = g.called === "canceled" ? "canceled" : "postponed";
  } else if (final) {
    status = (
      <>
        <b className="type-caption text-[17px] leading-none">Final</b>
        {!today && !grouped && g.at && <small className={small}>{dayOf(g.at, now).replace(/,.*/, "")}</small>}
      </>
    );
    said = "final";
  } else if (bucket === "today" || grouped) {
    status = (
      <>
        <b className="type-num whitespace-nowrap text-[17px] font-extrabold leading-none">
          {hm || "TBD"}
          {ampm && <span className={`ml-0.5 font-bold ${wide ? "text-[12px]" : "text-[11px]"}`}>{ampm}</span>}
        </b>
        {g.network && <small className={small}>{g.network}</small>}
        {g.line && (
          <small data-bug-line className={`${small} ${tiny}`}>
            {g.line}
          </small>
        )}
      </>
    );
    said = `${time || "time to be set"}${g.network ? ` on ${g.network}` : ""}${g.line ? `. ${g.line}` : ""}`;
  } else {
    status = (
      <>
        <b className="type-caption text-[17px] leading-none">{day ? dayOf(g.at!, now).replace(/,.*/, "") : "TBD"}</b>
        {day && <span className="type-num whitespace-nowrap text-[13px] font-bold leading-tight">{day.toLocaleDateString([], { month: "short", day: "numeric" })}</span>}
        {time && <small className={small}>{time}</small>}
      </>
    );
    said = `${day ? day.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "time to be set"}${time ? `, ${time}` : ""}${g.network ? ` on ${g.network}` : ""}${g.line ? `. ${g.line}` : ""}`;
  }

  const [away, homeSide] = g.sides;
  const ball = possession ? g.sides.find((x) => x.id === possession) : null;
  const pickName = pick ? g.sides.find((x) => x.id === pick)?.short : null;
  // Whose team it is, which the faces say to the eye ("Eagles: you; Jets: Riley").
  const whose = g.sides
    .map((x, i) => {
      const f = fans[i];
      if (!f.length) return null;
      const names = f.slice(0, 2).map((p) => (p.id === meId ? "you" : p.name));
      return `${x.short}: ${names.join(" and ")}`;
    })
    .filter(Boolean)
    .join("; ");
  const label = [
    `${away.short} at ${homeSide.short}`,
    nums ? `${nums[0]} to ${nums[1]}` : null,
    said,
    ball ? `${ball.short}' ball` : null,
    down ? downWords(down) : null,
    ask ? (s.recording ? "you're watching it as if live: choose before anything shows" : "its score is hidden: choose before it shows") : null,
  ]
    .filter(Boolean)
    .join(", ")
    .concat(whose ? `. Following: ${whose}` : "")
    .concat(pickName ? `. Your pick: ${pickName}.` : due ? ". Your pick is due." : ".");

  const rows = g.sides.map((x, i) => {
    const down_ = nums && lead !== -1 && lead !== i;
    return (
      <span key={x.id} className="flex h-7 min-w-0 items-center gap-[7px]">
        {/* The team's colour as a slab (a tag, never a fill), its edge from the foreground so a pale colour holds on Studio too. */}
        <i
          aria-hidden
          className="h-[22px] w-1 flex-none rounded-r-[2px] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_22%,transparent)]"
          style={{ background: teamBg(x.color) }}
        />
        <b
          data-bug-pick={pick === x.id || undefined}
          className={`type-caption min-w-0 truncate pb-0.5 text-[18px] leading-none tracking-[0.03em] ${pick === x.id ? "shadow-[inset_0_-2px_0_var(--chyron-line)]" : ""} ${down_ ? "text-muted-foreground" : ""}`}
        >
          {wide ? x.short : (x.abbreviation ?? x.short).slice(0, 4)}
        </b>
        <span className="flex flex-none" aria-hidden>
          {fans[i].slice(0, 2).map((f, k) => (
            <span
              key={f.id}
              data-bug-face={f.id === meId ? "you" : f.name}
              // Yours ringed, as the bands' faces are.
              className={`rounded-[3px] ${f.id === meId ? "outline-[1.5px] outline-offset-1 outline-foreground" : "shadow-[0_0_0_1.5px_var(--secondary)]"} ${k ? "-ml-[3px]" : ""}`}
            >
              <Avatar id={f.id} name={f.name} size={16} />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1" />
        {possession === x.id && <i data-bug-ball aria-hidden className="size-0 flex-none border-y-4 border-l-[6px] border-y-transparent border-l-foreground" />}
        {nums ? (
          <b className={`type-num min-w-6 flex-none text-right text-[26px] leading-none ${down_ ? "text-muted-foreground" : ""}`}>{nums[i]}</b>
        ) : records && x.record ? (
          <span className="type-num flex-none text-[13px] font-semibold text-muted-foreground">{x.record}</span>
        ) : null}
      </span>
    );
  });

  const className = `nd-press relative grid h-[72px] flex-none snap-start ${wide ? "grid-cols-[minmax(0,1fr)_78px]" : "grid-cols-[minmax(0,1fr)_66px]"} overflow-hidden rounded-[3px] bg-secondary text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--foreground)] ${wide ? "w-full" : "w-[208px]"}`;
  const body = (
    <>
      {live && scored && <i aria-hidden data-bug-live className="absolute inset-x-0 top-0 h-0.5 bg-live" />}
      <span className="relative flex min-w-0 flex-col justify-center gap-0.5 pr-2">
        {rows}
        {/* Where the scores would be: an eye (Show) or a TV (watching as if live), clear of the faces; the status column says which. */}
        {ask && (
          <span
            data-bug-ask={s.recording ? "watching" : "show"}
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[4px] bg-secondary outline-[1.5px] -outline-offset-[1.5px] outline-edge"
          >
            {s.recording ? <Tv className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </span>
        )}
      </span>
      {/* A game you play: the controller in the status column's corner (the content moved down clear of it), its chyron dot while a
          move is due. */}
      <span className={`flex min-w-0 flex-col items-center justify-center gap-0.5 border-l border-border px-0.5 text-center ${played ? "pt-3.5" : ""}`}>{status}</span>
      {played && (
        <span data-bug-game={due ? "due" : "on"} aria-hidden className="absolute right-[5px] top-[4px] text-muted-foreground">
          <Gamepad2 className="size-[13px]" strokeWidth={2.4} />
          {due && <i className="absolute -right-[3px] -top-[3px] size-[7px] rounded-full bg-chyron-line shadow-[0_0_0_1.5px_var(--secondary)]" />}
        </span>
      )}
    </>
  );
  const data = { "data-bug": g.id, "data-bucket": bucket, "data-due": due || undefined, "aria-label": label };
  if (ask) {
    return (
      <button type="button" ref={ref as React.Ref<HTMLButtonElement>} {...data} onClick={onAsk} className={className}>
        {body}
      </button>
    );
  }
  if (played) {
    return (
      <NavLink href={paths.show(played.seasonId)} channel {...data} onClick={onOpened} className={className}>
        {body}
      </NavLink>
    );
  }
  const team = g.sides.find((x) => fans[g.sides.indexOf(x)].some((f) => f.id === meId)) ?? homeSide;
  return (
    <button
      type="button"
      ref={ref as React.Ref<HTMLButtonElement>}
      {...data}
      onClick={() => (onOpened?.(), openSports({ kind: "game", league: g.league, team: team.id, game: g.id }))}
      className={className}
    >
      {body}
    </button>
  );
}

/**
 * Before a hidden score shows (the user, 2026-11-15: "still not wanting any spoilers, have the option prompted to me to watch
 * live"): Show the score, or Watch it as if live (kept with your account: it says Started everywhere until you've watched it); a
 * game you're watching asks I've watched it or Keep hiding. Moved here from the Scoreboard that sat in Your shows.
 */
export function AskSheet({ g, onClose }: { g: WeekGame | null; onClose: () => void }) {
  const recordings = useSportsRecordings().data?.recordings;
  const setRecording = useSetRecording();
  const recording = !!g && !!recordings?.some((r) => r.game === g.id);
  const hide = useHideSports();
  const name = g ? `${g.sides[0].short} at ${g.sides[1].short}` : "";
  return (
    <Sheet open={!!g} onOpenChange={(o) => !o && onClose()} title={name} subtitle={recording ? "You're watching it as if live" : hide ? "The score is hidden" : "You haven't seen how it ended"}>
      {g && (
        <div data-score-ask={g.id} className="flex flex-col gap-2.5 pb-1">
          {recording ? (
            <>
              <Btn
                tone="ink"
                wide
                data-recording-done
                onClick={() => {
                  onClose();
                  showScore(g.id, g.league);
                  void setRecording(g.id, g.league, false);
                }}
              >
                I&rsquo;ve watched it
              </Btn>
              <Btn wide data-recording-keep onClick={onClose}>
                Keep hiding
              </Btn>
            </>
          ) : (
            <>
              <Btn
                tone="ink"
                wide
                data-recording-start
                onClick={() => {
                  onClose();
                  void setRecording(g.id, g.league, true);
                }}
              >
                <Tv className="size-5" aria-hidden />
                Watch it as if live
              </Btn>
              <Btn
                wide
                data-show-fresh
                onClick={() => {
                  onClose();
                  showScore(g.id, g.league);
                }}
              >
                Show the score
              </Btn>
              {/* Settings Round 2: what each one moves, in a line (Show the score moves your mark for the game's whole week). */}
              <p className="text-[14px] leading-snug text-muted-foreground">
                Watching as if live keeps it saying &ldquo;Started&rdquo; everywhere, on every device, until you say you&rsquo;ve watched it. Show the score shows it now and moves
                how far you&rsquo;ve watched to its week, on every season you follow with it.
              </p>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
