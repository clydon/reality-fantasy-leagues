"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { openStartGame } from "../couch/start-game";
import { airTime, lockTime } from "../clock";
import { useSeasonArchive, type ArchivedGame, type GameView, type SeasonRecord } from "../data";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { gameInk, ordinal } from "../games";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { PushedPage, usePushedPage } from "../ui/page";
import { Chip } from "../ui/parts";
import { first, openMoves } from "./moves";
import { openSheet } from "./questions";
import { oneGame } from "./this-week";
import { kindOf } from "@/lib/game/spans";
import type { YourMove } from "./your-move";

// Round 3: a show's games when short games are frequent (docs/design-round/round3-short-games-spec.md, -first-view.md, -shape.md;
// the check's batch: -pfd-eval.md, -critique.md; approved 2026-11-18 and built for good in B3, docs/PLAN-start-a-game-redo.md).
// The Games tab holds what's on: the night's games grouped under the episode they play on (a night row each: who's in, your move),
// the season's games (step 6's rows), the newest episode's results and the door to the archive, games starting later. The archive is
// a page pushed over the tab: your record across the season's finished games, by kind, then each episode's results, a page at a time.
// One result row everywhere a game has ended.

// ---------- the words of a result ----------

/** A finished game in a few words, one rule everywhere (PFD's R3): "You won", "Jordan won", "Tied: you and Riley", "All 4 tied",
 *  "Nobody scored". A tie of everyone is never a win. */
export function resultWords(a: Pick<ArchivedGame, "winners" | "level" | "nobody" | "players">): string {
  if (a.nobody) return "Nobody scored";
  if (a.level) return a.players === 2 ? "A tie" : `All ${a.players} tied`;
  const w = a.winners;
  if (w.length === 1) return w[0].you ? "You won" : `${first(w[0].name)} won`;
  const names = [...w].sort((x, y) => Number(y.you) - Number(x.you)).map((x) => (x.you ? "you" : first(x.name)));
  return `Tied: ${names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join(" and ")}`;
}

/** A game's view as the archive keeps it (its result, at your mark). */
export function resultOf(g: GameView): Pick<ArchivedGame, "winners" | "level" | "nobody" | "players" | "you"> {
  const top = g.table.filter((r) => r.place === 1);
  const mine = g.table.find((r) => r.you);
  return {
    players: g.players,
    winners: top.map((r) => ({ name: r.name, you: r.you, id: r.userId ?? r.playerId, bot: !!r.bot })),
    level: g.table.length > 1 && top.length === g.table.length,
    nobody: g.table.every((r) => r.total === 0 && !r.record?.wins),
    you: mine ? { rank: mine.rank, place: mine.place, total: mine.total } : null,
  };
}

const placeWords = (you: NonNullable<ArchivedGame["you"]>) => (you.rank.startsWith("T") ? you.rank : ordinal(you.place));
const pts = (n: number) => `${Math.round(n * 10) / 10} ${n === 1 ? "pt" : "pts"}`.replace("-", "−");
/** First place for you, alone or shared, in a game somebody won (a tie of everyone isn't a first). */
const firstFor = (a: Pick<ArchivedGame, "you" | "level" | "nobody">) => !!a.you && a.you.place === 1 && !a.level && !a.nobody;

/** A finished game's page line (the week card's state on a finished game, Round 3): "You won · 3 pts", "Jordan won · you 2nd of 4". */
export function finalLine(g: GameView): string {
  const a = resultOf(g);
  const words = resultWords(a);
  if (!a.you || a.nobody) return words;
  if (a.level) return `${words} · ${pts(a.you.total)} each`;
  return a.you.place === 1 ? `${words} · ${pts(a.you.total)}` : `${words} · you ${placeWords(a.you)} of ${a.players}`;
}

// ---------- faces ----------

/** Who won, as faces: one, two overlapped for a shared win, up to three for everyone level; a hairline tile when nobody scored. */
export function WinnerFaces({ a, size = 32 }: { a: Pick<ArchivedGame, "winners" | "nobody">; size?: number }) {
  if (a.nobody || !a.winners.length)
    return (
      <span className="type-num grid flex-none place-items-center rounded-[4px] text-muted-foreground outline-1 -outline-offset-1 outline-border" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>
        –
      </span>
    );
  const shown = [...a.winners].sort((x, y) => Number(y.you) - Number(x.you)).slice(0, 3);
  const off = shown.length === 2 ? Math.round(size * 0.56) : Math.round(size * 0.34);
  return (
    <span className="relative flex-none" style={{ width: size + off * (shown.length - 1), height: size }} aria-hidden>
      {shown.map((w, i) => (
        <span key={w.id} className="absolute top-0 rounded-[4px] ring-2 ring-card" style={{ left: i * off, zIndex: shown.length - i }}>
          <Avatar id={w.id} name={w.name} size={size} bot={w.bot} />
        </span>
      ))}
    </span>
  );
}

