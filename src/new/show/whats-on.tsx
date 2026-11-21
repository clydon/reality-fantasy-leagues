"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Plus, RotateCcw } from "lucide-react";
import { openStartGame } from "../couch/start-game";
import { airTime, lockTime } from "../clock";
import { useCouchGames, useSeasonArchive, type ArchivedGame, type GameView, type JoinGame, type SeasonRecord } from "../data";
import { joinable, JoinButton, JoinGameSheet } from "../couch/join-game";
import { GAME_NAMES } from "@/lib/server/league-season";
import { Block } from "./parts";
import { quickName } from "./night";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { gameInk, ordinal } from "../games";
import { episodesOf, type ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { PushedPage, usePushedPage } from "../ui/page";
import { Btn, Chip } from "../ui/parts";
import { first, openMoves } from "./moves";
import { openSheet } from "./questions";
import { oneGame } from "./this-week";
import { kindOf, spanName } from "@/lib/game/spans";
import { yourMove, type YourMove } from "./your-move";

// The Games tab as the way into games (docs/design-round/games-launcher-spec.md, -first-view.md, -shape.md, -check.md; 2026-11-21),
// after Round 3's "what's on" (docs/design-round/round3-short-games-spec.md, 2026-11-18): the next episode's one-episode games first
// (yours, the couch's to join, Start one), your longer games a row each, longer games to join, Start, your record. No results: Tonight
// holds the night, each game's page the season. The archive is a page pushed over the tab: your record across the season's finished
// games, by kind, then each episode's results, a page at a time.
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
            <span className="grid h-9 place-items-center whitespace-nowrap rounded-[3px] px-3 text-[14px] font-bold outline-[1.5px] -outline-offset-[1.5px] outline-input">{quickName(a.kind)}</span>
          </button>
        ))}
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

/**
 * The Games tab's body, the way into games (docs/design-round/games-launcher-spec.md, -first-view.md, -shape.md; the user, 2026-11-21:
 * Tonight is the night, Games is what you can play, a game's page is the season). The smallest step first:
 *   1. For Ep N, each episode with one-episode games (your next first; one that's aired and only waits on your reveal folds to a
 *      line): yours (their state, their move), then the couch's you're not in (who's in, when it locks, Join); in your next
 *      episode's block, Start a one-episode game with Again, and the episode's extras folded (bingo, trivia, calls, polls);
 *   2. Your longer games, a row each (`row`), soonest to end first, games starting later last; five, or four and a fold;
 *   3. Longer games to join, a row each;
 *   4. `start`: Start a longer game;
 *   5. Your record: one row to the finished games' page.
 * No leaderboards, no Last picks, no results: Tonight and each game's page hold them. Someone who only watches gets the same page
 * without block 2. `row` draws a longer game (games.tsx LongRow); `oneNight` the episode's extras that aren't games.
 */
