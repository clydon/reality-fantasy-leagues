"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Clock, Eye, EyeOff, MessageCircle, Play } from "lucide-react";
import { airedAt, airTime, dayOf } from "../clock";
import { episodeMarks, knownMark, marksLine, namesLine, type Mark } from "../couch/where";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { useEpisodeResults, useFill, useSeasonWaivers, type EpisodeRow, type GameNight, type WaiverRunView, type WaiverWeek } from "../data";
import { midLine, useFinalLine } from "../final-words";
import { gameInk, ordinal } from "../games";
import { NavLink, useCameFrom, useNav } from "../nav";
import { paths, type ShowTab } from "../routes";
import { episodesOf, isTabOf, type ShowData } from "../screens/show-space";
import { PushedPage, usePushedPage } from "../ui/page";
import { Btn } from "../ui/parts";
import { ShowArt, tabLabel } from "../ui/show-bar";
import { first } from "./moves";
import { Face } from "./parts";
import { useOpenReveal } from "./reveal";
import { CouchMomentsCard } from "./couch-moments";
import { GAME_NAMES } from "@/lib/server/league-season";
import { paceReveal, usePaceReveal } from "./pace-plate";
import { GifRow, GifStack, openGif, showLabel, type GifTarget } from "./react";
import { CallResults } from "./calls";
import { SheetResultRow } from "./questions";
import { BingoResults } from "./bingo";
import { ShowChangeCard } from "./show-change";
import { EpisodeCorrections, SomethingWrong } from "./something-wrong";
import { movesIn, playsWaivers, WaiverEpisodeRow } from "./waivers";
import { RecapsCard } from "./recaps";
import { EpisodesComing } from "./getting-ready";

// The design round's step 4 (docs/design-round/step4-episodes-spec.md, -first-view.md, -shape.md): the season as one list under the
// compact progress control (which holds the reveal: no plate, no Reveal on a row), the next episode its top row with the couch's
// readiness, then the groups Waiting for you, Out (not seen), Seen, and what's still to air.
// Episodes (the mock's show.js tabEpisodes and episodePage, episode.js's locked row, waivers.js's row): this week's
// episode and who's set for it, the next results to reveal, then every episode: one whose results are in but hidden
// until you reveal (Reveal), one that's aired and waiting for results, and each one you've seen with who went home
// and your line, opening its own page (?page=ep4: who went home, your games, the top scorers, what happened). Real
// (GET /api/seasons/[id]/episodes, through the guard). A waiver week sits between the two episodes it falls between
// (waivers.js's row): open, it goes to the Waivers page; run, to its own page in picking order (step 6a). The corrections
// the shared check made to the couch's games are on the episode's page only, closed just above the "Something wrong in
// this episode?" it ends with (step 6b, something-wrong.tsx), never lines in this list. Each episode you've seen carries
// a few of its GIFs, yours first (React with a GIF, react.tsx; docs/PLAN-gif-reactions.md): a show you only watch opens the
// GIF sheet from the row, a show you play from its page.
// A streaming season (step 14; the mock's streaming.js wEpisodes): the drop instead of this week's episode, "All 8 out ·
// Netflix", and a season you only watch from Episode 1 down, the way you'll watch it.
// Where everyone is (the user's pick C of the 2026-11-01 mocks): on a couch, each row carries the faces of whoever's up to it
// (the last episode they've seen, as they share it: couch/where.ts), yours lifted with "You're here"; under the list, who
// hasn't started and who plays here without sharing where they are. Never on the desk's read-only view.

/** "3 of 4 lineups set · 2 of 4 picked": who's set for the next episode in your games here, a line per kind. */
function progressLine(show: ShowData): string | null {
  const seen = new Set<string>();
  const parts = (show.play ?? [])
    .map((g) => g.progress)
    .filter((p) => !!p && !seen.has(p.label) && !!seen.add(p.label))
    .map((p) => `${p!.done} of ${p!.of} ${p!.label}`);
  return parts.length ? parts.join(" · ") : null;
}

/** An episode row's one line: your night in Weekly Lineup if you play it ("You +6 in Weekly Lineup"), else your first
 *  game's, else how they left. Read-only (`ro`, the desk's Open it: nobody's night), whether the game counted it. */
/** A game's name as people read it: a sports game named by its type key reads by the type's name ("Weekly Lineup"). */
const named = (n: string) => GAME_NAMES[n] ?? n;

