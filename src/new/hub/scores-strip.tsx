"use client";

// The hub's scores strip (docs/PLAN-sports-couch.md A1; the shape: docs/design-round/hub-scorebug-shape.md, idea round 3): your
// games, live and coming up, right under the guide bar and at its exact height (88 px), never taller. Its form is the guide bar's
// own: a slanted lead tile ("Scores", the live count and the total) and a row of broadcast scorebugs that scroll-snap behind its
// slant, the next one peeking under a fade, swiped by hand (nothing moves by itself: the user, 2026-11-15). It replaces the
// Scoreboard that sat inside Your shows and the sports cards in On TV's reel, so a game is on the hub once.
//
// Which games and their order are strip.ts's (yours only: your teams' and the games you play). Nothing here tells a game to
// someone it's hidden from (Sports scores too, or watching it as if live: hide.ts's rule, the user's 2026-11-09 call): a hidden
// game that has begun says "Started" and its time, never live or final, a clock, a score or a record; a tap asks first.

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Eye, Gamepad2, Tv } from "lucide-react";
import {
  useCouchTeams,
  useLiveNow,
  useMySportsGames,
  useSetRecording,
  useSportsRecordings,
  useSportsWeek,
  useYourTeams,
  type Couch,
  type Home,
  type WeekGame,
} from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { teamBg } from "../sports/parts";
import { clockOf, dayOf, noteSeen, seenBefore, showScore, useGameScore, useHideSports, useNow, useShownScores } from "../sports/scores";
import { openSports } from "../sports/sheets";
import { needsLaterWeek, stripGames, type StripBucket } from "@/lib/sports/strip";

type Fan = { id: string; name: string };
type Played = { seasonId: string; episode: number; leagueId: string; pick: string | null };
type Bug = { g: WeekGame; bucket: StripBucket; fans: [Fan[], Fan[]]; played: Played | null; due: boolean };

const localDay = (at: string | number) => new Date(at).toLocaleDateString("en-CA");
const plusDays = (now: number, n: number) => localDay(now + n * 86_400_000);