// ---------- the result row ----------

/** One finished game: who won (their faces), in words; your place and points, teal when you came first. Opens the game's page. */
export function ResultRow({ a, seasonId }: { a: ArchivedGame; seasonId: string }) {
  const won = firstFor(a);
  return (
    <NavLink
      href={paths.gamePage(seasonId, a.leagueId)}
      data-result-row={a.leagueId}
      data-result-won={won ? "you" : undefined}
      className="nd-press flex min-h-14 items-center gap-3 border-t border-border py-2 first:border-t-0"
    >
      <span className="flex w-[54px] flex-none">
        <WinnerFaces a={a} />
      </span>
      <span className="min-w-0 flex-1">
        <small className="type-caption block truncate text-[13px] tracking-[0.05em] text-muted-foreground">{a.kind}</small>
        <b className="mt-0.5 block truncate text-[16px] font-bold leading-tight">{resultWords(a)}</b>
      </span>
      {a.you && !a.nobody && (
        <span className="flex flex-none flex-col items-end">
          <b className={`type-num text-[22px] leading-none ${won ? "text-good" : ""}`}>{placeWords(a.you)}</b>
          <small className="mt-1 text-[13px] leading-none text-muted-foreground">{pts(a.you.total)}</small>
        </span>
      )}
    </NavLink>
  );
}

// ---------- Again ----------

/** Whether a finished game's kind is already on again after it (a running game of the same kind starting later): then no Again. */
const onAgain = (show: ShowData, kind: string, after: number) => (show.play ?? []).some((x) => !x.over && x.from !== null && x.from > after && kindOf(x.name) === kind);
/** Where Again starts: the episode after a game's end, or the next still to air when that's later (the wizard starts there), when the
 *  season has one. */
const nextAfter = (show: ShowData, to: number) => {
  const n = Math.max(to + 1, show.latestAired + 1);
  return show.header?.episodeCount && n > show.header.episodeCount ? null : n;
};

/** Again on a finished game's page (Round 3): the same game, its people and rules, on what comes next; the wizard opens on its
 *  screen ready to Start (Run it back's path), never made for you. */
export function AgainRow({ show, g }: { show: ShowData; g: GameView }) {
  const seasonId = show.header?.seasonId ?? "";
  const kind = kindOf(g.name);
  const n = g.to !== null ? nextAfter(show, g.to) : null;
  if (n === null || g.to === null || onAgain(show, kind, g.to) || g.solo) return null;
  return (
    <div className="mx-4 mt-4" data-again={g.leagueId}>
      <button
        type="button"
        onClick={() => openStartGame({ seasonId, couchId: show.couch?.id ?? null, again: g.leagueId })}
        className="nd-press flex min-h-14 w-full items-center gap-3 rounded-[4px] px-4 py-2 text-left outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input"
      >
        <RotateCcw className="size-5 flex-none" aria-hidden />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-bold">{`Again ${oneGame(g) ? "for" : "from"} ${show.words.episode} ${n}`}</b>
          <small className="block text-[13px] text-muted-foreground">{kind}, the same people and rules</small>
        </span>
      </button>
    </div>
  );
}

/** Again in the Games tab's results (Round 3): each of the newest episode's finished games whose kind isn't on again yet, one tap
 *  each to its screen on the next episode. */