function rowLine(e: EpisodeRow, ro?: ReadOnlyLine | null): string {
  if (ro) return ro.from === null || e.number < ro.from ? `Before ${ro.name} started` : ro.to !== null && e.number > ro.to ? `After ${ro.name} ended` : `Scored in ${ro.name}`;
  const l = e.lines?.find((x) => x.gameType === "active-roster") ?? e.lines?.[0];
  if (!l) return e.out?.length ? (e.out[0].method ?? "Out") : "Nothing recorded";
  if (l.line === "Before the game started") return "Before your games started";
  if (l.gameType === "active-roster") return `You ${l.big} in ${named(l.gameName)}`;
  if (l.gameType === "pickem") return l.big === "Survived" ? `Your ${named(l.gameName)} pick survived` : `${named(l.gameName)}: ${l.big.toLowerCase()}`;
  return `${named(l.gameName)}: ${l.big}`;
}

export function Episodes({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const eps = show.episodes;
  const openReveal = useOpenReveal();
  const finalWords = useFinalLine(eps?.reveal?.stage, eps?.reveal?.finalAt);
  // Read-only: the game open (by its id), who's set in it, or that a game still going has nothing to set (the mock's
  // "Outlast: nothing to set before it airs").
  const roGame = show.readOnly ? show.play?.find((g) => g.leagueId === show.readOnly!.leagueId) : undefined;
  const ro: ReadOnlyLine | null = show.readOnly && roGame ? { name: show.readOnly.name, from: roGame.from, to: roGame.to } : null;
  const progress = progressLine(show) ?? (ro && roGame && !roGame.over && !roGame.archived ? `${ro.name}: nothing to set before it airs` : null);
  const wv = useSeasonWaivers(seasonId, show.couch?.id ?? null, playsWaivers(show) && !show.readOnly);
  // Getting it ready (getting-ready.tsx): while the episodes are being looked up, their filmstrip instead of Fill in what happened,
  // and a row you've seen that's still to come says so.
  const filling = show.readOnly ? null : (show.header?.filling ?? null);
  const fillState = useFill(seasonId, !!filling).data;
  const catching = fillState?.status === "going" && fillState.steps.some((s) => s.key === "episodes");
  const looking = (n: number) => !!catching && fillState!.episodes.some((t) => t.number === n && (t.state === "waiting" || t.state === "asking"));
  const gifFor = (n: number): GifTarget => ({ seasonId, couchId: show.couch?.id ?? null, episode: n, label: showLabel(show), solo: show.solo });
  // Each waiver week after the episode that opened it, in a newest-first list just above that episode's row: every week anyone
  // moved in (a quiet week says nothing), and the week still open while there's something for you to do in it.
  const weeks = (n: number) =>
    (wv.data?.games ?? []).flatMap((w) => [
      ...w.runs.filter((r) => r.episode === n && movesIn(r) > 0).map((r) => ({ w, r })),
      ...(w.stage === "open" && w.period?.episode === n && (w.replace.length || w.swapsAllowed) ? [{ w, r: null }] : []),
    ]);
  const waiverRows = (list: { w: WaiverWeek; r: WaiverRunView | null }[]) =>
    list.map(({ w, r }) => <WaiverEpisodeRow key={`${w.leagueId}-${r?.periodId ?? "open"}`} seasonId={seasonId} week={w} run={r} many={(wv.data?.games.length ?? 0) > 1} />);
  const n = episodesOf(show);
  const me = useMe();
  // Your own mark when it's yours and known (couch/where.ts knownMark, as everywhere you're among the couch): no face of yours
  // rather than a guess while you see results straight away.
  const marks = show.solo || show.readOnly || !show.people ? null : episodeMarks(show.people, { id: me.id, name: me.name, seen: knownMark(show) });
  const whoAt = (ep: number) => marks?.at.get(ep);
  const network = show.header?.show.network;
  // A streaming season: Up next is its drop, until it's out (schedule.ts upNext); then, watched without a game of yours, the
  // episodes in the order you'll watch them.
  const drop = show.streaming && up && t != null;
  // At your own pace the episodes your game waits on aren't in the season's list (each is that game's own reveal: the server's
  // reveal leaves them out), so they're added here, newest first, and open the same reveal as the control's.
  const pace = paceReveal(show);
  const paced = usePaceReveal(show, pace);
  const paceRows: EpisodeRow[] =
    pace && eps
      ? Array.from({ length: Math.max(0, show.latestAired - pace.n + 1) }, (_, i) => show.latestAired - i)
          .filter((n) => !eps.episodes.some((x) => x.number === n))
          .map((n) => ({ number: n, airAt: null, status: "hidden" as const, stage: "final" as const }))
      : [];
  const listed = eps ? (show.streaming && !show.plays ? [...eps.episodes].reverse() : eps.episodes) : [];
  const list = paceRows.length ? [...paceRows, ...listed].sort((a, b) => b.number - a.number) : listed;
  const revealAt = eps?.reveal?.episode ?? pace?.n ?? null;
  const revealFrom = (n: number) => (eps?.reveal ? openReveal(eps.reveal.episode) : pace && n >= pace.n ? paced.start() : openReveal(n));
  const aside = show.streaming
    ? drop
      ? `${n ? `All ${n} drop` : "Drops"} ${dayOf(t!)}`
      : `${n ? `All ${n} out` : "All out"}${network ? ` · ${network}` : ""}`
    : eps?.stillIn != null
      ? `${eps.stillIn} still in`
      : null;
  // What's still to air, after the next episode (its own row at the top).
  const nextShown = !!up && !!show.header && !drop;
  const toAir = eps?.toAir
    ? nextShown && eps.toAir.from === up!.number
      ? eps.toAir.to == null
        ? { from: eps.toAir.from + 1, to: null }
        : eps.toAir.to > eps.toAir.from
          ? { from: eps.toAir.from + 1, to: eps.toAir.to }
          : null
      : eps.toAir
    : null;
  return (
    <>
      {/* The desk's read-only view has no progress control: its reveal stays a plate. */}
      {show.readOnly && eps?.reveal && (
        <section className="mt-[26px] px-4">
          <button
            type="button"
            data-reveal-plate
            onClick={() => openReveal(eps.reveal!.episode)}
            className="nd-press flex min-h-14 w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate"
          >
            <span className="type-caption -mr-[13px] flex items-center whitespace-nowrap bg-chyron py-0 pl-[11px] pr-[22px] text-sm tracking-[0.04em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
              {show.words.ep} {eps.reveal.episode}
            </span>
            <span className="flex flex-1 flex-col justify-center gap-[3px] py-[7px] pl-5 pr-2.5">
              <span className="type-caption text-[19px]">{eps.reveal.stage === "early" ? "Early results are in" : "Final results are in"}</span>
              <span className="text-[13px] text-plate-muted">{eps.reveal.stage === "early" && finalWords ? `Hidden until you reveal · ${midLine(finalWords)}` : "Hidden until you reveal"}</span>
            </span>
            <span className="grid place-items-center px-3">
              <ChevronRight className="size-5" aria-hidden />
            </span>
          </button>
        </section>
      )}
      {catching ? <EpisodesComing f={fillState!} /> : eps && <RecapsCard seasonId={seasonId} show={show} eps={eps} />}
      <section className="mt-[26px] px-4">
        {!eps ? (
          <div aria-busy className="h-56 animate-pulse rounded-[4px] bg-card" />
        ) : (
          <>
            {nextShown && <NextRow up={up!} show={show} progress={progress} />}
            {list.map((e, i) => (
              <div key={e.number} className="contents">
                {groupOf(e) !== (i ? groupOf(list[i - 1]) : null) && <GroupLabel g={groupOf(e)} aside={groupOf(e) === "seen" ? aside : null} />}
                {waiverRows(weeks(e.number))}
                {e.status === "hidden" ? (
                  <HiddenRow e={e} who={whoAt(e.number)} ep={show.words.ep} at={revealAt ?? e.number} onReveal={() => revealFrom(e.number)} />
                ) : e.status === "waiting" ? (
                  <WaitingRow e={e} who={whoAt(e.number)} />
                ) : e.status === "aired" ? (
                  <AiredRow e={e} who={whoAt(e.number)} streaming={show.streaming} word={show.words.episode} looking={looking(e.number)} onGif={() => openGif(gifFor(e.number))} onReplay={() => openReveal(e.number, { replay: true })} />
                ) : (
                  <SeenRow e={e} who={whoAt(e.number)} ro={ro} word={show.header?.show.kind === "sport" ? show.words.episode : null} />
                )}
              </div>
            ))}
            {eps.episodes.length === 0 && !nextShown && !(drop && eps.toAir) && <p className="border-t border-border py-4 text-sm text-muted-foreground">Nothing has aired yet.</p>}
            {toAir && (
              <div data-ep-to-air={drop ? "drop" : toAir.from} className="flex min-h-[68px] items-center gap-3 border-y border-border opacity-(--nd-dim)">
                {/* A lone number beside "More to come" read as if only that one were left (step 4's check). */}
                <span className="type-num w-7 text-[28px] text-muted-foreground">{toAir.to || drop ? toAir.from : ""}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-base font-semibold">
                    {drop
                      ? `Drops ${airTime(t!)}`
                      : toAir.to
                        ? `+ ${toAir.to - toAir.from + 1} still to air`
                        : "More to come"}
                  </b>
                  {/* The row is dimmed already: muted on top of it fell under 4.5:1. */}
                  {toAir.to && toAir.to > toAir.from && (
                    <small className="mt-0.5 block text-[13px] text-foreground/85">
                      {show.words.episodes} {toAir.from} to {toAir.to}
                    </small>
                  )}
                </span>
              </div>
            )}
            {marks && ((marks.notStarted.length > 0 && show.latestAired > 0) || marks.quiet.length > 0) && (
              <div data-ep-elsewhere className="flex flex-col gap-2.5 pt-3.5 text-[13px] text-muted-foreground">
                {/* Before the premiere there's nothing to have started. */}
                {marks.notStarted.length > 0 && show.latestAired > 0 && (
                  <span data-ep-not-started className="flex min-w-0 items-center gap-2">
                    <Faces marks={marks.notStarted} />
                    <span className="min-w-0">{notStartedLine(marks.notStarted)}</span>
                  </span>
                )}
                {marks.quiet.length > 0 && (
                  <span data-ep-quiet className="flex min-w-0 items-center gap-2">
                    <EyeOff className="size-4 flex-none" aria-hidden />
                    <span className="min-w-0">
                      {namesLine(marks.quiet.map((m) => m.name))} {marks.quiet.length === 1 ? "plays here; their place isn't" : "play here; their places aren't"} shown
                    </span>
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </section>
      <EpisodePage seasonId={seasonId} show={show} />
      {paced.node}
    </>
  );
}

// ---------- who's up to each episode ----------

/** Your row, where you're up to: lifted like your standings row. Its width is its own (a row's w-full would beat it). */
const LIFT = "-mx-2 w-[calc(100%+1rem)] rounded-[3px] border-t-transparent bg-secondary px-2";
const mineIn = (who?: Mark[]) => !!who?.some((m) => m.you);

/** Up to four faces, overlapping (three and a count past that); yours ringed. `ground`: what they sit on, for their edge. */
function Faces({ marks, ground = "var(--background)" }: { marks: Mark[]; ground?: string }) {
  const shown = marks.slice(0, marks.length > 4 ? 3 : 4);
  return (
    <span className="flex flex-none items-center" aria-hidden>
      {shown.map((m, i) => (
        <span key={m.userId} className={`rounded-[3px] ${i ? "-ml-1.5" : ""} ${m.you ? "relative z-[1] outline-2 outline-offset-1 outline-foreground" : ""}`} style={{ boxShadow: `0 0 0 2px ${ground}` }}>
          <Avatar id={m.userId} name={m.name} size={22} />
        </span>
      ))}
      {marks.length > shown.length && (
        <span className="type-num -ml-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-[3px] bg-secondary px-1 text-[11px]" style={{ boxShadow: `0 0 0 2px ${ground}` }}>
          +{marks.length - shown.length}
        </span>
      )}
    </span>
  );
}

/** Who's up to this episode: their faces (their names are the faces' label and Where everyone is's), and "You're here" on
 *  yours (step 4's check: the names line repeated what the faces show). */
function WhoHere({ who }: { who?: Mark[] }) {
  if (!who?.length) return null;
  return (
    <span data-ep-who={who.map((m) => (m.you ? "you" : m.name)).join(",")} aria-label={marksLine(who)} className="mt-2 flex min-w-0 items-center gap-2 text-[13px] font-semibold">
      <Faces marks={who} ground={mineIn(who) ? "var(--secondary)" : "var(--background)"} />
      {mineIn(who) && (
        <span data-ep-who-line className="truncate">
          You&rsquo;re here
        </span>
      )}
    </span>
  );
}

/** "max hasn't started", "You and max haven't started". */
function notStartedLine(marks: Mark[]): string {
  const names = marks.map((m) => (m.you ? "You" : m.name));
  return `${namesLine(names, 4)} ${names.length > 1 || mineIn(marks) ? "haven't" : "hasn't"} started`;
}

type Group = "waiting" | "out" | "seen";
/** Which group an episode's row sits in: results in and hidden (or on their way), out but not seen (a show you watch), seen. */
const groupOf = (e: EpisodeRow): Group => (e.status === "hidden" || e.status === "waiting" ? "waiting" : e.status === "aired" && !e.watched ? "out" : "seen");
const GROUP_WORDS: Record<Group, string> = { waiting: "Waiting for you", out: "Out, not seen", seen: "Seen" };

/** A group's label in the list: what the rows under it have in common, and (Seen) how many are still in. */
function GroupLabel({ g, aside }: { g: Group; aside: string | null }) {
  return (
    <div data-ep-group={g} className="flex items-baseline justify-between gap-3 pb-2 pt-5">
      <h3 className="type-caption text-[17px] tracking-[0.03em] text-muted-foreground">{GROUP_WORDS[g]}</h3>
      {aside && (
        <span data-episodes-aside className="text-[13px] text-muted-foreground">
          {aside}
        </span>
      )}
    </div>
  );
}

/** The next episode, the list's top row: when (or on now), and who's set for it in your games here (the couch's readiness). */
function NextRow({ up, show, progress }: { up: NonNullable<ShowData["upNext"]>; show: ShowData; progress: string | null }) {
  const t = up.airAt ? Date.parse(up.airAt) : null;
  return (
    <div data-ep-up={up.number} className="flex min-h-[68px] items-center gap-3 pb-2 pt-4">
      <span className="type-num w-7 text-[28px]">{up.number}</span>
      <ShowArt seasonId={show.header!.seasonId} artUrl={show.header!.show.artUrl} name={show.header!.show.name} className="h-10 w-16 flex-none rounded-[3px] text-[10px]" />
      <span className="min-w-0 flex-1">
        <b className="flex items-center gap-1.5 text-base font-semibold">
          {up.live && <i className="size-2 flex-none animate-pulse rounded-full bg-live" aria-hidden />}
          {up.live ? "On air now" : t != null ? `Airs ${airTime(t)}` : "Up next"}
        </b>
        {progress && <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{progress}</small>}
      </span>
    </div>
  );
}

/** Results in past your mark: the stripes say hidden; the reveal is the progress control's, so a row says no "Reveal" of its own
 *  (step 4's R1: the reveal once). A later one says it comes after the first; either opens the same reveal. */
function HiddenRow({ e, who, ep, at, onReveal }: { e: EpisodeRow; who?: Mark[]; ep: string; at: number; onReveal: () => void }) {
  const finalWords = useFinalLine(e.stage, e.finalAt);
  return (
    <button
      type="button"
      data-ep-hidden={e.number}
      onClick={onReveal}
      className="nd-press flex min-h-[68px] w-full items-center gap-3 border-t border-border bg-[repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_srgb,var(--foreground)_3%,transparent)_10px_20px)] py-2 text-left"
    >
      <span className="type-num w-7 text-[28px] text-muted-foreground">{e.number}</span>
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-muted-foreground">
        <Eye className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">{e.stage === "early" ? "Early results are in" : "Final results are in"}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          {e.number > at ? `Hidden · after ${ep} ${at}` : e.stage === "early" && finalWords ? `Hidden until you reveal · ${midLine(finalWords)}` : "Hidden until you reveal"}
        </small>
        <WhoHere who={who} />
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** An episode of a show you only watch, with no results to show (step 10): when it aired, and whether you've seen it. One
 *  you've seen replays its reveal (the user, 2026-11-02: its write-up, who went home, the couch's GIFs), and its few GIFs on the
 *  row's end are a button of their own (React with a GIF). */
function AiredRow({ e, who, streaming, word = "Episode", looking, onGif, onReplay }: { e: EpisodeRow; who?: Mark[]; streaming?: boolean; word?: string; looking?: boolean; onGif: () => void; onReplay: () => void }) {
  const lift = mineIn(who) ? LIFT : "";
  const body = (
    <>
      <span className={`type-num w-7 text-[28px] ${e.watched ? "" : "text-muted-foreground"}`}>{e.number}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">{e.title ?? `${word} ${e.number}`}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          {/* A streaming season's all came out at once: when isn't news. */}
          {e.airAt && !streaming ? `Aired ${airedAt(Date.parse(e.airAt))} · ` : ""}
          {e.watched ? "You've seen it" : "Not seen yet"}
        </small>
        {e.summary ? (
          <small data-ep-summary className="mt-1 block text-[13.5px] leading-snug text-foreground/90">
            {e.summary}
          </small>
        ) : (
          e.watched &&
          looking && (
            <small data-ep-looking className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <i className="nd-tally size-1.5 rounded-full bg-live" aria-hidden />
              Looking up what happened…
            </small>
          )
        )}
        <WhoHere who={who} />
      </span>
    </>
  );
  if (!e.watched) {
    return (
      <div data-ep-aired={e.number} data-watched="no" className={`flex min-h-[68px] items-center gap-3 border-t border-border py-2 ${lift}`}>
        {body}
      </div>
    );
  }
  return (
    <div data-ep-aired={e.number} data-watched="yes" className={`flex min-h-[68px] items-center gap-1 border-t border-border ${lift || "w-full"}`}>
      <button type="button" data-ep-replay={e.number} onClick={onReplay} className="nd-press flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
        {body}
      </button>
      <button type="button" data-ep-gif={e.number} onClick={onGif} aria-label={`Your GIF for ${word} ${e.number}`} className="nd-press flex min-h-11 flex-none items-center pl-1">
        <GifStack line={e.gifs} react />
      </button>
    </div>
  );
}

function WaitingRow({ e, who }: { e: EpisodeRow; who?: Mark[] }) {
  return (
    <div data-ep-waiting={e.number} className={`flex min-h-[68px] items-center gap-3 border-t border-border py-2 ${mineIn(who) ? LIFT : ""}`}>
      <span className="type-num w-7 text-[28px] text-muted-foreground">{e.number}</span>
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-muted-foreground">
        <Clock className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">Waiting for results</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          {e.airAt ? `Aired ${airedAt(Date.parse(e.airAt))} · ` : ""}nothing is spoiled meanwhile
        </small>
        <WhoHere who={who} />
      </span>
    </div>
  );
}

/** The game open read-only, for an episode row's line: its name, its first episode and its last (null: the season's end). */
/** `from` null: a game waiting for a phase of the season (step A3 of docs/PLAN-start-a-game-gpt.md), not started yet. */
type ReadOnlyLine = { name: string; from: number | null; to: number | null };

function SeenRow({ e, who, ro, word }: { e: EpisodeRow; who?: Mark[]; ro: ReadOnlyLine | null; word?: string | null }) {
  const page = usePushedPage(`ep${e.number}`);
  const out = e.out ?? [];
  const mine = mineIn(who);
  return (
    <button type="button" data-ep={e.number} onClick={page.show} className={`nd-press flex min-h-[68px] items-center gap-3 border-t border-border py-2 text-left ${mine ? LIFT : "w-full"}`}>
      <span className={`type-num w-7 text-[28px] ${mine ? "" : "text-muted-foreground"}`}>{e.number}</span>
      {out.length > 0 && (
        <span className="flex flex-none">
          {out.slice(0, 3).map((c, i) => (
            <Face key={c.id} src={c.photo} name={c.name} out className={`size-10 rounded-[3px] ${mine ? "shadow-[0_0_0_2px_var(--secondary)]" : "shadow-[0_0_0_2px_var(--background)]"} ${i ? "-ml-3" : ""}`} />
          ))}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <b className="block truncate text-base font-semibold">{out.length ? `${out.map((c) => first(c.name)).join(" and ")} out` : word ? (e.title ?? `${word} ${e.number}`) : "No one out"}</b>
        <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">
          {rowLine(e, ro)}
          {e.stage === "early" ? " · full scores to come" : ""}
        </small>
        <WhoHere who={who} />
      </span>
      <GifStack line={e.gifs} />
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** The episode page open over the tab, whichever it is (?page=ep4). */
function EpisodePage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const asked = /^ep(\d+)$/.exec(useSearchParams().get("page") ?? "");
  const ep = asked ? Number(asked[1]) : null;
  // Keep the last one while it slides away.
  const [shown, setShown] = useState(ep);
  if (ep != null && ep !== shown) setShown(ep);
  const page = usePushedPage(`ep${shown}`);
  const nav = useNav();
  const e = show.episodes?.episodes.find((x) => x.number === shown && x.status === "seen") ?? null;
  // Opened by a link on another of the show's tabs (Tonight's "What happened in Episode 4"): back goes there, and says so.
  const from = useCameFrom();
  const fromTab = ep != null && from && from !== paths.show(seasonId, "episodes") && isTabOf(seasonId)(from) ? (from.split("/")[3] as ShowTab) : null;
  const back = fromTab
    ? { label: tabLabel(fromTab, { episodes: show.words.episodesTab, cast: show.words.peopleTab }), close: () => nav.back(paths.show(seasonId, fromTab)) }
    : { label: show.words.episodesTab, close: page.close };
  return (
    <PushedPage open={ep != null} onClose={back.close} title={`${show.words.episode} ${shown ?? ""}`} back={back.label}>
      {e ? (
        <EpisodeBody
          seasonId={seasonId}
          couchId={show.couch?.id ?? null}
          e={e}
          seasonName={show.header ? `${show.header.show.name} ${show.header.seasonNumber}` : "this season"}
          target={{ seasonId, couchId: show.couch?.id ?? null, episode: e.number, label: showLabel(show), solo: show.solo }}
          sheets={show.games.filter((g) => g.yourRole && g.gameType === "questions" && !g.archived).map((g) => ({ leagueId: g.leagueId, name: g.name }))}
          ep={show.words.ep}
          talk={!show.solo && !!show.couch?.id && !show.readOnly}
        />
      ) : (
        <p className="px-4 pt-6 text-sm text-muted-foreground">Reveal this episode to see it.</p>
      )}
    </PushedPage>
  );
}

/** A game's line on the episode page: it opens that game's table on the Games tab, on this episode (as Tonight's do). */
function GameLine({ l, href }: { l: GameNight; href: string }) {
  return (
    // A jump to the Games tab: it pushes, so back comes back here.
    <NavLink href={href} data-game-line={l.leagueId} className="nd-press grid grid-cols-[118px_1fr_auto] gap-x-2.5 gap-y-0.5 border-t border-border py-3">
      <span
        className="type-caption row-span-2 self-center text-[13px] tracking-[0.04em]"
        style={{ color: l.gameType === "predictions" ? "var(--muted-foreground)" : gameInk(l.gameName) }}
      >
        {named(l.gameName)}
      </span>
      <b className="text-lg">{l.big}</b>
      <ChevronRight className="row-span-2 size-5 self-center text-muted-foreground" aria-hidden />
      <small className="block text-[13px] text-muted-foreground">{l.line}</small>
    </NavLink>
  );
}

function EpisodeBody({
  seasonId,
  couchId,
  e,
  seasonName,
  target,
  sheets,
  ep,
  talk,
}: {
  seasonId: string;
  couchId: string | null;
  e: EpisodeRow;
  seasonName: string;
  target: GifTarget;
  sheets: { leagueId: string; name: string }[];
  ep: string;
  talk: boolean;
}) {
  const out = e.out ?? [];
  const results = useEpisodeResults(seasonId, couchId, e.number);
  const finalWords = useFinalLine(e.stage, e.finalAt);
  const openReveal = useOpenReveal();
  return (
    // Step 4 (docs/design-round/step4-episodes-spec.md, "An episode's page"): the episode first (who left), what happened, the
    // couch's reactions and its talk, then your games each in its own measure (a game's top scorers under that game: its points
    // are its own), and Replay the reveal at the foot (a rewatch follows the content, it doesn't lead it).
    <div data-episode-page={e.number} data-results-in={results.data ? "" : undefined} className="mb-10 mt-3 px-4 pb-4 pt-4">
      {e.stage === "early" && (
        <p className="mb-3 rounded-[3px] bg-card px-3 py-2.5 text-sm text-muted-foreground">Early results: who went home is in. {finalWords ? `${finalWords}.` : "Weekly Lineup’s full scores come later."}</p>
      )}
      <div className="flex flex-col gap-2.5">
        {out.map((c) => (
          <div key={c.id} className="flex min-h-[64px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
            <Face src={c.photo} name={c.name} out={c.knocked} className="w-16 flex-none text-2xl" />
            <span className="type-caption -mr-[13px] flex items-center bg-live py-0 pl-3 pr-[22px] text-sm tracking-[0.04em] text-live-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
              Out
            </span>
            <span className="flex flex-1 flex-col justify-center py-2 pl-5 pr-3">
              <b className="type-caption text-[19px]">{c.name}</b>
              <small className="block text-[13px] text-plate-muted">{[c.method, c.place ? `finished ${ordinal(c.place)}` : null].filter(Boolean).join(" · ")}</small>
            </span>
          </div>
        ))}
        {out.length === 0 && <p className="text-[15px] text-muted-foreground">Nobody went home this episode.</p>}
      </div>
      {(!!e.summary || (e.happened?.length ?? 0) > 0) && (
        <section className="mt-[26px]" data-ep-happened>
          <h2 className="type-caption mb-3 text-[24px]">What happened</h2>
          {e.summary && <p className="mb-3 text-[15px] leading-relaxed text-foreground/90">{e.summary}</p>}
          {(e.happened ?? []).map((h) => (
            <div key={h.label} className="flex min-h-12 flex-wrap items-center gap-2 border-t border-border py-2">
              <span className="type-caption w-[90px] text-sm text-muted-foreground">{h.label}</span>
              {h.winners.map((w) => (
                <span
                  key={w.name}
                  className={`rounded-[2px] px-2.5 py-1 text-sm font-bold ${w.colour ? "" : "bg-secondary"}`}
                  style={w.colour ? { background: w.colour, color: "#121018" } : undefined}
                >
                  {w.name}
                </span>
              ))}
            </div>
          ))}
        </section>
      )}
      <section className="mt-[26px]" data-episode-gif>
        <h2 className="type-caption mb-1 text-[24px]">How was it?</h2>
        <GifRow target={target} line={e.gifs} />
        {talk && (
          <NavLink href={paths.show(seasonId, "chat")} data-ep-discuss className="nd-press mt-3 flex h-12 items-center justify-center gap-2 rounded-[4px] font-bold outline-1 -outline-offset-1 outline-edge">
            <MessageCircle className="size-[18px]" aria-hidden />
            Discuss {ep} {e.number}
          </NavLink>
        )}
      </section>
      {(e.lines?.length ?? 0) > 0 && (
        <section className="mt-[26px]">
          <h2 className="type-caption mb-3 text-[24px]">Your games</h2>
          {e.lines!.map((l, i) => (
            <div key={`${l.leagueId}-${l.gameType}`} className="contents">
              <GameLine l={l} href={paths.game(seasonId, l.leagueId, e.number)} />
              {/* The episode's best scorers are a game's points: under the first game that scores moments, named as its. */}
              {i === e.lines!.findIndex((x) => x.gameType === "active-roster") && (e.scorers?.length ?? 0) > 0 && (
                <div data-ep-scorers className="mb-2 ml-[128px] flex flex-col">
                  <small className="pb-1 text-[13px] text-muted-foreground">{named(l.gameName)}&rsquo;s best this episode</small>
                  {e.scorers!.slice(0, 4).map((c) => (
                    <span key={c.name} className="flex h-10 items-center gap-2 text-[14px] font-semibold">
                      <Face src={c.photo} name={c.name} className="size-7 rounded-[3px] text-xs" />
                      <span className="min-w-0 flex-1 truncate">{first(c.name)}</span>
                      <span className="type-num text-[18px]">+{c.points}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      <CallResults target={target} />
      {/* Each Prediction Sheet of yours here (step A4 part 2): how its questions went on this episode, at your mark. */}
      {sheets.map((g) => (
        <SheetResultRow key={g.leagueId} heading target={{ seasonId, leagueId: g.leagueId, episode: e.number, game: g.name }} />
      ))}
      <BingoResults target={target} />
      <CouchMomentsCard seasonId={seasonId} couchId={couchId} episode={e.number} />
      <ShowChangeCard seasonId={seasonId} couchId={couchId} episode={e.number} seasonName={seasonName} />
      {/* Keyed: the page keeps its body from one episode to the next, and each opens closed. */}
      <EpisodeCorrections key={e.number} results={results.data} />
      {/* Its reveal again (the user, 2026-11-02), as it played: nothing moves, nothing's written. */}
      <Btn wide data-replay-reveal className="mt-[26px]" onClick={() => openReveal(e.number, { replay: true })}>
        <Play className="size-[18px]" aria-hidden />
        Replay the reveal
      </Btn>
      <SomethingWrong seasonId={seasonId} couchId={couchId} episode={e.number} />
    </div>
  );
}