/** The strip's games: yours (your teams' and the games you play), from the couch's teams or, solo, your own follows. */
function useStripGames(home: Home, couch: Couch | null) {
  const now = useNow();
  const couchTeams = useCouchTeams(couch?.id ?? null).data?.teams;
  const ownTeams = useYourTeams(!couch).data?.teams;
  const me = { id: home.user.id, name: home.user.name };
  const teams = useMemo(
    () => (couch ? (couchTeams ?? []) : (ownTeams ?? []).map((t) => ({ ...t, followers: [me], you: true, plays: false }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [couch, couchTeams, ownTeams, me.id]
  );
  const mine = useMySportsGames(true).data?.games;
  const yours = useMemo(() => new Set(teams.filter((t) => t.you).map((t) => `${t.league}|${t.id}`)), [teams]);
  const leagues = [...new Set([...teams.filter((t) => t.you).map((t) => t.league), ...(mine ?? []).map((g) => g.league)])];
  const any = yours.size > 0 || (mine?.length ?? 0) > 0;
  // From yesterday: a game that finished last night is still just finished.
  const first = useSportsWeek(plusDays(now, -1), leagues, any).data;
  const firstGames = useMemo(() => (first?.days ?? []).flatMap((d) => d.games), [first]);
  // A team of yours with nothing left this week (a bye): the week after, for its next game.
  const later = useSportsWeek(plusDays(now, 6), leagues, any && !!first && needsLaterWeek(firstGames, yours, now)).data;
  const recordings = useSportsRecordings(any).data?.recordings;
  const hide = useHideSports();
  const shownNow = useShownScores();
  const games = [...firstGames, ...(later?.days ?? []).flatMap((d) => d.games)];
  const played = new Map((mine ?? []).map((m) => [m.event, m]));
  const recorded = new Set((recordings ?? []).map((r) => r.game));
  const listed = stripGames({
    games,
    yours,
    played,
    hidden: (g) => recorded.has(g.id) || (hide && !shownNow.has(g.id)),
    seen: seenBefore,
    now,
    dayOf: localDay,
  });
  const byKey = new Map(teams.map((t) => [`${t.league}|${t.id}`, t]));
  const fansOf = (g: WeekGame, i: number): Fan[] => {
    const f = byKey.get(`${g.league}|${g.sides[i].id}`)?.followers ?? [];
    return [...f.filter((x) => x.id === me.id), ...f.filter((x) => x.id !== me.id)];
  };
  const bugs: Bug[] = listed.map(({ g, bucket }) => {
    const p = played.get(g.id) ?? null;
    const due = !!p && home.moves.some((m) => m.leagueId === p.leagueId && (m.episode == null || m.episode === p.episode));
    return { g, bucket, fans: [fansOf(g, 0), fansOf(g, 1)], played: p, due };
  });
  return { bugs, now, meId: me.id };
}

export function ScoresStrip({ home, couch }: { home: Home; couch: Couch | null }) {
  const { bugs, now, meId } = useStripGames(home, couch);
  const [asking, setAsking] = useState<WeekGame | null>(null);
  const [all, setAll] = useState(false);
  if (!bugs.length) return null;
  const live = bugs.filter((b) => b.bucket === "live").length;
  const total = `${bugs.length} ${bugs.length === 1 ? "game" : "games"}`;
  const due = bugs.filter((b) => b.due).length;
  return (
    <section data-scores-strip={bugs.length} data-live={live || undefined} aria-label="Scores" className="mx-4 mt-2 flex h-[88px] items-stretch overflow-hidden rounded-[4px] bg-card">
      {/* The lead tile, the guide bar's own: its count is the "there's more" (the user's ask), its chevron the way to every game, and
          a move due anywhere on the strip shows here too (the check: what's yours was off screen behind the first bugs). Live's
          words in the foreground, its dot red (red text this small misses 4.5:1). Its ring is inset: the slant clips an outline. */}
      <button
        type="button"
        data-scores-open
        onClick={() => setAll(true)}
        aria-label={`Scores: ${total}${live ? `, ${live} live` : ""}${due ? `, ${due} ${due === 1 ? "move" : "moves"} due` : ""}. Open them all`}
        className="nd-press relative z-[1] flex w-[88px] flex-none flex-col justify-center gap-1 bg-secondary pl-3 pr-4 text-left [clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--foreground)]"
      >
        <span className="type-caption flex items-center text-[21px] leading-none">
          Scores
          <ChevronRight className="size-4 flex-none" strokeWidth={2.6} aria-hidden />
        </span>
        <span className="flex flex-col whitespace-nowrap text-[13px] font-semibold leading-[1.2] text-muted-foreground">
          {live > 0 && (
            <span data-scores-live className="flex items-center gap-1 font-bold text-foreground">
              <i className="size-[7px] flex-none animate-pulse rounded-full bg-live motion-reduce:animate-none" aria-hidden />
              {live} live
            </span>
          )}
          {due > 0 && (
            <span data-scores-due className="flex items-center gap-1 text-foreground">
              <i className="size-[7px] flex-none rounded-full bg-chyron-line" aria-hidden />
              {due} due
            </span>
          )}
          <span>{total}</span>
        </span>
      </button>
      {/* A spacer at the end lets the last bug snap flush to the slant too, so no fragment of the one before sits behind the fade. */}
      <div
        data-scores-reel
        className="-ml-2 flex min-w-0 flex-1 snap-x snap-mandatory scroll-pl-3.5 items-center gap-2 overflow-x-auto py-1 pl-3.5 [scrollbar-width:none] [mask-image:linear-gradient(90deg,transparent,#000_14px,#000_calc(100%_-_36px),transparent)]"
      >
        {bugs.map((b) => (
          <Scorebug key={b.g.id} bug={b} meId={meId} now={now} onAsk={() => setAsking(b.g)} />
        ))}
        {/* The reel's width less a bug and the gap: room for the last bug to snap to the start. */}
        {bugs.length > 1 && <span aria-hidden className="h-px w-[calc(100%_-_216px)] flex-none" />}
      </div>
      <AllScores open={all} onOpenChange={setAll} bugs={bugs} meId={meId} now={now} onAsk={(g) => (setAll(false), setAsking(g))} total={total} live={live} />
      <AskSheet g={asking} onClose={() => setAsking(null)} />
    </section>
  );
}

/** Every game of the strip's, by league: the tile's tap. */
function AllScores({ open, onOpenChange, bugs, meId, now, onAsk, total, live }: { open: boolean; onOpenChange: (o: boolean) => void; bugs: Bug[]; meId: string; now: number; onAsk: (g: WeekGame) => void; total: string; live: number }) {
  const leagues = [...new Set(bugs.map((b) => b.g.leagueName))];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Scores" subtitle={live ? `${live} live · ${total}` : total}>
      <div data-scores-all className="flex flex-col gap-5 pb-2">
        {leagues.map((l) => (
          <section key={l}>
            <h3 className="type-caption mb-2 text-[17px] text-muted-foreground">{l}</h3>
            <div className="flex flex-col gap-2">
              {bugs
                .filter((b) => b.g.leagueName === l)
                .map((b) => (
                  <Scorebug key={b.g.id} bug={b} meId={meId} now={now} onAsk={() => onAsk(b.g)} wide onOpened={() => onOpenChange(false)} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
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
 * A game as a broadcast scorebug (208 × 72): two team rows (the team's colour as a slab, its abbreviation, up to two couch faces of
 * who follows it, the score or, before it, the record) and a status column behind a hairline that speaks the game's state. Live
 * wears the one live-red rule; your pick is the chyron underline; a move due, the chyron dot. A hidden game shows no numbers, only
 * Show (or Watching), and a tap asks before anything shows.
 */
function Scorebug({ bug, meId, now, onAsk, wide, onOpened }: { bug: Bug; meId: string; now: number; onAsk: () => void; wide?: boolean; onOpened?: () => void }) {
  const { g, bucket, fans, played, due } = bug;
  const s = useGameScore(g);
  const shownNow = useShownScores();
  const hide = useHideSports();
  const live = bucket === "live";
  const on = useLiveNow(g.league, g.id, live && s.open && !s.recording).data;
  // Watching it live here is seeing it: its final shows straight away this visit, and a later visit is done with it.
  useEffect(() => {
    if (live && s.open && !s.recording) noteSeen(g.id);
  }, [live, s.open, s.recording, g.id]);
  const situation = on && on.status === "in" ? on : null;
  const final = bucket === "final";
  // A final shows its score once you've chosen (Show the score, or seen it live); a hidden game never.
  const scored = (live || (final && shownNow.has(g.id))) && s.open && !s.recording;
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
  // The status column's small lines: 12 px (the line 11.5: it's the longest, "JAX by 6.5"), muted on the raised panel.
  const small = "whitespace-nowrap text-[12px] leading-tight text-muted-foreground";

  // The status column, by state.
  let status: React.ReactNode;
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
        <span className="type-num text-[12.5px] font-bold leading-tight">{!g.at ? "" : today ? time : dayOf(g.at, now).replace(/,.*/, "")}</span>
      </>
    );
    said = s.when;
  } else if (final) {
    status = (
      <>
        <b className="type-caption text-[17px] leading-none">Final</b>
        {!today && g.at && <small className={small}>{dayOf(g.at, now).replace(/,.*/, "")}</small>}
      </>
    );
    said = "final";
  } else if (bucket === "today") {
    status = (
      <>
        <b className="type-num whitespace-nowrap text-[17px] font-extrabold leading-none">
          {hm}
          {ampm && <span className="ml-0.5 text-[11px] font-bold">{ampm}</span>}
        </b>
        {g.network && <small className={small}>{g.network}</small>}
        {g.line && (
          <small data-bug-line className={`${small} text-[11.5px]`}>
            {g.line}
          </small>
        )}
      </>
    );
    said = `${time}${g.network ? ` on ${g.network}` : ""}${g.line ? `. ${g.line}` : ""}`;
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
          className={`type-caption pb-0.5 text-[18px] leading-none tracking-[0.03em] ${pick === x.id ? "shadow-[inset_0_-2px_0_var(--chyron-line)]" : ""} ${down_ ? "text-muted-foreground" : ""}`}
        >
          {(x.abbreviation ?? x.short).slice(0, 4)}
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
          <b className={`type-num min-w-6 text-right text-[26px] leading-none ${down_ ? "text-muted-foreground" : ""}`}>{nums[i]}</b>
        ) : records && x.record ? (
          <span className="type-num text-[13px] font-semibold text-muted-foreground">{x.record}</span>
        ) : null}
      </span>
    );
  });

  const className = `nd-press relative grid h-[72px] flex-none snap-start grid-cols-[minmax(0,1fr)_66px] overflow-hidden rounded-[3px] bg-secondary text-left focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--foreground)] ${wide ? "w-full" : "w-[208px]"}`;
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
      <button type="button" {...data} onClick={onAsk} className={className}>
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
    <button type="button" {...data} onClick={() => (onOpened?.(), openSports({ kind: "game", league: g.league, team: team.id, game: g.id }))} className={className}>
      {body}
    </button>
  );
}

/**
 * Before a hidden score shows (the user, 2026-11-15: "still not wanting any spoilers, have the option prompted to me to watch
 * live"): Show the score, or Watch it as if live (kept with your account: it says Started everywhere until you've watched it); a
 * game you're watching asks I've watched it or Keep hiding. Moved here from the Scoreboard that sat in Your shows.
 */
function AskSheet({ g, onClose }: { g: WeekGame | null; onClose: () => void }) {
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