function AgainLine({ show, games }: { show: ShowData; games: ArchivedGame[] }) {
  const seasonId = show.header?.seasonId ?? "";
  const seen = new Set<string>();
  const ready = games.filter((a) => a.to !== null && !seen.has(a.kind) && !!seen.add(a.kind) && nextAfter(show, a.to) !== null && !onAgain(show, a.kind, a.to));
  if (!ready.length) return null;
  const n = nextAfter(show, ready[0].to as number);
  return (
    <div data-again-line className="border-t border-border py-2.5">
      <p className="flex items-center gap-1.5 text-[15px] font-semibold">
        <RotateCcw className="size-4 flex-none" aria-hidden />
        {`Again for ${show.words.episode} ${n}`}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-2">
        {ready.map((a) => (
          <button key={a.leagueId} type="button" data-again={a.leagueId} onClick={() => openStartGame({ seasonId, couchId: show.couch?.id ?? null, again: a.leagueId })} className="nd-press grid min-h-11 place-items-center">
            <span className="grid h-9 place-items-center whitespace-nowrap rounded-[3px] px-3 text-[14px] font-bold outline-[1.5px] -outline-offset-[1.5px] outline-input">{a.kind}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- the night row ----------

/** One of a night's games before its results (no leaderboard: nothing has counted): who's in (you marked), your move's state, its
 *  button. The lock is said once, by the episode's heading, when it's the air time. */
function NightRow({ show, g, move }: { show: ShowData; g: GameView; move: YourMove | null }) {
  const nav = useNav();
  const seasonId = show.header?.seasonId ?? "";
  const ep = g.from as number;
  const E = show.words.ep;
  const seats = [...g.table].sort((a, b) => Number(b.you) - Number(a.you));
  const inSet = g.sheetIn ? new Set(g.sheetIn) : g.progress && g.progress.episode === ep ? new Set(g.progress.people.filter((p) => p.done).map((p) => p.playerId)) : null;
  const isIn = (id: string) => (inSet ? inSet.has(id) : true);
  const mineIn = !!g.you && isIn(g.you.playerId);
  const sheet = g.sheet;
  const air = show.upNext?.number === ep ? show.upNext.airAt : null;
  const atAir = !!air && !!sheet?.closesAt && Math.abs(Date.parse(air) - Date.parse(sheet.closesAt)) < 60_000;
  const lock = sheet?.closesAt && !atAir ? lockTime(Date.parse(sheet.closesAt)) : null;
  let state: string;
  let action: string | null = null;
  let go: (() => void) | null = null;
  if (sheet && sheet.of > 0) {
    const all = sheet.answered === sheet.of;
    const q = `${sheet.of} ${sheet.of === 1 ? "question" : "questions"}`;
    state = all ? `Answered${lock ? ` · change until ${lock}` : ""}` : sheet.answered ? `${sheet.answered} of ${sheet.of} answered${lock ? ` · locks ${lock}` : ""}` : `${q}${lock ? ` · locks ${lock}` : ""}`;
    action = all ? "Change" : "Answer";
    go = () => openSheet({ seasonId, leagueId: g.leagueId, episode: sheet.episode, game: g.name });
  } else if (sheet?.behind) state = `After you reveal ${E} ${sheet.behind}`;
  else if (move) {
    state = move.line;
    action = move.action;
    go = () => ("tab" in move.go ? openMoves(move.go.tab, g.leagueId) : nav.push(move.go.href));
  } else if (ep <= show.latestAired) state = mineIn ? "Answered" : "Not answered";
  else state = mineIn ? "Answered" : "Not open yet";
  const count = inSet && g.table.length > 1 ? `${seats.filter((r) => inSet.has(r.playerId)).length} of ${seats.length} in` : null;
  return (
    <div data-night-row={g.leagueId} data-night-in={mineIn ? "yes" : "no"} className="border-t border-border py-2 first:border-t-0">
      <div className="flex min-h-11 items-center gap-2">
        <NavLink href={paths.gamePage(seasonId, g.leagueId)} className="nd-press -mx-1 flex min-h-11 min-w-0 flex-1 items-center rounded-[3px] px-1">
          <b className="type-caption min-w-0 truncate text-[19px] leading-none">{kindOf(g.name)}</b>
        </NavLink>
        {action && go && (
          <button type="button" data-night-move={g.leagueId} onClick={go} className="nd-press -my-1 grid min-h-11 flex-none place-items-center">
            <span className="grid h-9 place-items-center whitespace-nowrap rounded-[3px] px-3.5 text-[15px] font-bold outline-[1.5px] -outline-offset-[1.5px] outline-input">{action}</span>
          </button>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2.5">
        <span className="flex flex-none items-center gap-1.5" aria-label={count ?? undefined}>
          {seats.map((r) => {
            const on = isIn(r.playerId);
            // You: always outlined in the foreground (solid when you're in, dashed when you're not); the others only while they aren't.
            const ring = r.you ? (on ? "outline-[1.5px] outline-offset-1 outline-foreground" : "opacity-60 outline-[1.5px] outline-offset-1 outline-dashed outline-foreground") : on ? "" : "opacity-40 outline-[1.5px] outline-offset-1 outline-dashed outline-muted-foreground";
            return (
              <span key={r.playerId} data-in={on ? "yes" : "no"} data-you={r.you || undefined} className={`rounded-[4px] ${ring}`} title={r.you ? "You" : r.name}>
                <Avatar id={r.userId ?? r.playerId} name={r.name} size={22} bot={r.bot} />
              </span>
            );
          })}
        </span>
        <small className="min-w-0 truncate text-[13px] leading-snug text-muted-foreground">{[count, state].filter(Boolean).join(" · ")}</small>
      </div>
    </div>
  );
}

// ---------- the Games tab ----------

/** Where each game you play here sits (the spec's rule): a night's (one episode, not over: under its episode), the season's (any
 *  other span not over), starting later; finished games are the archive's. `next`: your next episode; `airing`: the next to air. */
export function sortGames(show: ShowData) {
  const play = (show.play ?? []).filter((g) => !g.stageOf);
  const next = (show.seenThrough ?? show.latestAired) + 1;
  const airing = show.latestAired + 1;
  const reach = Math.max(next, airing);
  const running = play.filter((g) => !g.over);
  const nights = running.filter((g) => oneGame(g) && (g.from as number) <= reach);
  const later = running.filter((g) => !nights.includes(g) && (oneGame(g) || g.from === null || g.from > airing));
  const season = running.filter((g) => !nights.includes(g) && !later.includes(g));
  const eps = [...new Set(nights.map((g) => g.from as number))].sort((a, b) => a - b);
  return { play, next, airing, nights, later, season, eps };
}

/** A night's game you can move on now (its sheet open with answers to give, or a move due). */
const dueIn = (g: GameView, moves: Map<string, YourMove>) => !!moves.get(g.leagueId)?.due || (!!g.sheet && g.sheet.of > 0 && g.sheet.answered < g.sheet.of);
const answeredIn = (g: GameView) => !!g.you && (g.sheetIn ?? []).includes(g.you.playerId);

/** Your record: firsts (alone and shared), each opponent's ahead, level and behind, and each kind's firsts; its one line. */
export function tally(rec: SeasonRecord) {
  const decided = (g: SeasonRecord["games"][number]) => !g.level && !g.nobody;
  const ones = (g: SeasonRecord["games"][number]) => Object.values(g.places).filter((p) => p === 1).length;
  const firstsOf = (games: SeasonRecord["games"]) => games.filter((g) => decided(g) && g.mine === 1);
  const alone = rec.games.filter((g) => decided(g) && g.mine === 1 && ones(g) === 0).length;
  const firsts = firstsOf(rec.games).length;
  const people = rec.people.map((p) => {
    let above = 0;
    let level = 0;
    let below = 0;
    for (const g of rec.games) {
      const t = g.places[p.key];
      if (t == null || g.mine == null || g.nobody) continue;
      if (g.mine < t) above++;
      else if (g.mine === t) level++;
      else below++;
    }
    const theirs = rec.games.filter((g) => decided(g) && g.places[p.key] === 1).length;
    return { ...p, above, level, below, firsts: theirs };
  });
  const kinds = new Map<string, { n: number; firsts: number }>();
  for (const g of rec.games) {
    const k = kinds.get(g.kind) ?? { n: 0, firsts: 0 };
    k.n++;
    if (decided(g) && g.mine === 1) k.firsts++;
    kinds.set(g.kind, k);
  }
  const better = people.filter((p) => !p.bot && p.firsts > firsts);
  const line =
    rec.games.length === 0
      ? "Nothing finished yet"
      : firsts === 0
        ? "No firsts yet"
        : `${firsts} ${firsts === 1 ? "first" : "firsts"}${people.some((p) => !p.bot) ? ` · ${better.length === 0 ? "most on the couch" : better.length === 1 ? `${first(better[0].name)} has more` : `${ordinal(better.length + 1)} on the couch`}` : ""}`;
  return { played: rec.games.length, firsts, alone, shared: firsts - alone, people, kinds, line };
}

/** The Games tab's body (Round 3) (above Join a game, Start a game and How it works, which stay as they are). `row` draws a season game
 *  (step 6's row); `oneNight` the next episode's one-night things that aren't games (bingo, Call it, polls, trivia), folded to a line. */
export function WhatsOn({ show, moves, row, oneNight }: { show: ShowData; moves: Map<string, YourMove>; row: (g: GameView) => ReactNode; oneNight: ReactNode }) {
  const seasonId = show.header?.seasonId ?? "";
  const couchId = show.couch?.id ?? null;
  const { airing, nights, later, season, eps } = sortGames(show);
  const archive = useSeasonArchive(seasonId, couchId, null, !!seasonId);
  const page0 = archive.data?.pages[0];
  const newest = page0?.games.length ? Math.max(...page0.games.map((g) => g.ended)) : null;
  const last = newest !== null ? (page0?.games ?? []).filter((g) => g.ended === newest) : [];
  const record = page0?.record ? tally(page0.record) : null;
  const door = usePushedPage("archive");
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [extras, setExtras] = useState(false);
  const E = show.words.episode;
  // The next to air holds the one-night things; it's a block even with no night's game of its own. With nothing airing next (a season
  // at your own pace, or over) they're a fold of their own under the games.
  const blocks = [...eps];
  if (!blocks.includes(airing) && show.upNext?.number === airing) blocks.push(airing);
  blocks.sort((a, b) => a - b);
  const home = blocks.includes(airing) ? airing : null;
  const fold = (border: boolean) => (
    <div data-night-extras={extras ? "open" : "closed"} className={border ? "border-t border-border" : ""}>
      <button type="button" aria-expanded={extras} onClick={() => setExtras(!extras)} className="flex min-h-12 w-full items-center gap-1.5 text-left text-[15px] font-semibold text-muted-foreground">
        Also: bingo, calls, trivia and polls
        <ChevronDown className={`size-4 transition-transform duration-200 ${extras ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {extras && oneNight}
    </div>
  );
  return (
    <div data-whats-on>
      {blocks.map((n) => {
        const here = nights.filter((g) => g.from === n);
        const aired = n <= show.latestAired;
        // An episode that's aired and is only waiting on your reveal folds to a line (nothing to do there); one with a move open stays.
        const folded = aired && !here.some((g) => dueIn(g, moves)) && !opened.has(n);
        const when = n === airing && show.upNext?.airAt ? airTime(Date.parse(show.upNext.airAt)) : null;
        // A count of games beside "Game 1" (a sport's word for its episode) would say game twice: there it's left out.
        const games = here.length && !/^game$/i.test(E) ? `${here.length} ${here.length === 1 ? "game" : "games"}` : null;
        const done = here.filter(answeredIn).length;
        const state = done === here.length ? "answered" : `${done} of ${here.length} answered`;
        return (
          <section key={n} data-night={n} data-night-folded={folded ? "yes" : "no"} className="mt-5 px-2 first:mt-4">
            {folded ? (
              <button type="button" onClick={() => setOpened(new Set([...opened, n]))} className="nd-press flex min-h-14 w-full items-center gap-3 rounded-[10px] bg-card px-3.5 py-2 text-left">
                <span className="min-w-0 flex-1">
                  <b className="type-caption block text-[15px] tracking-[0.04em]">{`${E} ${n}`}</b>
                  <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{[games && `${games} ${state}`, "results when you reveal it"].filter(Boolean).join(" · ")}</small>
                </span>
                <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden />
              </button>
            ) : (
              <>
                <h2 className="flex items-baseline gap-2 px-2 pb-2">
                  <b className="type-caption text-[15px] tracking-[0.04em]">{`${E} ${n}`}</b>
                  <small className="min-w-0 truncate text-[13px] text-muted-foreground">{(aired ? [games, "results when you reveal it"] : [when, games]).filter(Boolean).join(" · ")}</small>
                </h2>
                <div className="rounded-[10px] bg-card px-3.5 py-1">
                  {here.map((g) => (
                    <NightRow key={g.leagueId} show={show} g={g} move={moves.get(g.leagueId) ?? null} />
                  ))}
                  {n === home && fold(here.length > 0)}
                </div>
              </>
            )}
          </section>
        );
      })}
      {season.length > 0 && (
        <section className="mt-6 px-2" data-season-games>
          <h2 className="flex items-baseline gap-2 px-2 pb-2">
            <b className="type-caption text-[15px] tracking-[0.04em]">Running</b>
            <small className="text-[13px] text-muted-foreground">{season.length === 1 ? "1 game" : `${season.length} games`} over many {E.toLowerCase()}s</small>
          </h2>
          <div className="flex flex-col gap-2.5">{season.map((g) => row(g))}</div>
        </section>
      )}
      {(last.length > 0 || (record && record.played > 0)) && (
        <section className="mt-6 px-2" data-results={newest ?? undefined}>
          <h2 className="flex items-baseline gap-2 px-2 pb-2">
            <b className="type-caption text-[15px] tracking-[0.04em]">{newest !== null ? `${E} ${newest}'s results` : "Results"}</b>
          </h2>
          <div className="rounded-[10px] bg-card px-3.5 py-1">
            {last.map((a) => (
              <ResultRow key={a.leagueId} a={a} seasonId={seasonId} />
            ))}
            <AgainLine show={show} games={last} />
            <button type="button" data-archive-open onClick={door.show} className="nd-press -mx-1 flex min-h-14 w-[calc(100%+8px)] items-center gap-3 rounded-[3px] border-t border-border px-1 py-2 text-left">
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-bold">
                  All finished games <span className="type-num ml-1 text-[16px]">{record?.played ?? ""}</span>
                </b>
                <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{record?.line ?? " "}</small>
              </span>
              <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
            </button>
          </div>
        </section>
      )}
      {later.length > 0 && (
        <section className="mt-6 px-2" data-later>
          <h2 className="px-2 pb-2">
            <b className="type-caption text-[15px] tracking-[0.04em]">Starting later</b>
          </h2>
          <div className="rounded-[10px] bg-card px-3.5 py-1">
            {later.map((g) => (
              <NavLink key={g.leagueId} href={paths.gamePage(seasonId, g.leagueId)} className="nd-press flex min-h-12 items-center gap-2 border-t border-border first:border-t-0">
                {!oneGame(g) && <i className="size-2 flex-none rounded-full" style={{ background: gameInk(g.gameName) }} aria-hidden />}
                <b className="min-w-0 flex-1 truncate text-[15px] font-semibold">{kindOf(g.name)}</b>
                <small className="flex-none text-[13px] text-muted-foreground">{g.from === null ? `When ${g.phase ?? "its phase"} starts` : `Starts with ${E} ${g.from}`}</small>
              </NavLink>
            ))}
          </div>
        </section>
      )}
      {home === null && (
        <section className="mt-6 px-2">
          <div className="rounded-[10px] bg-card px-3.5">{fold(false)}</div>
        </section>
      )}
      <ArchivePage show={show} open={door.open} onClose={door.close} />
    </div>
  );
}

// ---------- the archive ----------

/** The next page's episodes, from the record (the server pages the same way: 20 games, ending on a whole episode). */
function nextRange(rec: SeasonRecord | undefined, before: number, size = 20): [number, number] | null {
  const left = (rec?.games ?? []).map((g) => g.ended).filter((e) => e < before).sort((a, b) => b - a);
  if (!left.length) return null;
  let n = Math.min(size, left.length);
  while (n < left.length && left[n] === left[n - 1]) n++;
  return [left[0], left[n - 1]];
}

const dateOf = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null);

/** One opponent's row: the split bar on one scale for every row (the most games shared is the full width), each count in its part. */
function RecordRow({ p, most }: { p: ReturnType<typeof tally>["people"][number]; most: number }) {
  const n = p.above + p.level + p.below;
  const part = (k: number) => (k ? `max(22px, ${(k / Math.max(1, n)) * 100}%)` : "0px");
  return (
    <div data-record-person={p.name} className="grid min-h-11 grid-cols-[26px_68px_minmax(0,1fr)] items-center gap-2.5 border-t border-border py-1.5">
      <Avatar id={p.id} name={p.name} size={26} bot={p.bot} />
      <span className="truncate text-[15px] font-semibold">{first(p.name)}</span>
      <span className="flex h-5" style={{ width: `${(n / most) * 100}%` }} aria-label={`You ahead in ${p.above}, level in ${p.level}, ${first(p.name)} ahead in ${p.below}`}>
        {p.above > 0 && <i className="type-num grid h-full place-items-start pl-1.5 text-[13px] not-italic leading-5 text-background bg-foreground" style={{ flex: `1 1 ${part(p.above)}` }}>{p.above}</i>}
        {p.level > 0 && <i className="type-num grid h-full place-items-center text-[13px] not-italic leading-5 text-muted-foreground bg-input" style={{ flex: `1 1 ${part(p.level)}` }}>{p.level}</i>}
        {p.below > 0 && <i className="type-num grid h-full place-items-end pr-1.5 text-[13px] not-italic leading-5 text-foreground bg-edge" style={{ flex: `1 1 ${part(p.below)}` }}>{p.below}</i>}
      </span>
    </div>
  );
}

/** The archive: your record, by kind, then each episode's results, newest first, a page at a time. */
export function ArchivePage({ show, open, onClose }: { show: ShowData; open: boolean; onClose: () => void }) {
  const seasonId = show.header?.seasonId ?? "";
  const couchId = show.couch?.id ?? null;
  const [kind, setKind] = useState<string | null>(null);
  const all = useSeasonArchive(seasonId, couchId, null, open && !!seasonId);
  const q = useSeasonArchive(seasonId, couchId, kind, open && !!seasonId);
  const pages = q.data?.pages ?? [];
  const rec = pages[0]?.record;
  const allRec = all.data?.pages[0]?.record;
  const byKind = allRec ? tally(allRec).kinds : new Map<string, { n: number; firsts: number }>();
  const kinds = all.data?.pages[0]?.kinds ?? [];
  const t = rec ? tally(rec) : null;
  const allT = allRec ? tally(allRec) : null;
  const games = pages.flatMap((p) => p.games);
  const byEp = new Map<number, ArchivedGame[]>();
  for (const g of games) byEp.set(g.ended, [...(byEp.get(g.ended) ?? []), g]);
  const cursor = pages.at(-1)?.next ?? null;
  const range = q.hasNextPage && cursor !== null ? nextRange(rec, cursor) : null;
  const E = show.words.episode;
  const most = t ? Math.max(1, ...t.people.map((p) => p.above + p.level + p.below)) : 1;
  const label = show.header ? `${(show.header.show.name ?? "").replace(/^The /, "")}${show.header.seasonNumber ? ` · Season ${show.header.seasonNumber}` : ""}` : "";
  const aired = (n: number) => dateOf(show.episodes?.episodes.find((e) => e.number === n)?.airAt);
  return (
    <PushedPage open={open} onClose={onClose} title="Finished games" back="Games">
      <div data-archive className="pb-16">
        {label && <p className="px-4 pt-1 text-[13px] text-muted-foreground">{label}, as far as you&apos;ve seen</p>}
        {q.isError ? (
          <div className="px-4 pt-6" data-archive-error>
            <p className="text-[15px]">Your finished games didn&apos;t load.</p>
            <button type="button" onClick={() => q.refetch()} className="nd-press mt-3 grid h-11 place-items-center rounded-[4px] px-4 text-[15px] font-bold outline-[1.5px] -outline-offset-[1.5px] outline-input">
              Try again
            </button>
          </div>
        ) : !q.data ? (
          <div aria-busy className="mx-4 mt-4 h-60 animate-pulse rounded-[4px] bg-card" />
        ) : (
          <>
            {t && t.played > 0 && (
              <section data-record className="px-4 pt-4">
                <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <b className="type-num text-[44px] leading-none">{t.firsts}</b>
                  <span className="text-[16px] font-semibold">
                    {t.firsts === 1 ? "first" : "firsts"} of {t.played}
                  </span>
                  <span className="text-[15px] text-muted-foreground">
                    {t.alone} alone · {t.shared} shared
                  </span>
                </p>
                {t.people.length > 0 && (
                  <div className="mt-3">
                    <p className="grid grid-cols-[26px_68px_minmax(0,1fr)] gap-2.5 pb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                      <span className="col-start-3 flex justify-between">
                        <span>You ahead</span>
                        <span>Level</span>
                        <span>Them ahead</span>
                      </span>
                    </p>
                    {[...t.people]
                      .sort((a, b) => Number(a.bot) - Number(b.bot) || b.above + b.level + b.below - (a.above + a.level + a.below) || a.name.localeCompare(b.name))
                      .map((p) => (
                        <RecordRow key={p.key} p={p} most={most} />
                      ))}
                    <p className="mt-1.5 text-[13px] text-muted-foreground">A game nobody scored in counts for neither side.</p>
                  </div>
                )}
              </section>
            )}
            {kinds.length > 1 && (
              <div className="flex flex-wrap gap-2 px-4 pt-5" data-archive-kinds>
                <Chip on={kind === null} onClick={() => setKind(null)} aria-label={allT ? `All: ${allT.firsts} firsts of ${allT.played}` : "All"}>
                  All <small className="type-num ml-1.5 text-[13px] font-semibold opacity-75">{allT ? `${allT.firsts} of ${allT.played}` : ""}</small>
                </Chip>
                {kinds.map((k) => {
                  const f = byKind.get(k.kind);
                  return (
                    <Chip key={k.kind} on={kind === k.kind} onClick={() => setKind(k.kind)} aria-label={`${k.kind}: ${f?.firsts ?? 0} firsts of ${k.n}`}>
                      {k.kind} <small className="type-num ml-1.5 text-[13px] font-semibold opacity-75">{`${f?.firsts ?? 0} of ${k.n}`}</small>
                    </Chip>
                  );
                })}
              </div>
            )}
            {games.length === 0 ? (
              <p className="px-4 pt-6 text-[15px] text-muted-foreground">Nothing&apos;s finished yet, as far as you&apos;ve seen.</p>
            ) : (
              [...byEp].map(([n, list]) => (
                <section key={n} className="mt-6 px-2" data-archive-ep={n}>
                  <h2 className="flex items-baseline gap-2 px-2 pb-2">
                    <b className="type-caption text-[15px] tracking-[0.04em]">{`${E} ${n}`}</b>
                    <small className="text-[13px] text-muted-foreground">{[aired(n), list.length === 1 ? "1 game" : `${list.length} games`].filter(Boolean).join(" · ")}</small>
                  </h2>
                  <div className="rounded-[10px] bg-card px-3.5 py-1">
                    {list.map((a) => (
                      <ResultRow key={a.leagueId} a={a} seasonId={seasonId} />
                    ))}
                  </div>
                </section>
              ))
            )}
            {q.hasNextPage && (
              <div className="px-4 pt-5">
                <button type="button" data-archive-more disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()} className="nd-press grid h-12 w-full place-items-center rounded-[4px] text-[15px] font-bold outline-[1.5px] -outline-offset-[1.5px] outline-input disabled:opacity-60">
                  {q.isFetchingNextPage ? "Loading…" : range ? (range[0] === range[1] ? `${E} ${range[0]}` : `${E}s ${range[0]} to ${range[1]}`) : "Older episodes"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PushedPage>
  );
}

// ---------- Tonight ----------

/** Tonight's Your games, Round 3: under the season games' minis, the newest episode's results (the same rows), episodes waiting on
 *  your reveal as one line, and the next episode's games as one line each (the strip holds their moves). */
export function TonightNights({ show, under = true }: { show: ShowData; under?: boolean }) {
  const seasonId = show.header?.seasonId ?? "";
  const couchId = show.couch?.id ?? null;
  const { nights, eps } = sortGames(show);
  const archive = useSeasonArchive(seasonId, couchId, null, !!seasonId);
  const page0 = archive.data?.pages[0];
  const newest = page0?.games.length ? Math.max(...page0.games.map((g) => g.ended)) : null;
  const last = newest !== null ? (page0?.games ?? []).filter((g) => g.ended === newest && g.from === g.to) : [];
  const waiting = eps.filter((n) => n <= show.latestAired && !nights.some((g) => g.from === n && !!g.sheet && g.sheet.of > 0 && g.sheet.answered < g.sheet.of));
  const n = eps.find((x) => !waiting.includes(x)) ?? null;
  const here = n === null ? [] : nights.filter((g) => g.from === n);
  const held = nights.filter((g) => waiting.includes(g.from as number)).length;
  const E = show.words.ep;
  if (!last.length && !here.length && !held) return null;
  return (
    <div data-tonight-nights className={`flex flex-col gap-4 ${under ? "mt-2 border-t border-border pt-3" : ""}`}>
      {last.length > 0 && (
        <div>
          <p className="type-caption pb-1 text-[15px] tracking-[0.04em] text-muted-foreground">{`${E} ${newest}'s results`}</p>
          {last.map((a) => (
            <ResultRow key={a.leagueId} a={a} seasonId={seasonId} />
          ))}
        </div>
      )}
      {held > 0 && (
        <p className="flex min-h-11 items-center text-[15px] text-muted-foreground" data-tonight-waiting>
          {`${waiting.length === 1 ? `${E} ${waiting[0]}` : `${E}s ${waiting[0]} to ${waiting.at(-1)}`} · ${held} ${held === 1 ? "game" : "games"} waiting on your reveal`}
        </p>
      )}
      {here.length > 0 && (
        <div>
          <p className="type-caption pb-1 text-[15px] tracking-[0.04em] text-muted-foreground">{`For ${E} ${n}`}</p>
          {here.map((g) => {
            const s = g.sheet;
            const state = s && s.of > 0 ? (s.answered === s.of ? "Answered" : `${s.of - s.answered} to answer`) : s?.behind ? `After you reveal ${E} ${s.behind}` : answeredIn(g) ? "Answered" : "Not open yet";
            return (
              <NavLink key={g.leagueId} href={paths.gamePage(seasonId, g.leagueId)} data-tonight-night={g.leagueId} className="nd-press flex min-h-11 items-center gap-2 border-t border-border first:border-t-0">
                <b className="min-w-0 flex-1 truncate text-[15px] font-semibold">{kindOf(g.name)}</b>
                <small className="flex-none text-[13px] text-muted-foreground">{state}</small>
                <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
