"use client";

// Bands (the design round's step 7; the user picked it over the posters, Your week, the couch first and Previously on): Your shows
// as bands, each a show's art with its season as a ruler and the couch's faces at their episodes, each episode's number under the
// faces standing there, someone away (behind, and not on since the latest aired: the home read's `away`) faded with a dotted trail
// to the latest episode; finished seasons (for the whole couch) folded at the foot. Sports above them as a scoreboard: one
// swipeable row of compact game cards (on now, just finished, a move of yours due, rivalries, each of your teams' next), a game
// just finished asking before its score shows (Show the score, or Watch it as if live: /api/sports/recordings).

import { useState } from "react";
import { ChevronRight, Plus, Tv } from "lucide-react";
import { useSetRecording, useSportsRecordings, useSportsWeek, type Couch, type CouchHub, type Home, type HomeShow, type WeekGame } from "../data";
import { plainName } from "../couch/where";
import { airTime } from "../clock";
import { ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { Btn, SectionHead } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { openWatching } from "../watching/sheets";
import { showWords } from "@/lib/game/show-words";
import { TeamMark } from "../sports/parts";
import { clockOf, showScore, useGameScore, useShownScores } from "../sports/scores";
import { openSports, startOn } from "../sports/sheets";
import { useSportsDay, type Fan } from "./sports-day";
import { usePracticeShows } from "../tour/practice-shows";
import { FinishedFold, finishedFor, GamesMark, shelfOrder, showOfMove } from "./sections";

const nameOf = (s: { show: { name: string }; seasonNumber: number | null }) => `${plainName(s.show.name)}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;
const epOf = (s: HomeShow) => {
  const w = showWords(s.show.terms);
  return w.ep.length > 1 ? w.ep : w.episode;
};

/** Where each person is on a season: you from the home read, the couch's from what they share. */
function marksOn(home: Home, couch: Couch | null, s: HomeShow) {
  const me = home.user.id;
  const out: { userId: string; name: string; seen: number; you: boolean; away: boolean }[] = [];
  if (s.seenThrough != null && (s.following || s.games.length)) out.push({ userId: me, name: home.user.name, seen: s.seenThrough, you: true, away: false });
  for (const m of couch?.members ?? []) {
    if (m.userId === me || !m.watching.includes(s.seasonId)) continue;
    const at = m.at?.[s.seasonId];
    if (at != null) out.push({ userId: m.userId, name: m.name, seen: at, you: false, away: !!m.away?.includes(s.seasonId) });
  }
  return out;
}

// ---------- bands: Your shows, each a band with its ruler ----------

export function ShowBands({ home, couch, hub }: { home: Home; couch: Couch | null; hub: CouchHub | undefined }) {
  // With what the first-time tour's practice added, for the tour (tour/practice-shows.ts; each says Practice).
  const practice = usePracticeShows();
  const mine = [...home.shows, ...practice].filter((s) => s.following || s.games.length || s.seasonId.startsWith("tour-"));
  const shows = shelfOrder(mine.filter((s) => !finishedFor(home, couch, hub, s)));
  const finished = shelfOrder(mine.filter((s) => finishedFor(home, couch, hub, s)));
  const [open, setOpen] = useState(false);
  const due = new Set(home.moves.map((m) => showOfMove(home, m)?.seasonId).filter(Boolean));
  return (
    <section className="mt-7" data-look="bands" data-your-shows>
      <SectionHead title="Your shows" aside={couch ? "Where everyone is" : undefined} />
      {/* Sports as one swipeable row of game cards (the user, 2026-11-15): on now, just finished, due, rivalries, next. */}
      <Scoreboard home={home} couch={couch} shows={home.shows} />
      <div className="flex flex-col gap-2.5 px-4">
        {/* TV shows as bands; a sport's game is on the scoreboard above. */}
        {shows
          .filter((s) => s.show.kind !== "sport")
          .map((s) => (
            <ShowBand key={s.seasonId} home={home} couch={couch} show={s} due={due.has(s.seasonId)} hub={hub} />
          ))}
        <button
          type="button"
          data-add-show-poster
          onClick={() => openWatching({ kind: "add" })}
          className="nd-press flex h-14 items-center justify-center gap-1.5 rounded-[4px] text-[15px] font-semibold text-muted-foreground outline-2 -outline-offset-2 outline-dashed outline-input"
        >
          <Plus className="size-4" aria-hidden />
          Add a show
        </button>
      </div>
      {finished.length > 0 && (
        <div className="mt-3">
          <FinishedFold n={finished.length} open={open} onToggle={() => setOpen((o) => !o)} />
          {open && (
            <div data-finished className="nd-rise mt-2.5 flex flex-col gap-2.5 px-4">
              {finished.map((s) => (
                <ShowBand key={s.seasonId} home={home} couch={couch} show={s} due={false} hub={hub} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ShowBand({ home, couch, show, due, hub }: { home: Home; couch: Couch | null; show: HomeShow; due: boolean; hub: CouchHub | undefined }) {
  const total = Math.max(show.episodeCount ?? 0, show.latestAired, show.upNext?.number ?? 0, 1);
  const marks = marksOn(home, couch, show);
  const ranked = (hub?.games ?? []).filter((g) => g.seasonId === show.seasonId && g.rank).map((g) => Number(g.rank!.replace(/^T/, "")));
  const best = ranked.length ? Math.min(...ranked) : null;
  const ep = epOf(show);
  const at = (n: number) => Math.min(96, Math.max(4, (n / total) * 100));
  const byMark = new Map<number, typeof marks>();
  for (const m of marks) byMark.set(m.seen, [...(byMark.get(m.seen) ?? []), m]);
  const when = show.upNext?.live
    ? "On now"
    : show.upNext?.airAt
      ? `${ep} ${show.upNext.number} · ${airTime(Date.parse(show.upNext.airAt))}`
      : show.status === "completed"
        ? `All ${total} out`
        : null;
  return (
    <NavLink
      href={paths.show(show.seasonId)}
      channel
      data-band={show.seasonId}
      className="nd-press relative isolate block h-[126px] overflow-hidden rounded-[4px] bg-card text-white"
    >
      <ShowArt seasonId={`band-${show.seasonId}`} artUrl={show.show.backdropUrl || show.show.artUrl} name={show.show.name} className="absolute inset-0 -z-[2] size-full" bare />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(90deg,rgba(16,14,21,.94)_0%,rgba(16,14,21,.8)_55%,rgba(16,14,21,.45)_100%)]" />
      <span className="flex items-start gap-2 px-3 pt-2.5">
        <span className="min-w-0 flex-1">
          <b className="type-caption block truncate text-[22px] leading-none">{nameOf(show)}</b>
          {when && <span className={`mt-1 block text-[13px] font-semibold ${show.upNext?.live ? "text-live" : "text-white/75"}`}>{when}</span>}
        </span>
        {/* One the first-time tour's practice added (tour/practice-shows.ts): here for the tour, not saved. */}
        {show.seasonId.startsWith("tour-") && (
          <span data-practice-tag className="type-caption flex-none bg-quiet-tag py-1 pl-2 pr-3 text-[13px] text-quiet-tag-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
            Practice
          </span>
        )}
        {best != null && (
          <span className="type-caption flex-none bg-plate py-1 pl-2 pr-3 text-[13px] text-plate-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
            Best {ordinal(best)}
          </span>
        )}
        {show.games.length > 0 && <GamesMark due={due} className="relative -mr-1 -mt-0.5 flex-none" />}
      </span>
      {/* The season as a ruler: the aired run solid, the next airing dashed, each face at the last episode they've seen with that
          episode's number under it (the user, 2026-11-15: "a little fidelity into what episode other people are on"). Someone away
          (behind, and not on since the latest aired: the home read's `away`) is faded, with a dotted trail from their mark to the
          latest episode: somewhere in there, maybe up to date. */}
      <span
        className="absolute inset-x-3 bottom-2 block h-[52px]"
        role="img"
        aria-label={marks
          .map((m) => `${m.you ? "You" : m.name} on ${ep} ${m.seen}${m.away ? ", not on since the latest aired" : ""}`)
          .join("; ")}
      >
        <span className="absolute inset-x-0 bottom-[14px] h-[3px] rounded-full bg-white/20" />
        <span className="absolute left-0 bottom-[14px] h-[3px] rounded-full bg-white/80" style={{ width: `${(show.latestAired / total) * 100}%` }} />
        {show.upNext && !show.upNext.live && (
          <i className="absolute bottom-[10px] h-[11px] border-l-2 border-dashed border-white" style={{ left: `${(show.upNext.number / total) * 100}%` }} />
        )}
        {marks
          .filter((m) => m.away && show.latestAired > m.seen)
          .map((m) => (
            <i
              key={`trail-${m.userId}`}
              data-away-trail={m.name}
              className="absolute bottom-[19px] h-0 border-t-2 border-dotted border-white/55"
              style={{ left: `${at(m.seen)}%`, width: `${Math.max(0, at(show.latestAired) - at(m.seen))}%` }}
            />
          ))}
        {/* The ends' numbers, unless a mark's number stands there. */}
        {![...byMark.keys()].some((n) => at(n) < 9) && <small className="type-num absolute bottom-0 left-0 text-[12px] leading-none text-white/55">1</small>}
        {![...byMark.keys()].some((n) => at(n) > 91) && <small className="type-num absolute bottom-0 right-0 text-[12px] leading-none text-white/55">{total}</small>}
        {[...byMark.entries()].map(([seen, people]) => {
          const shown = [...people.filter((p) => p.you), ...people.filter((p) => !p.you)].slice(0, 2);
          const more = people.length - shown.length;
          const caught = seen >= show.latestAired;
          return (
            <span key={seen} className="contents">
              <span className="absolute bottom-[19px] flex -translate-x-1/2 items-end" style={{ left: `${at(seen)}%` }}>
                {shown.map((p, i) => (
                  <span
                    key={p.userId}
                    data-band-face={p.you ? "you" : p.name}
                    data-away={p.away || undefined}
                    className={`rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,.5)] ${p.you ? "outline-2 outline-offset-1 outline-white" : ""} ${p.away ? "opacity-55 [filter:saturate(.4)]" : ""} ${i ? "-ml-1.5" : ""}`}
                  >
                    <Avatar id={p.userId} name={p.name} size={24} />
                  </span>
                ))}
                {more > 0 && <span className="type-num -ml-1 grid size-6 place-items-center rounded-[3px] bg-[rgba(16,14,21,.85)] text-[11px] font-bold">+{more}</span>}
              </span>
              <small
                aria-hidden
                className={`type-num absolute bottom-0 -translate-x-1/2 text-[12px] leading-none ${caught ? "text-white" : "text-white/70"}`}
                style={{ left: `${at(seen)}%` }}
              >
                {seen}
              </small>
            </span>
          );
        })}
      </span>
    </NavLink>
  );
}


// ---------- the scoreboard: every game that matters to you, one swipeable row (the user, 2026-11-15) ----------

/**
 * "The game block is cluttered, I don't think the title needs players... some people watch a lot of games, this could get cluttered
 * and populated fast... a swipe navigation": sports leave the bands for one row of game cards, the way a sports app's score strip
 * runs, whatever the number of games. A card is the matchup (no names in it: the couch's faces sit on the side each follows), its
 * state (on now with the score, a final behind a tap, a time), and at most one action: Start a game for a rivalry, Show the score
 * or Watch as if live for a game that just finished, I've watched it for a recording. A game of yours carries the controller.
 * Order: on now, just finished, a move of yours due, rivalries, then each team's next game by time.
 */
export function Scoreboard({ home, couch, shows }: { home: Home; couch: Couch | null; shows: HomeShow[] }) {
  const sd = useSportsDay(couch?.id ?? null);
  const now = sd.now;
  const yesterday = new Date(now - 86_400_000).toLocaleDateString("en-CA");
  const leagues = [...new Set(sd.teams.map((t) => t.league))];
  // From yesterday: a game that finished last night is still "just finished".
  const week = useSportsWeek(yesterday, leagues, sd.teams.length > 0).data;
  const recordings = new Set((useSportsRecordings().data?.recordings ?? []).map((r) => r.game));
  const ours = new Map(sd.teams.map((t) => [`${t.league}|${t.id}`, t]));
  const mineSide = (g: WeekGame) => g.sides.some((x) => ours.get(`${g.league}|${x.id}`)?.you);
  const couchSide = (g: WeekGame) => g.sides.some((x) => ours.has(`${g.league}|${x.id}`));
  const all = (week?.days ?? []).flatMap((d) => d.games).filter(couchSide);
  const due = new Set(home.moves.map((m) => showOfMove(home, m)?.seasonId).filter(Boolean));
  const seasonOf = (g: WeekGame) => shows.find((s) => s.show.kind === "sport" && s.upNext?.airAt && g.at && Math.abs(Date.parse(s.upNext.airAt) - Date.parse(g.at)) < 60_000) ?? null;
  const rival = (g: WeekGame) => {
    if (g.state !== "pre" || seasonOf(g)) return false;
    const a = sd.fansOf(g, 0).map((f) => f.id);
    const b = sd.fansOf(g, 1).map((f) => f.id);
    return a.length > 0 && b.length > 0 && (a.some((x) => !b.includes(x)) || b.some((x) => !a.includes(x)));
  };
  const over = (g: WeekGame) => g.final || g.state === "post";
  const fresh = (g: WeekGame) => over(g) && !!g.at && now - Date.parse(g.at) < 36 * 3600_000;
  type Pick = { g: WeekGame; rank: number };
  const picked = new Map<string, Pick>();
  const take = (g: WeekGame, rank: number) => {
    const had = picked.get(g.id);
    if (!had || rank < had.rank) picked.set(g.id, { g, rank });
  };
  for (const g of all) {
    if (g.state === "in" && !g.final) take(g, 0);
    else if (fresh(g) && (mineSide(g) || recordings.has(g.id))) take(g, 1);
    else if (seasonOf(g) && due.has(seasonOf(g)!.seasonId)) take(g, 2);
    else if (rival(g)) take(g, 3);
  }
  // Each of your teams' next game, and your sports games still to come.
  for (const t of sd.teams.filter((x) => x.you)) {
    const next = all.filter((g) => g.state === "pre" && g.sides.some((x) => x.id === t.id && g.league === t.league)).sort((a, b) => Date.parse(a.at ?? "") - Date.parse(b.at ?? ""))[0];
    if (next) take(next, 4);
  }
  for (const g of all) if (g.state === "pre" && seasonOf(g)) take(g, 4);
  const cards = [...picked.values()].sort((a, b) => a.rank - b.rank || Date.parse(a.g.at ?? "") - Date.parse(b.g.at ?? ""));
  if (!cards.length) return null;
  return (
    <div data-scoreboard={cards.length} className="mb-3">
      <div className="mb-2 flex items-baseline justify-between px-4">
        <span className="type-caption text-[17px]">Games</span>
        <span className="text-[13px] text-muted-foreground">
          {cards.length} {cards.length === 1 ? "game" : "games"}
        </span>
      </div>
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-pl-4 px-4 pb-1 [scrollbar-width:none]">
        {cards.map(({ g, rank }) => {
          const season = seasonOf(g);
          return (
            <ScoreCard
              key={g.id}
              g={g}
              fans={(i) => sd.fansOf(g, i)}
              rival={rank === 3}
              season={season}
              due={!!season && due.has(season.seasonId)}
              fresh={fresh(g)}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * A game on the scoreboard. A tap on a game whose score you can't see yet (one that just finished, or one you're watching as if
 * live) asks first, never shows it (the user, 2026-11-15: "I'd see the game and tap on it, then, still not wanting any spoilers,
 * have the option prompted to me to watch live"): Show the score, or Watch it as if live (kept with your account: it says Started
 * everywhere until you've watched it); a game you're watching asks I've watched it or Keep hiding. Any other game opens its team
 * (or your game's page). Its one action beside the time: Start a game on a rivalry.
 */
function ScoreCard({
  g,
  fans,
  rival,
  season,
  due,
  fresh,
}: {
  g: WeekGame;
  fans: (side: number) => Fan[];
  rival: boolean;
  season: HomeShow | null;
  due: boolean;
  fresh: boolean;
}) {
  const s = useGameScore(g);
  const shownNow = useShownScores();
  const setRecording = useSetRecording();
  const [asking, setAsking] = useState(false);
  const recording = s.recording;
  const over = g.final || g.state === "post";
  const open = s.open && (!fresh || shownNow.has(g.id));
  const live = s.started && !over && open;
  const scored = open && s.started && g.sides[0].score != null;
  const ask = over && !open;
  const status = !s.started
    ? rival
      ? new Date(g.at ?? "").toLocaleDateString([], { weekday: "short" })
      : `${new Date(g.at ?? "").toLocaleDateString([], { weekday: "short" })} ${g.at ? clockOf(g.at).replace(":00", "") : ""}`
    : recording
      ? "Started"
      : over
        ? "Final"
        : open
          ? "On now"
          : "Started";
  const lead = scored ? (Number(g.sides[0].score) > Number(g.sides[1].score) ? 0 : Number(g.sides[1].score) > Number(g.sides[0].score) ? 1 : -1) : -1;
  const stop = (e: React.MouseEvent) => (e.preventDefault(), e.stopPropagation());
  const action = rival ? (
    <button
      type="button"
      data-rivalry-start
      onClick={(e) => (stop(e), openSports(startOn(g.league, g.sides[1].id, g.sides[1].short, { kind: "games", games: [g.id] })))}
      className="nd-press relative flex h-7 flex-none items-center gap-0.5 rounded-[3px] bg-plate px-2 text-[12px] font-bold text-plate-foreground after:absolute after:-inset-1.5"
    >
      Start a game
      <ChevronRight className="size-3.5" aria-hidden />
    </button>
  ) : recording ? (
    <span data-watching className="flex h-6 flex-none items-center gap-1 rounded-[2px] bg-secondary px-1.5 text-[12px] font-bold">
      <Tv className="size-3.5" aria-hidden />
      Watching
    </span>
  ) : season ? (
    <GamesMark due={due} className="relative size-6 flex-none" />
  ) : null;
  const rows = g.sides.map((x, i) => (
    <span key={x.id} className="flex h-7 items-center gap-2">
      <TeamMark abbr={x.abbreviation ?? x.short.slice(0, 3)} color={x.color} size="sm" className="!size-6 !rounded-[3px] !text-[9px]" />
      <b className={`min-w-0 truncate text-[15px] ${lead === -1 || lead === i ? "font-semibold" : "font-medium text-muted-foreground"}`}>{x.short}</b>
      <span className="flex flex-none">
        {fans(i).slice(0, 2).map((f) => (
          <span key={f.id} className="-mr-1 rounded-[3px] shadow-[0_0_0_1.5px_var(--card)]">
            <Avatar id={f.id} name={f.name} size={16} />
          </span>
        ))}
      </span>
      <span className="flex-1" />
      {scored && <b className={`type-num text-[19px] leading-none tabular-nums ${lead === i || lead === -1 ? "" : "text-muted-foreground"}`}>{x.score}</b>}
    </span>
  ));
  const matchupName = `${g.sides[0].short} at ${g.sides[1].short}`;
  const label = `${matchupName}, ${scored ? `${g.sides[0].score} to ${g.sides[1].score}, ${status}` : status}${recording ? ", watching as if live" : ""}`;
  return (
    <div data-score-card={g.id} data-rival={rival || undefined} data-ask={ask || undefined} className="flex w-[164px] flex-none snap-start flex-col rounded-[4px] bg-card px-2.5 pb-2 pt-1.5 text-foreground">
      <span className="flex h-8 items-center gap-1.5">
        {live ? (
          <span className="flex items-center gap-1 rounded-[2px] bg-live px-1.5 py-[2px] text-[12px] font-extrabold text-live-foreground">
            <i className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" aria-hidden />
            Live
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-muted-foreground">{status}</span>
        )}
        <span className="ml-auto flex">{action}</span>
      </span>
      {ask ? (
        <button type="button" aria-label={`${label}. Choose before the score shows`} onClick={() => setAsking(true)} className="nd-press block w-full text-left">
          {rows}
        </button>
      ) : season ? (
        <NavLink href={paths.show(season.seasonId)} channel aria-label={label} className="nd-press block">
          {rows}
        </NavLink>
      ) : (
        <button type="button" aria-label={label} onClick={() => openSports({ kind: "team", league: g.league, team: g.sides[1].id })} className="nd-press block w-full text-left">
          {rows}
        </button>
      )}
      <Sheet
        open={asking}
        onOpenChange={setAsking}
        title={matchupName}
        subtitle={recording ? "You're watching it as if live" : "Final · the score is hidden"}
      >
        <div data-score-ask={g.id} className="flex flex-col gap-2.5 pb-1">
          {recording ? (
            <>
              <Btn
                tone="ink"
                wide
                data-recording-done
                onClick={() => {
                  setAsking(false);
                  showScore(g.id, g.league);
                  void setRecording(g.id, g.league, false);
                }}
              >
                I&rsquo;ve watched it
              </Btn>
              <Btn wide data-recording-keep onClick={() => setAsking(false)}>
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
                  setAsking(false);
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
                  setAsking(false);
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
      </Sheet>
    </div>
  );
}