export function WhatsOn({ show, moves, row, oneNight, start }: { show: ShowData; moves: Map<string, YourMove>; row: (g: GameView) => ReactNode; oneNight: ReactNode; start: ReactNode }) {
  const seasonId = show.header?.seasonId ?? "";
  const couchId = show.couch?.id ?? null;
  const playing = show.games.some((g) => g.yourRole);
  const { next, airing, nights, later, season, eps } = sortGames(show);
  const archive = useSeasonArchive(seasonId, couchId, null, !!seasonId);
  const couchGames = useCouchGames(couchId, !!couchId && !show.solo && !show.readOnly);
  const page0 = archive.data?.pages[0];
  const newest = page0?.games.length ? Math.max(...page0.games.map((g) => g.ended)) : null;
  const last = newest !== null ? (page0?.games ?? []).filter((g) => g.ended === newest && g.from === g.to) : [];
  const record = page0?.record ? tally(page0.record) : null;
  const door = usePushedPage("archive");
  const [opened, setOpened] = useState<Set<number>>(new Set());
  // Someone in no games sees the episode's extras open: the lightest thing to play (the check, PFD L4).
  const [extras, setExtras] = useState(!playing);
  const [allLong, setAllLong] = useState(false);
  const [allJoin, setAllJoin] = useState(false);
  const [joining, setJoining] = useState<JoinGame | null>(null);
  const E = show.words.ep;
  // The couch's games here you could join or ask to: one-episode ones under their episode, the rest as longer games to join.
  const open = (couchGames.data?.games ?? []).filter((g) => g.seasonId === seasonId && joinable(g));
  const quickTo = (n: number) => open.filter((g) => !!g.span && g.span.from === g.span.to && g.span.from === n);
  const longTo = open.filter((g) => !(g.span && g.span.from === g.span.to));
  // Where a one-episode game can still be started: your next episode when it's still to air, else the next to air.
  const home = show.upNext?.number === airing ? airing : next <= show.latestAired ? next : null;
  const reach = Math.max(next, airing);
  const blocks = [...new Set([...eps, ...(home !== null ? [home] : []), ...open.filter((g) => g.span && g.span.from === g.span.to && g.span.from >= next && g.span.from <= reach).map((g) => g.span!.from)])].sort((a, b) => a - b);
  // Your longer games, soonest to end first (Tonight's order: a game sits in the same place on both tabs), starting later last.
  const endOf = (g: GameView) => g.to ?? episodesOf(show) + 1;
  const longer = [...[...season].sort((a, b) => endOf(a) - endOf(b)), ...[...later].filter((g) => !oneGame(g)).sort((a, b) => (a.from ?? 999) - (b.from ?? 999))];
  // Five, or four and a fold; a game whose move is due never folds (the check: a due move hidden under "4 more").
  const dueLong = (g: GameView) => !!moves.get(g.leagueId)?.due;
  const longShown = allLong || longer.length <= 5 ? longer : longer.filter((g, i) => i < 4 || dueLong(g));
  const longFolded = longer.filter((g) => !longShown.includes(g));
  const joinShown = allJoin || longTo.length <= 5 ? longTo : longTo.slice(0, 4);
  const nameOf = (g: GameView) => {
    const twin = longer.filter((x) => x.gameType === g.gameType).length > 1;
    return g.solo === "public" ? "Everyone" : g.page?.main === "stages" || (twin && g.name !== g.gameName) ? g.name : (GAME_NAMES[g.gameName] ?? g.gameName);
  };
  const joinName = (g: JoinGame) => (longTo.filter((x) => x.gameType === g.gameType).length > 1 || (show.play ?? []).some((x) => x.gameType === g.gameType && !oneGame(x)) ? g.name : (GAME_NAMES[g.gameName] ?? g.gameName));
  const extrasFold = (
    <div data-night-extras={extras ? "open" : "closed"} className="border-t border-border">
      <button type="button" aria-expanded={extras} onClick={() => setExtras(!extras)} className="flex min-h-12 w-full items-center gap-1.5 text-left text-[14px] font-semibold text-muted-foreground">
        {`Also each ${show.words.episode.toLowerCase()}: bingo, trivia, calls and polls`}
        <ChevronDown className={`size-4 transition-transform duration-200 ${extras ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {extras && oneNight}
    </div>
  );
  return (
    <div data-whats-on>
      {blocks.map((n) => {
        const mine = nights.filter((g) => g.from === n);
        const theirs = quickTo(n);
        const aired = n <= show.latestAired;
        // An episode that's aired and only waits on your reveal folds to a line (nothing to do there); one with a move open stays.
        const folded = aired && n !== home && !mine.some((g) => dueIn(g, moves)) && !theirs.length && !opened.has(n);
        const when = n === airing && show.upNext?.airAt ? airTime(Date.parse(show.upNext.airAt)) : null;
        if (folded) {
          const done = mine.filter(answeredIn).length;
          return (
            <section key={n} data-night={n} data-night-folded="yes" className="mt-[26px] px-4">
              <button type="button" onClick={() => setOpened(new Set([...opened, n]))} className="nd-press flex min-h-14 w-full items-center gap-3 border-y border-border py-2 text-left">
                <span className="min-w-0 flex-1">
                  <b className="type-caption block text-[17px]">{`For ${E} ${n}`}</b>
                  <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{`${mine.length} ${mine.length === 1 ? "game" : "games"} · ${done === mine.length ? "answered" : `${done} of ${mine.length} answered`} · results when you reveal it`}</small>
                </span>
                <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden />
              </button>
            </section>
          );
        }
        return (
          <Block key={n} title={`For ${E} ${n}`} aside={aired ? "Results when you reveal it" : when ?? undefined}>
            <div data-night={n} data-games-quick={n === home ? "home" : n} className="flex flex-col">
              {mine.map((g) => (
                <QuickRow key={g.leagueId} show={show} g={g} move={moves.get(g.leagueId) ?? null} />
              ))}
              {couchId &&
                theirs.map((g) => (
                  <LaunchRow
                    key={g.leagueId}
                    data={{ "data-join-row": g.leagueId, "data-quick-join": g.leagueId }}
                    name={quickName(g.name)}
                    href={paths.gamePage(seasonId, g.leagueId)}
                    second={
                      <>
                        <People faces={g.faces.map((f) => ({ id: f.userId, name: f.name }))} />
                        <small className="min-w-0 truncate text-[13px] text-muted-foreground">{`${askOf(g)} · before you watch`}</small>
                      </>
                    }
                    right={<JoinButton couchId={couchId} g={g} onJoin={setJoining} />}
                  />
                ))}
              {n === home && (
                <>
                  <StartQuick show={show} n={n} first={!mine.length && !theirs.length} />
                  {/* Again, for kinds not already on for this episode (the check: a chip beside a live game of its name). */}
                  <AgainLine show={show} games={last.filter((a) => ![...mine.map((g) => g.name), ...theirs.map((g) => g.name)].some((x) => quickName(x) === quickName(a.kind)))} />
                  {extrasFold}
                </>
              )}
            </div>
          </Block>
        );
      })}
      {longer.length > 0 && (
        <Block title="Your longer games" aside={`${longer.length} ${longer.length === 1 ? "game" : "games"}`}>
          <div data-games-season className="flex flex-col">
            {longShown.map((g) => row(g))}
            {longFolded.length > 0 && (
              <button type="button" data-games-fold={longFolded.length} onClick={() => setAllLong(true)} className="nd-press flex min-h-14 w-full items-center gap-2.5 border-t border-border py-2 text-left">
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold">{`${longFolded.length} more ${longFolded.length === 1 ? "game" : "games"}`}</b>
                  <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{["All set", ...longFolded.map(nameOf)].join(" · ")}</small>
                </span>
                <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden />
              </button>
            )}
          </div>
        </Block>
      )}
      {couchId && longTo.length > 0 && (
        <Block title="Longer games to join" aside={`${longTo.length} ${longTo.length === 1 ? "game" : "games"}`}>
          <div data-games-join-season className="flex flex-col">
            {joinShown.map((g) => (
              <LaunchRow
                key={g.leagueId}
                data={{ "data-join-row": g.leagueId, "data-join-game": g.gameName }}
                dot={gameInk(g.gameName)}
                name={joinName(g)}
                length={g.span ? spanName(g.span.from, g.span.to, { singular: E, plural: `${E}s` }) : "Season"}
                second={
                  <>
                    <People faces={g.faces.map((f) => ({ id: f.userId, name: f.name }))} />
                    <small className="min-w-0 truncate text-[13px] text-muted-foreground">{startWords(g, E)}</small>
                  </>
                }
                right={<JoinButton couchId={couchId} g={g} onJoin={setJoining} />}
              />
            ))}
            {joinShown.length < longTo.length && (
              <button type="button" data-games-join-fold={longTo.length - joinShown.length} onClick={() => setAllJoin(true)} className="nd-press flex min-h-14 w-full items-center gap-2.5 border-t border-border py-2 text-left">
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold">{`${longTo.length - joinShown.length} more to join`}</b>
                  <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{longTo.slice(joinShown.length).map(joinName).join(" · ")}</small>
                </span>
                <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden />
              </button>
            )}
          </div>
        </Block>
      )}
      {start}
      {/* With no episode to start a one-episode game on (a season played out), the extras fold sits on its own. */}
      {home === null && <section className="mt-[26px] px-4">{extrasFold}</section>}
      {record && record.played > 0 && (
        <section className="mt-[26px] px-4">
          <button type="button" data-archive-open data-games-record onClick={door.show} className="nd-press flex min-h-16 w-full items-center gap-3 border-y border-border py-2 text-left">
            <b className="type-num w-10 flex-none text-center text-[28px] leading-none">{record.played}</b>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-bold">{record.played === 1 ? "Finished game" : "Finished games"}</b>
              <small className={`mt-0.5 block truncate text-[13px] ${record.line.includes("most on the couch") ? "text-good" : "text-muted-foreground"}`}>{record.line}</small>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
          </button>
        </section>
      )}
      {couchId && <JoinGameSheet couchId={couchId} game={joining} onOpenChange={(o) => !o && setJoining(null)} />}
      <ArchivePage show={show} open={door.open} onClose={door.close} />
    </div>
  );
}

/** What a one-episode game asks, in a few words, before you've joined. */
export function askOf(g: JoinGame): string {
  if (g.gameType === "pickem") return "One pick";
  if (g.teamSize) return `Pick ${g.teamSize}`;
  return "Answer before you watch";
}

/** Where joining a longer game puts you, in a few words. */
export function startWords(g: JoinGame, E: string): string {
  const ask = g.mode === "ask" && !g.you?.letIn ? `${g.runners[0] ? first(g.runners[0]) : "Whoever runs it"} decides who joins` : null;
  const where = g.ownPace ? "start where you are" : !g.underway ? (g.teamSize ? "you'd draft with everyone" : "from the start") : `from ${E} ${g.latest + 1}`;
  return [ask ?? `${g.faces.length} in`, where].join(" · ");
}

/** Who's in, as small faces overlapping, the first three and "+n". */
export function People({ faces, you }: { faces: { id: string; name: string; bot?: boolean }[]; you?: { id: string; in: boolean } | null }) {
  const shown = faces.slice(0, 3);
  if (!faces.length) return null;
  return (
    <span className="flex flex-none items-center" aria-label={faces.map((f) => f.name).join(", ")}>
      {shown.map((f, i) => {
        const me = !!you && f.id === you.id;
        // You: a solid ring (dashed means an empty place elsewhere on the tab); whether you've moved is said in words.
        const ring = me ? "outline-[1.5px] outline-offset-2 outline-foreground" : "";
        // You first, ringed and apart; the rest overlap.
        const gap = i === 0 ? 0 : i === 1 && you && shown[0].id === you.id ? 8 : -6;
        return (
          <span key={f.id} className={`rounded-[4px] ring-2 ring-background ${ring}`} style={{ marginLeft: gap, zIndex: shown.length - i }}>
            <Avatar id={f.id} name={f.name} size={22} bot={f.bot} />
          </span>
        );
      })}
      {faces.length > 3 && <small className="type-num ml-1 text-[13px] text-muted-foreground">+{faces.length - 3}</small>}
    </span>
  );
}

/**
 * A row of the Games tab (the shape's two forms share it): the name in caps (and a game's length) on the first line, faces and a few
 * words on the second, its button or measure on the right. `href` makes the name a link to the game's page (a row with a button);
 * `whole` makes the entire row that link, with a chevron (a longer game's row).
 */
export function LaunchRow({ data, dot, name, length, href, whole, second, right }: { data: Record<string, string | undefined>; dot?: string; name: string; length?: string | null; href?: string | null; whole?: boolean; second: ReactNode; right?: ReactNode }) {
  const head = (
    <span className="flex min-w-0 max-w-full flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="flex min-w-0 max-w-full items-center gap-2">
        {dot && <i className="size-2 flex-none rounded-full" style={{ background: dot }} aria-hidden />}
        <b className="type-caption min-w-0 truncate text-[19px] leading-none" data-launch-name>
          {name}
        </b>
      </span>
      {length && <small className="flex-none whitespace-nowrap text-[13px] text-muted-foreground">{length}</small>}
    </span>
  );
  const body = (
    <span className="min-w-0 flex-1">
      {head}
      <span className="mt-1.5 flex min-h-[22px] min-w-0 items-center gap-2">{second}</span>
    </span>
  );
  if (whole && href)
    return (
      <NavLink href={href} {...data} className="nd-press flex min-h-16 scroll-mt-28 items-center gap-3 border-t border-border py-2 first:border-t-0">
        {body}
        {right && <span className="flex flex-none flex-col items-end gap-1">{right}</span>}
        <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
      </NavLink>
    );
  return (
    <div {...data} className="flex min-h-16 scroll-mt-28 items-center gap-3 border-t border-border py-2 first:border-t-0">
      {href ? (
        <NavLink href={href} className="nd-press -mx-1 flex min-w-0 flex-1 rounded-[3px] px-1">
          {body}
        </NavLink>
      ) : (
        body
      )}
      {right}
    </div>
  );
}

/** One of your one-episode games for an episode: who's in (you ringed, dashed until you've moved), your move's state, its button. */
function QuickRow({ show, g, move }: { show: ShowData; g: GameView; move: YourMove | null }) {
  const nav = useNav();
  const seasonId = show.header?.seasonId ?? "";
  const ep = g.from as number;
  const E = show.words.ep;
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
    state = all ? `Answered${lock ? ` · change until ${lock}` : " · change before you watch"}` : sheet.answered ? `${sheet.of - sheet.answered} to answer${lock ? ` · locks ${lock}` : ""}` : `${sheet.of} ${sheet.of === 1 ? "question" : "questions"}${lock ? ` · locks ${lock}` : ""}`;
    action = all ? "Change" : "Answer";
    go = () => openSheet({ seasonId, leagueId: g.leagueId, episode: sheet.episode, game: g.name });
  } else if (sheet?.behind) state = `After you reveal ${E} ${sheet.behind}`;
  else if (move) {
    // Behind ("Reveal Ep 4 first"): its words and no button; there's nothing to pick until then.
    const set = !move.due && move.faces.length > 0;
    state = move.due ? "Pick before you watch" : set ? "Picked · change before you watch" : move.title;
    action = move.due || set ? move.action : null;
    go = () => ("tab" in move.go ? openMoves(move.go.tab, g.leagueId) : nav.push(move.go.href));
  } else if (ep <= show.latestAired) state = mineIn ? "Answered" : "Not answered";
  else state = mineIn ? "Answered" : "Opens before the episode";
  const seats = [...g.table].sort((a, b) => Number(b.you) - Number(a.you));
  return (
    <LaunchRow
      data={{ "data-night-row": g.leagueId, "data-night-in": mineIn ? "yes" : "no" }}
      name={quickName(g.name)}
      href={paths.gamePage(seasonId, g.leagueId)}
      second={
        <>
          <People faces={seats.map((r) => ({ id: r.userId ?? r.playerId, name: r.you ? "You" : r.name, bot: r.bot }))} you={g.you ? { id: g.you.userId ?? g.you.playerId, in: mineIn } : null} />
          <small className="min-w-0 truncate text-[13px] text-muted-foreground">
            {/* Yours, not one to join: said first (the check: Pick and Join looked the same). */}
            <b className="font-semibold text-foreground">You&apos;re in</b> · {state}
          </small>
        </>
      }
      right={
        action && go ? (
          <Btn tone="optional" className="h-10 flex-none px-4" data-night-move={g.leagueId} onClick={go}>
            {action}
          </Btn>
        ) : null
      }
    />
  );
}

/** Start a one-episode game for episode `n`: a dashed row, the app's way to make something (Start a game, on its quick length). */
function StartQuick({ show, n, first: alone }: { show: ShowData; n: number; first: boolean }) {
  return (
    <button
      type="button"
      data-start-row="quick"
      onClick={() => openStartGame({ seasonId: show.header?.seasonId, couchId: show.couch?.id ?? null, length: "next" })}
      className={`nd-press flex min-h-16 w-full items-center gap-3 py-2 text-left ${alone ? "" : "border-t border-border"}`}
    >
      <span className="grid size-[34px] flex-none place-items-center rounded-[4px] outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input">
        <Plus className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        {/* A sport's episode is a game ("a one-game game" says nothing): it names the game instead. */}
        <b className="block text-[15px] font-bold">{/^game$/i.test(show.words.episode) ? `Start a game on ${show.words.ep} ${n} only` : "Start a one-episode game"}</b>
        <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{/^game$/i.test(show.words.episode) ? "Anyone on the couch can join" : `For ${show.words.ep} ${n} · anyone on the couch can join`}</small>
      </span>
    </button>
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
 *  your reveal as one line, and the next episode's games as one line each (the strip holds their moves). `part` "next" (Tonight's
 *  night, 2026-11-21: docs/design-round/tonight-night-spec.md): only the waiting line and the next episode's games, as rows of the
 *  next episode's block (its heading names the episode); the night's results are Your night's. */
export function TonightNights({ show, under = true, part = "all" }: { show: ShowData; under?: boolean; part?: "all" | "next" }) {
  const seasonId = show.header?.seasonId ?? "";
  const couchId = show.couch?.id ?? null;
  const { nights, eps } = sortGames(show);
  const archive = useSeasonArchive(seasonId, couchId, null, !!seasonId);
  const page0 = archive.data?.pages[0];
  const newest = page0?.games.length ? Math.max(...page0.games.map((g) => g.ended)) : null;
  const last = newest !== null && part === "all" ? (page0?.games ?? []).filter((g) => g.ended === newest && g.from === g.to) : [];
  const waiting = eps.filter((n) => n <= show.latestAired && !nights.some((g) => g.from === n && !!g.sheet && g.sheet.of > 0 && g.sheet.answered < g.sheet.of));
  const n = eps.find((x) => !waiting.includes(x)) ?? null;
  const here = n === null ? [] : nights.filter((g) => g.from === n);
  const held = nights.filter((g) => waiting.includes(g.from as number)).length;
  const E = show.words.ep;
  if (!last.length && !here.length && !held) return null;
  if (part === "next") {
    return (
      <div data-tonight-nights="next" className="flex flex-col border-t border-border">
        {held > 0 && (
          <p className="flex min-h-11 items-center border-t border-border text-[15px] text-muted-foreground" data-tonight-waiting>
            {`${waiting.length === 1 ? `${E} ${waiting[0]}` : `${E}s ${waiting[0]} to ${waiting.at(-1)}`} · ${held} ${held === 1 ? "game" : "games"} waiting on your reveal`}
          </p>
        )}
        {/* The Games tab's one-episode row (BACKLOG 241, the user's yes, 2026-11-21): one game looks the same on both tabs. */}
        {here.map((g) => (
          <QuickRow key={g.leagueId} show={show} g={g} move={yourMove(g, { seasonId, episode: show.words.episode, when: (iso) => airTime(Date.parse(iso)) })} />
        ))}
      </div>
    );
  }
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
