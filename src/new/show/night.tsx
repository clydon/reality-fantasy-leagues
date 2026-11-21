"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LINES } from "@/lib/game/bingo";
import { kindOf } from "@/lib/game/spans";
import { nightRowOf, type NightChange, type NightLine } from "@/lib/game/night-rows";
import { nightKind, type Square } from "@/lib/game/game-plays";
import { GAME_NAMES } from "@/lib/server/league-season";
import { useCouchGames, useEpisodeBingo, useSeasonArchive, useSeasonGame, useTrivia, type ArchivedGame, type GameView, type JoinGame, type TableRow } from "../data";
import { gameInk, ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { episodesOf, type ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { JoinGameSheet } from "../couch/join-game";
import { openBingo } from "./bingo";
import { NightBadge, type Door } from "./game-sheets";
import { EpisodeGames } from "./game-week";
import { signed } from "./lineup-sheet";
import { castName, faceIn, first } from "./moves";
import { Block, Face } from "./parts";
import { useMe } from "../session";
import { showLabel } from "./react";
import { oneGame } from "./this-week";
import { openTrivia } from "./trivia";

// Tonight's night (docs/design-round/tonight-night-spec.md, -first-view.md, -shape.md): the last episode you've watched as it went
// in each game you play, for you and for everyone in it. A card a season game, closed to your night (your place and how it moved,
// what the episode did for you, your picks as faces wearing their results, one line of news about someone else), open in place to
// everyone's night (five people at most: everyone, or the top five, or the top three, the one just ahead of you and you), its full
// list the game's episode sheet. Then the night's quick games and the couch's bingo and trivia. Everything is at your own mark (the
// games read is: GhostLogic.viewFor), so nothing past it shows. What changed plays once per episode as a card comes into view.

/** Something has counted in this game, as far as you've seen: before its first episode everyone's level, so no place (round 5). */
export const countedYet = (g: GameView) => g.from !== null && g.through >= g.from;

/** The line under your place: points, your streak now, or who's still in. */
export function yourLine(g: GameView): string {
  const me = g.you;
  if (!me) return "Not on the table yet";
  if (!countedYet(g)) return g.draftSoon ? "No team yet" : g.from === null ? "Starts with its phase" : `Starts with Episode ${g.from}`;
  if (g.gameType === "pickem") return `streak ${me.week ?? 0}`;
  if (g.gameType === "weekly-calls") return `${me.total} ${me.total === 1 ? "call" : "calls"} right`;
  // A line worth more than a point (step A9): its total is points.
  if (g.gameType === "weekly-bingo") return g.linePoints && g.linePoints !== 1 ? `${me.total} pts` : `${me.total} ${me.total === 1 ? "line" : "lines"}`;
  if (g.gameType === "questions") return `${me.total} ${me.total === 1 ? "pt" : "pts"}`;
  if (g.gameType === "active-roster") return `${me.total} pts`;
  const team = me.team.map((id) => g.cast.find((c) => c.id === id)).filter((c) => !!c);
  // No team of its own: before its draft, or a game in stages (its teams are its stages'; its total is the overall).
  if (!team.length) return g.draftSoon ? "No team yet" : `${me.total} ${me.total === 1 ? "pt" : "pts"}`;
  return `${team.filter((c) => !c.knocked).length} of ${team.length} still in`;
}

/** Your place in a game: "1st", or "T2" for a tie. */
export const placeOf = (g: GameView) => (!g.you || !countedYet(g) ? "—" : g.you.rank.startsWith("T") ? g.you.rank : ordinal(g.you.place));

/** The latest episode you've seen that has aired, on a show you follow or play: Last time and the night are about it. */
export function latestSeen(show: ShowData): number | null {
  const playing = show.games.some((g) => g.yourRole);
  if (!show.header || (!show.following && !playing)) return null;
  const n = Math.min(show.seenThrough ?? show.latestAired, show.latestAired);
  return n >= 1 ? n : null;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace("-", "−");
const placeWord = (r: Pick<TableRow, "rank" | "place">) => (r.rank.startsWith("T") ? r.rank : ordinal(r.place));
/** A one-episode game's name in plain words: its kind, without the episode it was named for ("Who survives? Ep 7" → "Who survives?"). */
export const quickName = (name: string) => kindOf(name).replace(/[\s·]*\b(ep|episode)\s*\d+$/i, "");
const sqAt = (g: GameView, playerId: string, n: number): Square | null => g.plays.rows[playerId]?.find((s) => s.episode === n) ?? null;

// ---------- reading a game's night ----------

/** How each seat moved over episode `n` (up positive), by player id: the engine's places before it (GameView.was), else, for a game
 *  ranked by points the server counts (calls, bingo, answers), their totals before it ranked the same way. */
function movesOf(g: GameView, n: number): Map<string, number> | null {
  if (g.through !== n || !g.plays.episodes.includes(n) || (g.from !== null && n <= g.from)) return null;
  const out = new Map<string, number>();
  if (g.was) {
    for (const r of g.table) if (g.was[r.playerId] !== undefined) out.set(r.playerId, g.was[r.playerId] - r.place);
    return out.size ? out : null;
  }
  if (!["points", "won", "race"].includes(g.plays.kind) || g.plays.episodes.indexOf(n) < 1) return null;
  const before = g.table.map((r) => {
    const s = sqAt(g, r.playerId, n);
    return { id: r.playerId, total: (s?.total ?? r.total) - (s?.points ?? 0) };
  });
  for (const r of g.table) {
    const mine = before.find((b) => b.id === r.playerId)!.total;
    out.set(r.playerId, before.filter((b) => b.total > mine).length + 1 - r.place);
  }
  return out;
}

/** A face on a card and what happened to them that night: a lineup's points, a pool's pick and how it went, a team's who left. */
type PickOf = { id: string; points?: number; night?: ReturnType<typeof nightKind>; lost?: boolean };

/** Someone's picks that night, in the game's own form. */
function picksOf(g: GameView, r: TableRow, n: number, s: Square | null): PickOf[] {
  const b = g.plays.blocks;
  if (b.includes("lineup") || b.includes("counted")) {
    const w = r.weeks.find((x) => x.episode === n);
    return w ? w.started.map((x) => ({ id: x.id, points: x.points })) : [];
  }
  if ((b.includes("pick") || b.includes("picks")) && s?.pick) {
    const night = nightKind(s.pick);
    const out: PickOf[] = s.pick.id ? [{ id: s.pick.id, night: s.pick.correct === false ? "home" : night === "home" ? "stayed" : night }] : [];
    if (s.pick.second && !s.pick.second.void) out.push({ id: s.pick.second.id, night: s.pick.second.correct === false ? "home" : s.pick.second.correct ? "stayed" : null });
    return out;
  }
  if (b.includes("boots") || b.includes("team")) {
    const held = s?.held ?? r.team;
    const left = new Set(s?.left ?? []);
    // Who left tonight first (the news), then who's still in; anyone gone before tonight is left off.
    return [...held.filter((id) => left.has(id)).map((id) => ({ id, lost: true })), ...held.filter((id) => !left.has(id) && !faceIn(g, id)?.knocked).map((id) => ({ id }))];
  }
  return [];
}

type Tone = "good" | "out" | "plain";
/** A tone's ink: teal for good news, live red for someone leaving (DESIGN.md's Red Is For Leaving), the foreground otherwise. */
const ink = (t: Tone) => (t === "good" ? "text-good" : t === "out" ? "text-live" : "");

/** What the night did for someone, in the game's own measure (points carry their unit), and its tone. `top`: the couch's most
 *  points that episode, which reads teal. */
function changeOf(g: GameView, s: Square | null, top: number | null = null): { text: string; unit?: string; tone: Tone } | null {
  if (!s) return null;
  const k = g.plays.kind;
  if (k === "pick" && s.pick) {
    const night = nightKind(s.pick);
    if (night === null) return { text: "Waiting", tone: "plain" };
    const words: Record<string, string> = { stayed: "Stayed", home: "Went home", missed: "Missed", forgiven: "Forgiven", bought: "Bought back", skipped: "Skipped" };
    return { text: words[night], tone: night === "stayed" || night === "forgiven" ? "good" : night === "home" ? "out" : "plain" };
  }
  if (k === "result" && s.result) return { text: `${s.result.r} ${fmt(s.result.us)}–${s.result.them === null ? "" : fmt(s.result.them)}`, tone: s.result.r === "W" ? "good" : "plain" };
  if (k === "won" && s.won) return { text: "Won it", tone: "good" };
  if (s.held) return s.left?.length ? { text: `Lost ${s.left.length}`, tone: "out" } : { text: "All safe", tone: "good" };
  if (s.points === null) return null;
  return { text: signed(s.points), unit: Math.abs(s.points) === 1 ? "pt" : "pts", tone: top !== null && top > 0 && s.points === top ? "good" : "plain" };
}

/** The night's change as a game's design says it (night-rows.ts NightChange); `changeOf` is the plain reading. */
function changeFor(kind: NightChange, g: GameView, s: Square | null, n: number): ReturnType<typeof changeOf> {
  const plain = changeOf(g, s, topOf(g, n, waitingOn(g, n)));
  if (kind === "lives" && g.plays.lives) {
    const before = g.plays.lives.after[n - 1] ?? g.plays.lives.of;
    const after = g.plays.lives.after[n] ?? before;
    const lost = before - after;
    return lost > 0 ? { text: lost === 1 ? "Lost a life" : `Lost ${lost} lives`, tone: "out" } : { text: "No lives lost", tone: "good" };
  }
  if (kind === "week" && s?.won) return { text: "Won the week", tone: "good" };
  if (kind === "lines" && plain?.unit && s?.points != null && (g.linePoints ?? 1) === 1) return { ...plain, unit: Math.abs(s.points) === 1 ? "line" : "lines" };
  return plain;
}

/** The second line's words as a game's design says them (night-rows.ts NightLine), when nobody else's night is the news. */
function lineFor(kind: NightLine, g: GameView, s: Square | null, n: number, total: string, stage: string | null = null): string {
  const me = g.you;
  if (!me) return total;
  if (kind === "opponent" && s?.result) {
    const who = s.result.against ? first(g.table.find((r) => r.playerId === s.result!.against)?.name ?? "them") : s.result.median ? "the middle score" : "a bye";
    return `vs ${who} · ${total}`;
  }
  if (kind === "target" && g.plays.target !== null) return `${fmt(me.total)} of ${fmt(g.plays.target)} to win`;
  if (kind === "lives" && g.plays.lives) return `${g.plays.lives.after[n] ?? g.plays.lives.of} of ${g.plays.lives.of} lives left`;
  if (kind === "weeks" && g.weeksWon) {
    const w = g.weeksWon[me.playerId] ?? 0;
    return `${fmt(w)} ${w === 1 ? "week" : "weeks"} won · ${total}`;
  }
  if (kind === "stage" && stage) return `${stage} · ${total}`;
  return total;
}

/** The couch's most points in episode `n` among those it isn't waiting on (the episode sheet's "best"), or null. */
function topOf(g: GameView, n: number, waiting: Set<string>): number | null {
  const pts = g.table.filter((r) => !waiting.has(r.playerId)).map((r) => sqAt(g, r.playerId, n)?.points ?? null).filter((p): p is number => p !== null);
  return pts.length ? Math.max(...pts) : null;
}
const waitingOn = (g: GameView, n: number) => new Set((g.waiting ?? []).filter((w) => w.episode === n).map((w) => w.playerId));

/** The night's one piece of news about someone else (a pool's pick that went home, a team's loss, the couch's best night), with who. */
function couchNews(g: GameView, n: number): { who: TableRow[]; words: string } | null {
  if (g.solo === "public") return null;
  const waiting = waitingOn(g, n);
  const others = g.table.filter((r) => !r.you && !waiting.has(r.playerId));
  const at = (r: TableRow) => sqAt(g, r.playerId, n);
  const name = (r: TableRow) => first(r.name);
  const pair = (rs: TableRow[]) => (rs.length === 1 ? name(rs[0]) : `${name(rs[0])} and ${name(rs[1])}`);
  const home = others.filter((r) => {
    const s = at(r);
    return !!s?.pick && (s.pick.correct === false || nightKind(s.pick) === "home");
  });
  if (home.length) return { who: home, words: home.length > 2 ? `${home.length} picks went home` : `${pair(home)}'s ${home.length === 1 ? "pick" : "picks"} went home` };
  const lost = others.filter((r) => (at(r)?.left ?? []).length > 0);
  if (lost.length === 1) {
    const gone = (at(lost[0])?.left ?? []).map((id) => first(castName(faceIn(g, id), g)));
    return { who: lost, words: `${name(lost[0])} lost ${gone.length === 1 ? gone[0] : `${gone.length}`}` };
  }
  if (lost.length > 1) return { who: lost, words: `${lost.length} of the couch lost someone` };
  const top = topOf(g, n, waiting);
  const best = top !== null && top > 0 ? g.table.filter((r) => !waiting.has(r.playerId) && at(r)?.points === top) : [];
  if (best.length && g.plays.kind !== "pick" && g.plays.kind !== "result") {
    const pts = top;
    const rest = best.filter((r) => !r.you);
    // Short enough for a row beside three faces: "Ada had the night", "Ada +2 had the night", "You and riley had the night".
    const many = (rs: TableRow[]) => (rs.length <= 2 ? pair(rs) : `${name(rs[0])} +${rs.length - 1}`);
    const who = rest.length === best.length ? `${many(best)} had the night` : !rest.length ? (pts != null ? `Your ${signed(pts)} was the couch's best` : "Your night was the couch's best") : rest.length === 1 ? `You and ${name(rest[0])} had the night` : `You +${rest.length} had the night`;
    return { who: rest.length ? rest : best, words: who };
  }
  return null;
}

interface Night {
  g: GameView;
  n: number;
  /** The game counted episode `n` (else the card is your standing alone). */
  played: boolean;
  moves: Map<string, number> | null;
  news: boolean;
}

function nightOf(g: GameView, n: number): Night {
  const played = g.through === n && g.plays.episodes.includes(n) && countedYet(g);
  const moves = played ? movesOf(g, n) : null;
  const me = g.you;
  const s = me && played ? sqAt(g, me.playerId, n) : null;
  const moved = me ? (moves?.get(me.playerId) ?? 0) : 0;
  // News for you: a place moved, a pick that went home, someone of yours left, a week won, a matchup decided.
  const news = played && (moved !== 0 || (!!s?.pick && nightKind(s.pick) !== "stayed") || (s?.left ?? []).length > 0 || !!s?.won || !!s?.result);
  return { g, n, played, moves, news };
}

// ---------- the motion: what changed, once per episode ----------

/** Whether a card's change still has to play for episode `n` (never under reduced motion), and the ref that plays it once it's at
 *  least half in view; remembered on this device (`gys-night:<game>` = the episode played). */
function useOnce(key: string, n: number, wants: boolean): [(el: HTMLDivElement | null) => void, "still" | "waiting" | "play"] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState<"still" | "waiting" | "play">(() => {
    if (!wants || typeof window === "undefined") return "still";
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "still";
      return (Number(window.localStorage.getItem(`gys-night:${key}`)) || 0) >= n ? "still" : "waiting";
    } catch {
      return "still";
    }
  });
  useEffect(() => {
    if (state !== "waiting" || !el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.intersectionRatio >= 0.5)) return;
        io.disconnect();
        setState("play");
        try {
          window.localStorage.setItem(`gys-night:${key}`, String(n));
        } catch {
          // A private window: it plays again next time, nothing more.
        }
      },
      { threshold: [0.5] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [state, el, key, n]);
  return [setEl, state];
}

/** A place as a broadcast number flip: the old one slides up and out as the new one rises in (only while `play`); `from` while it
 *  waits to come into view. */
function PlaceFlip({ from, to, state }: { from: string | null; to: string; state: "still" | "waiting" | "play" }) {
  if (state === "still" || !from || from === to) return <>{to}</>;
  if (state === "waiting") return <>{from}</>;
  return (
    <span className="relative inline-grid overflow-hidden align-bottom" aria-label={to}>
      <span aria-hidden className="nn-flip-out col-start-1 row-start-1">
        {from}
      </span>
      <span aria-hidden className="nn-flip-in col-start-1 row-start-1">
        {to}
      </span>
    </span>
  );
}

/** How a place moved: a teal caret up, a bone one down, a muted dash held; nothing when it can't be said. */
function Moved({ by, small, motion }: { by: number | null | undefined; small?: boolean; motion?: boolean }) {
  if (by === null || by === undefined) return null;
  if (by === 0) return null;
  const up = by > 0;
  return (
    <span data-moved={by} aria-label={`${up ? "up" : "down"} ${Math.abs(by)}`} className={`type-num inline-flex flex-none items-center gap-0.5 ${up ? "text-good" : "text-foreground"} ${small ? "text-[12px]" : "text-[17px]"} ${motion ? "nn-caret-in" : ""}`}>
      <svg viewBox="0 0 10 8" aria-hidden className={`${small ? "size-2" : "size-2.5"} ${up ? "" : "rotate-180"}`}>
        <path d="M5 0 10 8H0z" fill="currentColor" />
      </svg>
      {Math.abs(by)}
    </span>
  );
}

// ---------- faces ----------

/** A pick's face wearing its result: points under a starter; a check or a cross on a pool's pick; a lost castaway greyed and crossed. */
function PickFace({ g, p, size, onOpen, motion, named }: { g: GameView; p: PickOf; size: number; onOpen?: (id: string) => void; motion?: boolean; named?: boolean }) {
  const c = faceIn(g, p.id);
  const gone = p.lost || p.night === "home";
  const badge = p.lost ? "home" : p.night && p.night !== "skipped" ? p.night : null;
  const face = (
    <span className="relative block flex-none" style={{ width: size, height: size }}>
      <Face src={c?.photo ?? null} name={c?.name} className="block size-full rounded-[3px] text-xs" />
      {gone && <i aria-hidden className={`absolute inset-0 rounded-[3px] bg-background/55 ${motion ? "nn-lost" : ""}`} />}
      {badge && (
        <span className={`absolute ${size >= 32 ? "-right-1 -top-1" : "-right-1.5 -top-1.5"} ${motion && gone ? "nn-cross-in" : ""}`}>
          <NightBadge kind={badge} className={size >= 32 ? "size-4" : "size-3.5"} />
        </span>
      )}
    </span>
  );
  const label = `${castName(c, g)}${p.points !== undefined ? `, ${signed(p.points)}` : gone ? ", went home" : p.night === "stayed" ? ", stayed" : ""}`;
  const body = (
    <>
      {face}
      {p.points !== undefined && <small className={`type-num mt-1 block text-center leading-none ${size >= 32 ? "text-[13px]" : "text-[11px]"} ${p.points > 0 ? "" : "text-muted-foreground"}`}>{signed(p.points)}</small>}
      {named && p.points === undefined && <small className="mt-1 block max-w-16 truncate text-center text-[12px] leading-none text-muted-foreground">{first(castName(c, g))}</small>}
    </>
  );
  return onOpen ? (
    <button type="button" data-night-face={p.id} aria-label={label} onClick={() => onOpen(p.id)} className="nd-press flex flex-none flex-col items-center">
      {body}
    </button>
  ) : (
    <span role="img" aria-label={label} className="flex flex-none flex-col items-center">
      {body}
    </span>
  );
}

/** A row of picks, capped: the first `max` and "+n". */
function Picks({ g, picks, size, max, onOpen, motion, named, points = true }: { g: GameView; picks: PickOf[]; size: number; max: number; onOpen?: (id: string) => void; motion?: boolean; named?: boolean; points?: boolean }) {
  if (!picks.length) return null;
  const shown = picks.slice(0, max).map((p) => (points ? p : { ...p, points: undefined }));
  return (
    <span className="flex items-start gap-1.5">
      {shown.map((p) => (
        <PickFace key={p.id} g={g} p={p} size={size} onOpen={onOpen} motion={motion} named={named} />
      ))}
      {picks.length > max && (
        <span className="type-num grid flex-none place-items-center text-[13px] text-muted-foreground" style={{ height: size }}>
          +{picks.length - max}
        </span>
      )}
    </span>
  );
}

// ---------- the five rows ----------

/** Everyone, or the top five, or the top three, the one just ahead of you and you, in the table's order ("gap" where places jump). */
export function fiveOf(table: TableRow[]): (TableRow | "gap")[] {
  if (table.length <= 5) return table;
  const i = table.findIndex((r) => r.you);
  if (i < 5) return table.slice(0, 5);
  return [...table.slice(0, 3), ...(i - 1 > 3 ? (["gap"] as const) : []), table[i - 1], table[i]];
}

/** Everyone's night: a row each (place, how they moved, face, name, their picks, the night's change), you on the raised fill. */
function Everyone({ g, n, open, mineAbove = false }: { g: GameView; n: number; open: (d: Door) => void; mineAbove?: boolean }) {
  const moves = movesOf(g, n);
  const top = topOf(g, n, waitingOn(g, n));
  const rows = fiveOf(g.table);
  const waiting = new Set((g.waiting ?? []).filter((w) => w.episode === n).map((w) => w.playerId));
  const strangers = g.solo === "public";
  return (
    <div data-night-everyone={g.leagueId} className="flex flex-col">
      {rows.map((r, i) =>
        r === "gap" ? (
          <span key={`gap-${i}`} aria-hidden className="flex h-6 items-center justify-center border-t border-border text-[13px] leading-none tracking-[0.3em] text-muted-foreground">
            ···
          </span>
        ) : (
          <EveryoneRow key={r.playerId} g={g} r={r} n={n} top={top} moved={moves?.get(r.playerId)} behind={waiting.has(r.playerId)} quiet={strangers && !r.you} bare={mineAbove && r.you} open={open} />
        )
      )}
      {g.table.length > 5 && (
        <button type="button" data-night-all={g.leagueId} onClick={() => open({ kind: "episode", episode: n, game: g.leagueId })} className="nd-press flex min-h-11 items-center gap-1 border-t border-border text-[14px] font-semibold">
          See all {g.table.length}
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </button>
      )}
    </div>
  );
}

function EveryoneRow({ g, r, n, top, moved, behind, quiet, bare, open }: { g: GameView; r: TableRow; n: number; top: number | null; moved: number | undefined; behind: boolean; quiet: boolean; bare: boolean; open: (d: Door) => void }) {
  const s = sqAt(g, r.playerId, n);
  const picks = quiet || behind || bare ? [] : picksOf(g, r, n, s);
  const change = behind ? null : changeOf(g, s, top);
  return (
    <button
      type="button"
      data-night-row={r.playerId}
      data-night-you={r.you || undefined}
      disabled={quiet}
      onClick={() => open({ kind: "person", playerId: r.playerId, episode: n, game: g.leagueId })}
      className={`flex min-h-12 items-center gap-2 border-t py-1.5 text-left ${r.you ? "-mx-2.5 w-[calc(100%+20px)] rounded-[3px] border-transparent bg-secondary px-2.5" : "w-full border-border"}`}
    >
      <span className="type-num w-7 flex-none text-right text-[16px] text-muted-foreground">{r.rank}</span>
      <span className="w-6 flex-none">
        <Moved by={moved} small />
      </span>
      <Avatar id={r.userId ?? r.playerId} name={r.name} size={26} bot={r.bot} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-semibold leading-tight">{r.you ? "You" : r.name}</b>
        {behind && <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">Hasn&apos;t watched Ep {n} yet</small>}
      </span>
      {picks.length > 0 && <Picks g={g} picks={picks} size={24} max={3} />}
      {change && <b className={`type-num min-w-12 flex-none whitespace-nowrap text-right text-[17px] ${ink(change.tone)}`}>{change.text}</b>}
    </button>
  );
}

// ---------- a game's row ----------

/**
 * A game's night as one row, led by the game (the user, 2026-11-21: "too much emphasis on the place you're within the game; more on
 * the game name and length"): its name in caps and its length on the first line, your picks and the news on the second; on the
 * right the night's change, your place small under it. A one-episode game leads with who won it instead (QuickCard). The whole row
 * opens everyone's night in place, which ends with the game's page.
 */
type RowProps = {
  attach?: (el: HTMLDivElement | null) => void;
  data: Record<string, string | undefined>;
  open: boolean;
  opens: boolean;
  onToggle: () => void;
  name: string;
  dot: string;
  length?: string | null;
  second: ReactNode;
  right: ReactNode;
  children?: ReactNode;
};

function Row({ attach, data, open, opens, onToggle, name, dot, length, second, right, children }: RowProps) {
  return (
    <div ref={attach} {...data} data-night-open={open ? "open" : "closed"} className="border-t border-border first:border-t-0">
      <button type="button" data-night-toggle onClick={onToggle} disabled={!opens} aria-expanded={opens ? open : undefined} className="nd-press flex min-h-16 w-full items-center gap-3 py-2 text-left disabled:cursor-default">
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="flex min-w-0 max-w-full items-center gap-2">
              <i className="size-2 flex-none rounded-full" style={{ background: dot }} aria-hidden />
              <b className="type-caption min-w-0 truncate text-[19px] leading-none" data-night-name>
                {name}
              </b>
            </span>
            {length && (
              <small className="flex-none whitespace-nowrap text-[13px] text-muted-foreground" data-night-length>
                {length}
              </small>
            )}
          </span>
          <span className="mt-1.5 flex min-h-[22px] min-w-0 items-center gap-2">{second}</span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1">{right}</span>
        {opens && <ChevronDown className={`size-4 flex-none text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden />}
      </button>
      {open && (
        <div data-night-well className="mb-2.5 rounded-[4px] bg-card px-2.5 pb-1 pt-1">
          {children}
        </div>
      )}
    </div>
  );
}

/** The open well's last row: the game's own page. */
function GamePageLink({ seasonId, leagueId, name }: { seasonId: string; leagueId: string; name: string }) {
  return (
    <NavLink href={paths.gamePage(seasonId, leagueId)} data-game={leagueId} className="nd-press flex min-h-11 items-center gap-1 border-t border-border text-[14px] font-semibold">
      <span className="min-w-0 truncate">{name}&apos;s page</span>
      <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

/** How long a game runs, in the show's words, and what's left of it at episode `n`: "Season · 7 left", "Eps 4–9 · 3 left",
 *  "From Ep 4", "Ends Ep 9" on its last. */
function lengthOf(g: GameView, show: ShowData, n: number): string {
  const ep = show.words.ep;
  const last = g.to ?? episodesOf(show);
  const left = last - n;
  const span = g.to === null ? (g.from !== null && g.from > 1 ? `From ${ep} ${g.from}` : "Season") : `${ep}s ${g.from ?? 1}–${g.to}`;
  return left > 0 ? `${span} · ${left} left` : g.to === null ? span : `Ended ${ep} ${g.to}`;
}

/** One longer game's night as a row; open, everyone's night (yours among them), See all and the game's page. */
function NightCard({ night, name, show, open: openDoor }: { night: Night; name: string; show: ShowData; open: (d: Door) => void }) {
  const { g, n, played } = night;
  const [open, setOpen] = useState(false);
  const seasonId = show.header?.seasonId ?? "";
  const me = g.you;
  const s = me && played ? sqAt(g, me.playerId, n) : null;
  const moved = me && night.moves ? night.moves.get(me.playerId) : undefined;
  // How this kind of game says its night (night-rows.ts: a design for every main block the grammar can give a spec).
  const d = nightRowOf(g.page?.main);
  const picks = d.faces === "plays" && me && played ? picksOf(g, me, n, s) : [];
  const change = played ? changeFor(d.change, g, s, n) : null;
  const news = played ? couchNews(g, n) : null;
  const opens = played && g.table.length > 1;
  const [attach, motion] = useOnce(g.leagueId, n, played && (!!moved || picks.some((p) => p.lost || p.night === "home")));
  const playing = motion === "play";
  const from = me && moved ? ordinal(me.place + moved) : null;
  // A team game ranks by points (who's still in is its faces); head to head by its record; the rest in their own words.
  const team = g.plays.blocks.includes("boots") || g.plays.blocks.includes("team");
  const measure = g.plays.kind === "result" && me?.record ? `${me.record.wins}–${me.record.losses}${me.record.ties ? `–${me.record.ties}` : ""}` : team && me && countedYet(g) ? `${fmt(me.total)} pts` : yourLine(g);
  // A game in stages: the stage that played the episode (each stage is a game of its own in the read, its parent's `stageOf`).
  const stage = d.line === "stage" ? ((show.play ?? []).find((x) => x.stageOf === g.leagueId && x.from !== null && x.from <= n && (x.to === null || x.to >= n))?.name ?? null) : null;
  const line = news ? news.words : played ? lineFor(d.line, g, s, n, measure, stage) : yourLine(g);
  return (
    <Row
      attach={attach}
      data={{ "data-night-card": g.leagueId, "data-night-news": night.news ? "yes" : "no" }}
      open={open}
      opens={opens}
      onToggle={() => opens && setOpen((o) => !o)}
      name={name}
      dot={gameInk(g.gameName)}
      length={lengthOf(g, show, n)}
      second={
        <>
          {picks.length > 0 && <Picks g={g} picks={picks} size={22} max={4} motion={playing} points={false} />}
          <small data-night-news-line className={`min-w-0 truncate text-[13px] ${news ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {line}
          </small>
        </>
      }
      right={
        <>
          {change && (
            <b data-night-change className={`type-num whitespace-nowrap text-[19px] leading-none ${ink(change.tone)}`}>
              {change.text}
              {change.unit && <small className="ml-0.5 font-sans text-[12px] font-semibold text-muted-foreground">{change.unit}</small>}
            </b>
          )}
          {/* Your place, small, and how it moved (a co-op game has none: the couch wins or loses together). */}
          {d.place && (
            <span className="flex items-center gap-1 whitespace-nowrap text-[12px] leading-none text-muted-foreground">
              <b className="type-num text-[14px] font-normal text-foreground" data-night-place>
                <PlaceFlip from={from} to={placeOf(g)} state={motion} />
              </b>
              {(motion !== "waiting" || !moved) && <Moved by={moved} small motion={playing} />}
            </span>
          )}
        </>
      }
    >
      {d.open === "matchups" && g.plays.kind === "result" ? (
        <EpisodeGames g={g} episode={n} onOpen={(pid) => openDoor({ kind: "matchup", playerId: pid, episode: n, game: g.leagueId })} />
      ) : (
        <Everyone g={g} n={n} open={openDoor} />
      )}
      <GamePageLink seasonId={seasonId} leagueId={g.leagueId} name={name} />
    </Row>
  );
}

// ---------- the night's one-episode games ----------

/** Who won, as a face or two and words, teal when it's you: a one-episode game's (and an extra's) headline. */
function Winner({ faces, words, you }: { faces: { id: string; name: string; bot?: boolean }[]; words: string; you: boolean }) {
  const shown = faces.slice(0, 3);
  return (
    <span className="flex items-center gap-2" data-night-winner>
      {shown.length > 0 && (
        <span className="flex flex-none items-center" aria-hidden>
          {shown.map((f, i) => (
            <span key={f.id} className="rounded-[4px] ring-2 ring-background" style={{ marginLeft: i ? -6 : 0, zIndex: shown.length - i }}>
              <Avatar id={f.id} name={f.name} size={22} bot={f.bot} />
            </span>
          ))}
        </span>
      )}
      <b className={`whitespace-nowrap text-[15px] font-semibold leading-none ${you ? "text-good" : ""}`}>{words}</b>
    </span>
  );
}

/** A one-episode game that played episode `n` (the archive's: a finished game isn't in the running read), as a row led by who won
 *  it; your place and points small under the name; open, its everyone's night from its own read. */
function QuickCard({ a, show, n, open: openDoor }: { a: ArchivedGame; show: ShowData; n: number; open: (d: Door) => void }) {
  const [open, setOpen] = useState(false);
  const seasonId = show.header?.seasonId ?? "";
  const couchId = show.couch?.id ?? null;
  const q = useSeasonGame(seasonId, couchId, a.leagueId, open);
  const g = q.data?.games[0];
  const opens = a.players > 1;
  const youWon = a.winners.some((w) => w.you) && !a.level && !a.nobody;
  // Who won, in words: you, you and whom, whoever won; level, or nobody.
  const names = [...a.winners].sort((x, y) => Number(y.you) - Number(x.you)).map((w) => (w.you ? "You" : first(w.name)));
  // (The faces say who else: "You won" beside three faces is a shared win, and the second line says T1.)
  const words = a.nobody ? "Nobody scored" : a.level ? `All ${a.players} level` : a.winners.some((w) => w.you) ? "You won" : names.length === 1 ? `${names[0]} won` : names.length === 2 ? `${names[0]} and ${names[1]} won` : `${names.length} tied for 1st`;
  const name = quickName(a.kind);
  return (
    <Row
      data={{ "data-night-quick": a.leagueId }}
      open={open}
      opens={opens}
      onToggle={() => opens && setOpen(!open)}
      name={name}
      dot={gameInk(a.gameName)}
      second={
        <small className="min-w-0 truncate text-[13px] text-muted-foreground">
          {a.you && !a.nobody ? `You ${placeWord(a.you)} of ${a.players} · ${fmt(a.you.total)} ${a.you.total === 1 ? "pt" : "pts"}` : a.you ? `${a.players} played` : "You didn't play"}
        </small>
      }
      right={<Winner faces={a.nobody || a.level ? [] : a.winners.map((w) => ({ id: w.id, name: w.name, bot: w.bot }))} words={words} you={youWon} />}
    >
      {g ? <Everyone g={g} n={n} open={openDoor} /> : <div aria-busy className="h-24 animate-pulse" />}
      <GamePageLink seasonId={seasonId} leagueId={a.leagueId} name={name} />
    </Row>
  );
}

// ---------- the couch's bingo and trivia ----------

/** A bingo card as a glyph: three by three, ticked squares filled (the centre's free), a line that counts drawn through in teal. */
function BingoGlyph({ grid, size = 18 }: { grid: { ticked: number[]; counts: number[] }; size?: number }) {
  const at = (i: number) => ({ x: (i % 3) * 11 + 4, y: Math.floor(i / 3) * 11 + 4 });
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} aria-hidden className="flex-none">
      {Array.from({ length: 9 }, (_, i) => {
        const on = i === 4 || grid.ticked.includes(i);
        return <rect key={i} x={(i % 3) * 11} y={Math.floor(i / 3) * 11} width={8} height={8} rx={1} className={on ? "fill-foreground" : "fill-none stroke-muted-foreground"} strokeWidth={1.5} />;
      })}
      {grid.counts.map((l) => {
        const [a, , c] = LINES[l];
        return <line key={l} x1={at(a).x} y1={at(a).y} x2={at(c).x} y2={at(c).y} className="stroke-good" strokeWidth={3.5} strokeLinecap="round" />;
      })}
    </svg>
  );
}

/** One extra as a row in the one-episode group: its name and who won it, then each player's face beside their mark; opens it. */
function ExtraLine({ title, winner, children, onOpen, data }: { title: string; winner: ReactNode; children: ReactNode; onOpen: () => void; data: string }) {
  return (
    <button type="button" data-night-extra={data} onClick={onOpen} className="nd-press flex min-h-16 w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
      <span className="min-w-0 flex-1">
        <b className="type-caption block truncate text-[19px] leading-none">{title}</b>
        <span className="mt-1.5 flex min-h-[22px] items-center gap-3 overflow-hidden">{children}</span>
      </span>
      <span className="flex flex-none items-center">{winner}</span>
      <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** A player's face beside their mark, in an extra's row. */
const Pair = ({ id, name, children }: { id: string; name: string; children: ReactNode }) => (
  <span className="flex flex-none items-center gap-1" title={name}>
    <Avatar id={id} name={name} size={18} />
    {children}
  </span>
);

/** The couch's bingo for episode `n` and this week's trivia, when anyone played them, as rows; null otherwise. */
function useExtras(show: ShowData, n: number): ReactNode[] {
  const me = useMe();
  const seasonId = show.header?.seasonId ?? null;
  const couchId = show.couch?.id ?? null;
  const on = !!seasonId && n > 0;
  const bingo = useEpisodeBingo(seasonId, couchId, n, on);
  const trivia = useTrivia(seasonId, show.solo ? null : couchId, on);
  const b = bingo.data;
  const t = trivia.data;
  const cards = (b?.people ?? []).filter((p) => p.ticked > 0 && p.grid);
  const scores = t ? [...(t.played ? [{ userId: me.id, name: "You", score: t.played.score, of: t.played.of }] : []), ...t.couch] : [];
  const rows: ReactNode[] = [];
  if (!on || !seasonId) return rows;
  if (cards.length) {
    const firstOne = b?.first ? cards.find((p) => p.userId === b.first?.userId) : undefined;
    const you = b?.first?.userId === me.id;
    rows.push(
      <ExtraLine
        key="bingo"
        data="bingo"
        title="Bingo"
        winner={b?.first ? <Winner faces={[{ id: b.first.userId, name: firstOne?.name ?? b.first.name }]} words={you ? "Your line first" : `${first(firstOne?.name ?? b.first.name)}'s line first`} you={you} /> : <small className="text-[13px] text-muted-foreground">No line yet</small>}
        onOpen={() => openBingo({ seasonId, couchId, episode: n, label: showLabel(show), solo: show.solo })}
      >
        {cards.slice(0, 5).map((p) => (
          <Pair key={p.userId} id={p.userId} name={p.name}>
            <BingoGlyph grid={p.grid!} />
          </Pair>
        ))}
      </ExtraLine>
    );
  }
  if (scores.length) {
    const best = Math.max(...scores.map((x) => x.score));
    const top = scores.filter((x) => x.score === best);
    const you = top.some((x) => x.userId === me.id);
    rows.push(
      <ExtraLine
        key="trivia"
        data="trivia"
        title="Trivia · this week"
        winner={
          !t?.played ? (
            <small className="text-[13px] font-semibold">Play it</small>
          ) : (
            <Winner faces={top.slice(0, 3).map((x) => ({ id: x.userId, name: x.name }))} words={top.length === 1 ? `${you ? "You" : first(top[0].name)} ${best}/${top[0].of}` : `${top.length} on ${best}`} you={you && top.length === 1} />
          )
        }
        onOpen={() => openTrivia({ seasonId, couchId: show.solo ? null : couchId })}
      >
        {scores.slice(0, 5).map((x) => (
          <Pair key={x.userId} id={x.userId} name={x.name}>
            <b className={`type-num text-[15px] leading-none ${x.score === best && best > 0 ? "text-good" : ""}`}>
              {x.score}/{x.of}
            </b>
          </Pair>
        ))}
      </ExtraLine>
    );
  }
  return rows;
}

/** The couch's bingo and trivia as their own block, for someone who plays nothing here (never a game's results). */
export function NightExtras({ show, n, title }: { show: ShowData; n: number; title: string }) {
  const rows = useExtras(show, n);
  if (!rows.length) return null;
  return (
    <Block title={title}>
      <div data-night-extras className="flex flex-col">
        {rows}
      </div>
    </Block>
  );
}

// ---------- the section ----------

/** A group's label inside the section: "One-episode games", "Longer games". */
const GroupLabel = ({ children }: { children: ReactNode }) => <p className="type-caption pb-1.5 text-[13px] tracking-[0.06em] text-muted-foreground">{children}</p>;

/** Block 4: the night in two groups, the shortest first (the user, 2026-11-21): the one-episode games that played it, each led by who
 *  won (then the couch's bingo and trivia), and the longer games, soonest to end first, each led by its name and length. Someone who
 *  only watches gets the couch's bingo and trivia alone, never a game's results. */
export function YourNight({ show, open }: { show: ShowData; open: (d: Door) => void }) {
  const n = latestSeen(show);
  const playing = show.games.some((g) => g.yourRole);
  const [all, setAll] = useState(false);
  const seasonId = show.header?.seasonId ?? "";
  const couchId = show.couch?.id ?? null;
  const archive = useSeasonArchive(seasonId, couchId, null, !!seasonId && playing);
  const [quickAll, setQuickAll] = useState(false);
  const extras = useExtras(show, n ?? 0);
  if (!n || !show.header) return null;
  if (!playing) return show.readOnly || !extras.length ? null : <NightExtras show={show} n={n} title={`The couch's night · ${show.words.ep} ${n}`} />;
  if (!show.play) return <div aria-busy className="mx-4 mt-[26px] h-[150px] animate-pulse rounded-[4px] bg-card" />;
  // Round 3: one-episode games aren't in the running read once over; the archive has them.
  const games = show.play.filter((g) => !g.stageOf && !oneGame(g) && !(g.over && g.to !== null));
  const twin = (g: GameView) => games.filter((x) => x.gameType === g.gameType).length > 1;
  const nameOf = (g: GameView) => (g.solo === "public" ? "Everyone" : twin(g) && g.name !== g.gameName ? g.name : (GAME_NAMES[g.gameName] ?? g.gameName));
  const early = show.episodes?.episodes.find((e) => e.number === n)?.stage === "early";
  // The longer games, soonest to end first (a game to the season's end, last); four rows, then the rest folded into one.
  const endOf = (g: GameView) => g.to ?? episodesOf(show) + 1;
  const ordered = games.map((g) => nightOf(g, n)).sort((x, y) => endOf(x.g) - endOf(y.g));
  const shown = all || ordered.length <= 4 ? ordered : ordered.slice(0, 3);
  const folded = all || ordered.length <= 4 ? [] : ordered.slice(3);
  const quick = (archive.data?.pages[0]?.games ?? []).filter((a) => a.ended === n && a.from === a.to && !!a.you);
  const quickShown = quickAll || quick.length <= 3 ? quick : quick.slice(0, 2);
  const firsts = quick.filter((a) => a.you && a.you.place === 1 && !a.level && !a.nobody).length;
  const short = quick.length + extras.length > 0;
  return (
    // Early results (the final ones land at noon the next day): every number here is so far, said once.
    <Block title={`Your night · ${show.words.ep} ${n}`} aside={early ? "So far" : undefined}>
      <div data-your-night={n} className="flex flex-col">
        {short && (
          <div data-night-group="one-episode">
            {ordered.length > 0 && <GroupLabel>One-episode games</GroupLabel>}
            {quickShown.map((a) => (
              <QuickCard key={a.leagueId} a={a} show={show} n={n} open={open} />
            ))}
            {quick.length > quickShown.length && (
              <button type="button" data-night-quick-fold={quick.length} onClick={() => setQuickAll(true)} className="nd-press flex min-h-14 w-full items-center gap-2 border-t border-border text-left">
                <b className="min-w-0 flex-1 truncate text-[15px] font-semibold">{`${quick.length - quickShown.length} more${firsts ? ` · you won ${firsts} of ${quick.length}` : ""}`}</b>
                <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden />
              </button>
            )}
            {extras}
          </div>
        )}
        {ordered.length > 0 && (
          <div data-night-group="longer" className={short ? "mt-5" : undefined}>
            {short && <GroupLabel>Longer games</GroupLabel>}
            {shown.map((x) => (
              <NightCard key={x.g.leagueId} night={x} name={nameOf(x.g)} show={show} open={open} />
            ))}
            {folded.length > 0 && (
              <button type="button" data-night-fold={folded.length} onClick={() => setAll(true)} className="nd-press flex min-h-14 w-full items-center gap-2.5 border-t border-border py-2 text-left">
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold">{folded.length} more {folded.length === 1 ? "game" : "games"}</b>
                  <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">{folded.map((x) => nameOf(x.g)).join(" · ")}</small>
                </span>
                <ChevronDown className="size-4 flex-none text-muted-foreground" aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>
    </Block>
  );
}

// ---------- the next episode's quick games you could join ----------

/** In Next · Ep N+1: the couch's quick games for it that you're not in (who's in, when it locks, Join), at most two; someone who only
 *  watches, with no quick game to join, gets one season game still open to them. */
export function JoinRows({ show, ep }: { show: ShowData; ep: number }) {
  const couchId = show.couch?.id ?? null;
  const seasonId = show.header?.seasonId ?? null;
  const playing = show.games.some((g) => g.yourRole);
  const q = useCouchGames(couchId, !!couchId && !show.solo && !show.readOnly);
  const [joining, setJoining] = useState<JoinGame | null>(null);
  if (!couchId || !seasonId) return null;
  const open = (q.data?.games ?? []).filter((g) => g.seasonId === seasonId && !g.ended && !g.you?.playing && (g.mode === "open" || (g.mode === "ask" && !!g.you?.letIn)));
  const quick = open.filter((g) => g.span && g.span.from === g.span.to && g.span.from === ep);
  const season = !playing && !quick.length ? open.filter((g) => !(g.span && g.span.from === g.span.to)).slice(0, 1) : [];
  const rows = [...quick.slice(0, 2), ...season];
  if (!rows.length) return null;
  return (
    <>
      {rows.map((g) => {
        const quickOne = !!g.span && g.span.from === g.span.to;
        const who = g.faces.length ? `${g.faces.length} in` : "Be the first in";
        const title = quickOne ? quickName(g.name) : (GAME_NAMES[g.gameName] ?? g.gameName);
        return (
          <div key={g.leagueId} data-join-row={g.leagueId} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2">
            <span className="flex w-5 flex-none justify-center">
              <i className="size-2 rounded-full" style={{ background: gameInk(g.gameName) }} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px] font-semibold">{title}</b>
              <small className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <span className="flex flex-none items-center" aria-hidden>
                  {g.faces.slice(0, 3).map((f, i) => (
                    <span key={f.userId} className="rounded-[4px] ring-2 ring-background" style={{ marginLeft: i ? -5 : 0, zIndex: 3 - i }}>
                      <Avatar id={f.userId} name={f.name} size={18} />
                    </span>
                  ))}
                </span>
                <span className="min-w-0 truncate">{[who, quickOne ? "pick before you watch" : `from ${show.words.ep} ${Math.max(g.latest + 1, 1)}`].join(" · ")}</span>
              </small>
            </span>
            <Btn tone="optional" className="h-10 flex-none px-4" data-join-button onClick={() => setJoining(g)}>
              Join
            </Btn>
          </div>
        );
      })}
      {quick.length > 2 && (
        <NavLink href={paths.show(seasonId, "games")} className="nd-press flex min-h-11 items-center gap-1 border-t border-border text-[14px] font-semibold text-muted-foreground">
          {quick.length - 2} more on the Games tab
          <ChevronRight className="size-4" aria-hidden />
        </NavLink>
      )}
      <JoinGameSheet couchId={couchId} game={joining} onOpenChange={(o) => !o && setJoining(null)} />
    </>
  );
}
