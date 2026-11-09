import { epShort } from "../show-words";
import type { CastFace, GameView, TableRow } from "../game-view";
import type { MainBlock } from "./grammar";
import { compileGame, has, type GamePage } from "./compile";

// A game's own page, as blocks (docs/PLAN-start-a-game-gpt.md U1; the U0 mocks' render-hi.js, "The broadcast segment"): the
// compiled page (compile.ts: what the spec says goes where) read against the game as this seat may see it (game-view.ts: the
// viewer's own copy at their mark, so nothing here is past where they are). One skeleton for every game, top to bottom:
//   the title card    the game's name over the show's art, a plate with the show's tag and when it airs, its short line
//   the twists        what's different about this game, a tag each (from the spec: a captain, bounties, the cut...)
//   the strip         your move: the screen's one yellow when it's due, All set when nothing is, Final once it's over
//   the big graphic   where you stand, at full size, in the game's own terms (a streak, points, a record, lives, a race)
//   the couch         a podium of lower thirds (the top three, and you), then standings rows
//   Previously on     what the episodes you've seen did to you, stacked plates
//   How it plays      the rules in the engine's words
// One phase drives it: before the game counts, while it does, and once it's over. A move that is the main block (a game of
// questions) is made in place, on the page. The page draws this (src/new/show/game-page.tsx); pure, for tests/game-page.test.js.

export type Tone = "chy" | "live" | "good" | "quiet" | "show" | "you";
export type Phase = "before" | "during" | "over";

export interface PlateM {
  tag: string;
  tone: Tone;
  title: string;
  line: string | null;
  /** A castaway's face on the plate's end. */
  face: string | null;
}

export interface FaceM {
  id: string;
  name: string;
  photo: string | null;
  /** The line under the name: a state that matters (Out Ep 4, Starting, Ep 2), else the face's qualifier (its group). */
  line: string | null;
  /** A corner badge: "right" and "wrong" are drawn as a tick and a cross, anything else as its words ("Out", "C"). */
  badge: { text: string; tone: Tone } | null;
  out: boolean;
  /** Ringed: chosen (a starter, tonight's pick). */
  on: boolean;
}

export interface HeroM {
  /** The big number and what it counts ("5", "In a row"); null: the main block is its own graphic (a matchup). */
  n: string | null;
  label: string;
  sub: string | null;
  /** The face-off: you and who you play, the scores. */
  vs: { you: string; them: string; you_n: string; them_n: string; youId: string; themId: string | null; themUser: string | null; youUser: string | null } | null;
  faces: FaceM[];
  /** An empty place after the faces: the pick still to make ("Ep 6"). */
  slot: string | null;
  lives: { left: number; of: number } | null;
  bars: { name: string; value: number; max: number; you: boolean }[] | null;
  /** A game in stages: each, the one on now first, and its own page (a stage is a league of its own). */
  stages: { name: string; tag: string; now: boolean; leagueId: string | null }[] | null;
  /** Small plates under the faces: your group slots, your secret role. */
  notes: { tag: string; tone: Tone; title: string; line: string | null }[];
}

/** Where the strip goes: Your moves at a tab, a page (the draft room, Waivers), the questions (on this page or their sheet), the
 *  bingo card, Call it. */
export type Go = { tab: "lineup" | "pool" | "predict" | "outlast" } | { href: string } | { sheet: true } | { bingo: number } | { call: number } | { twist: true } | { slots: true } | null;

export interface StripM {
  kind: "move" | "answers" | "bingo" | "calls" | "twist" | "slots" | "out" | "set" | "over" | "start";
  tag: string;
  tone: "chy" | "quiet";
  title: string;
  line: string;
  due: boolean;
  /** The move is made on the page (a game of questions): the strip points down to it. */
  inPlace: boolean;
  go: Go;
}

export interface Standing {
  playerId: string;
  userId: string | null;
  rank: string;
  name: string;
  you: boolean;
  bot: boolean;
  value: string;
  sub: string | null;
  out: boolean;
  /** A castaway's face on the plate's end: a pool's last decided pick. */
  face: string | null;
}

export interface CouchM {
  /** What the number on each row counts ("Points", "Streak", "W–L"). */
  unit: string;
  podium: Standing[];
  rows: Standing[];
  /** A line under the table: the cut, fewest wins, how teams stand. */
  note: string | null;
  teams: string | null;
  /** A co-op game: the couch together against the show. */
  coop: { lives: number; of: number; result: "won" | "lost" | null } | null;
  /** Everyone on a public pool (the table is the top and you). */
  players: number;
  /** The cut's line: how many rows (of podium and rows, in order) stay above it; null without a cut to come. */
  cutAfter: number | null;
  cutLabel: string | null;
}

export interface PageModel {
  phase: Phase;
  main: MainBlock;
  title: { name: string; show: string; tag: string; when: string | null; line: string };
  chips: string[];
  strip: StripM;
  hero: HeroM;
  /** The move made on the page, under the big graphic: the questions, choosing the twist, or your group slots. */
  inPlace: "questions" | "twist" | "slots" | null;
  couch: CouchM;
  previously: { asOf: string; items: PlateM[] };
  rules: string[];
}

/** Your move in this game, as the Games tab's card says it (src/new/show/your-move.ts). */
export interface MoveIn {
  kind: string;
  title: string;
  line: string;
  due: boolean;
  go: { tab: "lineup" | "pool" | "predict" | "outlast" } | { href: string };
}

export interface PageContext {
  show: string;
  words: { episode: string; episodes: string };
  /** The next episode to air, as the schedule says. */
  next: { number: number; airsAt: string | null } | null;
  /** A time as the app says it ("Wed 8:00 PM"). */
  when: (iso: string) => string;
  move: MoveIn | null;
  /** The game's short line (describe.js short.line). */
  line?: string | null;
  /** The last episode you've seen (your mark), when you have one. */
  seen?: number | null;
  /** Your secret role (the roles route, secret-roles.ts): never anyone else's before the reveal. */
  roles?: { name: string; count?: number; dealt: boolean; mine: { role: string; points: number | null; mates: { name: string }[] | null } | null; revealed: { at: number; holders: { name: string }[] } | null } | null;
  /** The top scorer's twist (the twist route, twists.ts): the episode being chosen for, whether it's yours, and what's been played. */
  twist?: { options: { id: string; name: string; times: number }[]; next: { episode: number; closesAt: string | null; youChoose: boolean; choice: string | null } | null; played: { episode: number; name: string | null; by: { name: string } | null }[] } | null;
  /** A game in stages: its stages' own games (each a league), as the show's games have them. */
  stageGames?: { leagueId: string; name: string; over: boolean; airsAt: string | null }[];
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;
const first = (name: string) => name.split(" ")[0];
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const placeWord = (r: TableRow) => (r.rank.startsWith("T") ? `Tied ${ordinal(r.place)}` : ordinal(r.place));

/** The questions' main blocks: the move is made in place. */
const IN_PLACE: MainBlock[] = ["ballot", "slate", "together"];

/** Before the game counts (its first episode still ahead, or its phase not started), while it does, or over. `next`: the next
 *  episode you'd play (nextOf). A game nothing has moved yet whose first episode has aired is under way: a bingo nobody ticked. */
export function phaseOf(g: Pick<GameView, "over" | "from" | "through">, next: number): Phase {
  if (g.over) return "over";
  if (g.from === null || (g.through < g.from && g.from >= next)) return "before";
  return "during";
}

/** The next episode for this page: the schedule's next to air, but never one at or before where you are or the game is (a season
 *  watched behind its airing, a replayed season's schedule); its air time only when it's the schedule's own. */
export function nextOf(g: Pick<GameView, "through"> & Partial<Pick<GameView, "lineup" | "pick" | "call" | "sheet">>, ctx: Pick<PageContext, "next" | "seen" | "stageGames">): { number: number; airsAt: string | null } {
  const past = Math.max(g.through, ctx.seen ?? 0);
  if (ctx.next && ctx.next.number > past) return ctx.next;
  // The game's own move for that episode knows when it airs (its lock), when the schedule doesn't.
  const own = [g.lineup, g.pick, g.call].find((x) => x && x.episode === past + 1 && x.airsAt)?.airsAt ?? (g.sheet?.episode === past + 1 ? g.sheet.closesAt : null) ?? ctx.stageGames?.find((s) => !s.over && s.airsAt)?.airsAt ?? null;
  return { number: past + 1, airsAt: own ?? null };
}

/** What a row's number is, in this game's terms. */
function valueOf(g: GameView, page: GamePage, r: TableRow): string {
  if (page.rank === "matchups" && r.record) return `${r.record.wins}–${r.record.losses}${r.record.ties ? `–${r.record.ties}` : ""}`;
  if (page.rank === "weeks" && g.weeksWon) return String(g.weeksWon[r.playerId] ?? 0);
  return String(r.total);
}

/** A pick each episode that keeps you in (a Survival Pool), not one scored by what they do: its table is its streak. */
const isPool = (page: GamePage) => page.main === "ladder";

function unitOf(g: GameView, page: GamePage): string {
  if (isPool(page) && (page.rank === "streak" || page.rank === "standing")) return "Streak";
  if (page.rank === "matchups") return "W–L";
  if (page.rank === "weeks") return "Weeks";
  if (page.rank === "worth") return "Worth";
  if (has(page, "control", "calls")) return "Right";
  if (page.main === "card") return g.linePoints && g.linePoints > 1 ? "Points" : "Lines";
  return "Points";
}

/** "2nd · 7 behind Joanna", "Tied 1st with Joanna", "1st · 4 ahead of Sam". */
function standLine(g: GameView, page: GamePage, you: TableRow): string {
  const table = g.table;
  const leader = table.find((r) => r.place === 1 && !r.you);
  const tiedWith = table.filter((r) => !r.you && r.rank === you.rank);
  if (tiedWith.length) return `${placeWord(you)} with ${tiedWith.length === 1 ? first(tiedWith[0].name) : plural(tiedWith.length, "other")}`;
  const counts = page.rank !== "matchups";
  if (you.place === 1) {
    const second = table.find((r) => !r.you && r.place === 2);
    return second && counts ? `1st · ${second.total === you.total ? "level with" : `${you.total - second.total} ahead of`} ${first(second.name)}` : "1st";
  }
  return leader && counts ? `${ordinal(you.place)} · ${leader.total - you.total} behind ${first(leader.name)}` : ordinal(you.place);
}

const faceOf = (g: GameView, id: string): CastFace | null => g.cast.find((c) => c.id === id) ?? null;

function castFace(c: CastFace | null, id: string, o: Partial<FaceM> = {}): FaceM {
  // The qualifier (a position, a role) keeps its place beside whatever state takes the line ("WR Â· Starting").
  const said = o.line ?? c?.tribe?.name ?? null;
  const line = c?.role ? (said ? `${c.role} Â· ${said}` : c.role) : said;
  return { id, name: c ? first(c.name) : "Someone", photo: c?.photo ?? null, line, badge: o.badge ?? null, out: o.out ?? !!c?.knocked, on: o.on ?? false };
}

function heroOf(g: GameView, page: GamePage, main: MainBlock, phase: Phase, ctx: PageContext): HeroM {
  const E = ctx.words.episode;
  const you = g.you;
  const blank: HeroM = { n: null, label: "", sub: null, vs: null, faces: [], slot: null, lives: null, bars: null, stages: null, notes: notesOf(g, ctx) };
  // Before it counts: who's playing and when it starts.
  if (phase === "before" || !you) {
    const start = g.from ?? nextOf(g, ctx).number;
    return { ...blank, n: String(g.players), label: g.players === 1 ? "Playing" : "Playing", sub: g.from === null ? `Starts when ${g.phase ?? "its phase"} starts` : start ? `Starts with ${E} ${start}` : "Starts soon" };
  }
  if (phase === "over") {
    return { ...blank, n: ordinal(you.place), label: "Final", sub: `Of ${g.players} · ${you.total} ${unitOf(g, page).toLowerCase()}` };
  }
  const sub = standLine(g, page, you);
  switch (main) {
    case "ladder": {
      const decided = you.picks.filter((p) => p.castawayId && p.correct !== null).slice(-5);
      const faces = decided.map((p) => castFace(faceOf(g, p.castawayId!), p.castawayId!, { line: `${epShort(E)} ${p.episode}`, badge: p.correct ? { text: "right", tone: "good" } : { text: "wrong", tone: "quiet" }, out: false }));
      const pick = g.pick;
      const tonight = pick?.pick ? castFace(faceOf(g, pick.pick), pick.pick, { line: `${epShort(E)} ${pick.episode}`, on: true }) : null;
      const p = g.twists?.pool;
      const spare = p?.mulligans != null ? ` · ${plural(p.mulligans, "mulligan")} left` : "";
      return { ...blank, n: String(you.week ?? 0), label: "In a row", sub: sub + spare, faces: tonight ? [...faces, tonight] : faces, slot: pick && !pick.pick ? `${epShort(E)} ${pick.episode}` : null, lives: p?.lives != null && p.livesOf ? { left: p.lives, of: p.livesOf } : null };
    }
    case "team":
    case "picks":
    case "worth": {
      const starters = new Set(g.lineup?.starters ?? []);
      const team = you.team.slice(0, 8).map((id) => {
        const c = faceOf(g, id);
        const out = !!c?.knocked;
        const line = out ? `Out ${epShort(E)} ${c?.out ?? ""}`.trim() : g.lineup && !g.lineup.locked ? (starters.has(id) ? "Starting" : "Bench") : c?.points != null ? `${c.points} pts` : null;
        const captain = g.twists?.captain?.castawayId === id;
        return castFace(c, id, { line: captain && !out ? `Captain ×${g.twists!.captain!.times}` : line, out, on: !!g.lineup && !g.lineup.locked && starters.has(id), badge: out ? { text: "Out", tone: "live" } : captain ? { text: "C", tone: "you" } : null });
      });
      return { ...blank, n: String(you.total), label: main === "worth" ? "Worth" : "Points", sub, faces: team };
    }
    case "matchup": {
      const m = g.matchups;
      const last = m?.last;
      const them = last?.opponent ? g.table.find((r) => r.playerId === last.opponent) : null;
      const rec = you.record ? `${you.record.wins}–${you.record.losses}${you.record.ties ? `–${you.record.ties}` : ""}` : null;
      if (last && last.points != null) {
        const against = them ? them.name : last.stand === "median" ? "the median" : "a bye";
        return {
          ...blank,
          label: "",
          sub: `${E} ${last.episode} final: ${last.result === "win" ? "you beat" : last.result === "loss" ? "you lost to" : "you tied with"} ${against} · ${rec ? `you're ${rec}, ` : ""}${ordinal(you.place)}${m?.playoffs ? ` · the top ${m.playoffs.teams} make the playoffs` : ""}`,
          vs: { you: "You", them: them ? first(them.name) : last.stand === "median" ? "Median" : "Bye", you_n: String(last.points), them_n: last.against == null ? "–" : String(last.against), youId: you.playerId, themId: them?.playerId ?? null, youUser: you.userId, themUser: them?.userId ?? null },
        };
      }
      return { ...blank, n: rec ?? "0–0", label: "Record", sub };
    }
    case "week":
      return { ...blank, n: String(g.weeksWon?.[you.playerId] ?? 0), label: "Weeks won", sub, bars: barsOf(g, (r) => r.week ?? 0) };
    case "race": {
      const to = page.facts.raceTo ?? 0;
      return { ...blank, n: String(Math.max(0, to - you.total)), label: "To go", sub: `First to ${to} wins · ${sub}`, bars: barsOf(g, (r) => r.total, to) };
    }
    case "together": {
      const c = g.coop;
      return c ? { ...blank, n: String(c.lives), label: c.lives === 1 ? "Life left" : "Lives left", sub: "Shared by the couch: a question nobody gets costs one", lives: { left: c.lives, of: c.of } } : { ...blank, n: String(you.total), label: "Points", sub };
    }
    case "card":
      return { ...blank, n: String(g.bingo?.lines ?? you.total), label: g.bingo ? (g.bingo.lines === 1 ? "Line" : "Lines") : unitOf(g, page), sub: g.bingo ? `${E} ${g.bingo.episode} · ${plural(g.bingo.ticked, "square")} ticked · ${sub}` : sub };
    case "stages": {
      const games = ctx.stageGames ?? [];
      const own = (name: string) => games.find((x) => x.name.endsWith(name)) ?? null;
      const nowAt = Math.max(0, (page.stages ?? []).findIndex((s) => !own(s.name)?.over));
      const stages = (page.stages ?? []).map((s, i) => ({ name: s.name, tag: i === nowAt ? "Now" : s.alongside ? "Too" : i < nowAt ? "Done" : "Next", now: i === nowAt, leagueId: own(s.name)?.leagueId ?? null }));
      return { ...blank, n: String(you.total), label: "Overall", sub, stages };
    }
    default:
      return { ...blank, n: String(you.total), label: unitOf(g, page), sub };
  }
}

/** Small plates under the big graphic: your group slots going into the next episode, and your secret role (only yours, only
 *  once dealt: the roles route never says anyone else's before the reveal). */
function notesOf(g: GameView, ctx: PageContext): HeroM["notes"] {
  const out: HeroM["notes"] = [];
  const WORD = { held: "Held", void: "Void", dropped: "Dropped", waiting: "Waiting", empty: "Empty" } as const;
  // Held slots each; the ones waiting on a pick are the strip's move (picked on the page), so only the held and the void show here.
  for (const s of g.twists?.slots ?? []) {
    if (s.status === "empty" || s.status === "dropped") continue;
    out.push({ tag: `Slot ${s.slot + 1}`, tone: s.status === "held" ? "good" : "quiet", title: s.group ?? WORD[s.status], line: s.status === "held" ? `${plural(s.members.length, "still in")}` : s.status === "void" ? "It doesn't count this episode" : null });
  }
  const r = ctx.roles;
  if (r?.mine && !r.revealed) out.push({ tag: "Secret", tone: "quiet", title: `You're a ${r.mine.role}`, line: `Only you can see it${r.mine.mates?.length ? ` · with ${r.mine.mates.map((m) => m.name).join(", ")}` : ""}${r.mine.points != null ? ` · ${plural(r.mine.points, "point")} so far` : ""}` });
  else if (r && r.dealt && !r.mine && !r.revealed) out.push({ tag: "Secret", tone: "quiet", title: `You're not a ${r.name}`, line: `${r.count && r.count > 1 ? `${r.count} on the couch are` : "Someone on the couch is"} · revealed at the end` });
  return out;
}

function barsOf(g: GameView, val: (r: TableRow) => number, max?: number): HeroM["bars"] {
  const rows = g.table.slice(0, 6);
  const top = max ?? Math.max(1, ...rows.map(val));
  return rows.map((r) => ({ name: r.you ? "You" : first(r.name), value: val(r), max: top, you: r.you }));
}

function stripOf(g: GameView, page: GamePage, phase: Phase, ctx: PageContext): StripM {
  const E = ctx.words.episode;
  const nx = nextOf(g, ctx);
  const ep = nx.number;
  const airs = nx.airsAt ? ctx.when(nx.airsAt) : null;
  const inPlace = IN_PLACE.includes(page.main);
  if (phase === "over") return { kind: "over", tag: "Final", tone: "quiet", title: g.you ? `You finished ${ordinal(g.you.place)}` : "It's over", line: `Through ${E} ${g.through}`, due: false, inPlace: false, go: null };
  const m = ctx.move;
  const sheet = g.sheet && g.sheet.of > g.sheet.answered ? g.sheet : null;
  const TAG: Record<string, string> = { lineup: "Lineup", pick: "Your pick", draft: "Draft", waivers: "Replace", swaps: "Swaps" };
  if (m && m.due) return { kind: "move", tag: TAG[m.kind] ?? "Your move", tone: "chy", title: m.title, line: m.line, due: true, inPlace: false, go: m.go };
  // The top scorer's twist, while it's yours to choose: chosen on the page.
  const tw = ctx.twist?.next;
  if (tw?.youChoose) {
    const lock = `You topped ${epShort(E)} ${tw.episode - 1}${tw.closesAt ? ` · by ${ctx.when(tw.closesAt)}` : ""}`;
    const chosen = tw.choice ? ctx.twist!.options.find((o) => o.id === tw.choice)?.name : null;
    return chosen
      ? { kind: "twist", tag: "Set", tone: "quiet", title: `Your twist: ${chosen}`, line: `${E} ${tw.episode} · change it until it locks`, due: false, inPlace: true, go: { twist: true } }
      : { kind: "twist", tag: "Your twist", tone: "chy", title: "Pick a twist", line: lock, due: true, inPlace: true, go: { twist: true } };
  }
  // A group slot that's empty or whose group ended: pick one, on the page.
  const open = (g.twists?.slots ?? []).filter((s) => s.status === "empty" || s.status === "dropped");
  if (open.length && g.twists?.offered?.groups.length) {
    const lock = g.lineup?.airsAt ? `Locks ${ctx.when(g.lineup.airsAt)}` : airs ? `Locks ${airs}` : "Before it locks";
    return { kind: "slots", tag: "Your slots", tone: "chy", title: open.length === 1 ? "Pick a group" : `Pick ${open.length} groups`, line: lock, due: true, inPlace: true, go: { slots: true } };
  }
  const pool = g.twists?.pool;
  if (pool?.out != null) return { kind: "out", tag: "Out", tone: "quiet", title: `Out since ${E} ${pool.out}`, line: pool.buyBack ? "You can buy back in: it's in Your moves" : "Your streak stands where it ended", due: false, inPlace: false, go: pool.buyBack ? { tab: "pool" } : null };
  if (sheet) {
    const left = sheet.of - sheet.answered;
    const lock = sheet.closesAt ? `Locks ${ctx.when(sheet.closesAt)}` : airs ? `Locks ${airs}` : "Open now";
    // A single question says itself ("Who goes home?").
    const title = sheet.of === 1 && sheet.ask ? sheet.ask : sheet.finale ? `${plural(left, "finale pick")} to make` : `${plural(left, "question")}${sheet.episode ? ` for ${E} ${sheet.episode}` : ""}`;
    return { kind: "answers", tag: left === 1 ? "Your answer" : "Your answers", tone: "chy", title, line: lock, due: true, inPlace, go: { sheet: true } };
  }
  // Every answer in: still made in place (to see or change), the strip quiet.
  if (g.sheet && g.sheet.of > 0 && inPlace) {
    const lock = g.sheet.closesAt ? ctx.when(g.sheet.closesAt) : airs;
    return { kind: "answers", tag: "Set", tone: "quiet", title: g.sheet.of === 1 ? "Your answer is in" : `Your ${g.sheet.of} answers are in`, line: lock ? `Change until ${lock}` : "Change until it locks", due: false, inPlace, go: { sheet: true } };
  }
  if (g.bingo?.open) return { kind: "bingo", tag: "Bingo", tone: "chy", title: `Your card for ${E} ${g.bingo.episode}`, line: `Tick it as it airs · ${plural(g.bingo.ticked, "square")} so far`, due: true, inPlace: false, go: { bingo: g.bingo.episode } };
  if (g.call?.open && g.call.made < g.call.of) return { kind: "calls", tag: "Your calls", tone: "chy", title: `${plural(g.call.of - g.call.made, "call")} for ${E} ${g.call.episode}`, line: g.call.airsAt ? `Locks ${ctx.when(g.call.airsAt)}` : "Before it airs", due: true, inPlace: false, go: { call: g.call.episode } };
  if (m) return { kind: "move", tag: "Set", tone: "quiet", title: m.title, line: m.line, due: false, inPlace: false, go: m.go };
  if (phase === "before") return { kind: "start", tag: "Starts", tone: "quiet", title: g.from === null ? `When ${g.phase ?? "its phase"} starts` : `${E} ${g.from}`, line: airs && g.from === ep ? `Airs ${airs}` : "Nothing to do yet", due: false, inPlace: false, go: null };
  return { kind: "set", tag: "All set", tone: "quiet", title: `Nothing to do before ${epShort(E)} ${ep}`, line: airs ? `${E} ${ep} airs ${airs}` : `Waiting for ${E} ${ep}`, due: false, inPlace: false, go: null };
}

function couchOf(g: GameView, page: GamePage, ctx: PageContext): CouchM {
  const E = ctx.words.episode;
  const standing = (r: TableRow): Standing => {
    const last = [...r.picks].reverse().find((p) => p.castawayId && p.correct !== null);
    const handicap = r.handicap ? `+${r.handicap} head start` : null;
    const sub =
      handicap ??
      (isPool(page) && last ? `${epShort(E)} ${last.episode}: ${faceOf(g, last.castawayId!)?.name.split(" ")[0] ?? "someone"}, ${last.correct ? "right" : "wrong"}` : r.week != null && !isPool(page) ? `${r.week >= 0 ? "+" : "−"}${Math.abs(r.week)} last ${E.toLowerCase()}` : r.side?.name ? r.side.name : null);
    // Out of head to head's playoffs only once they're seeded (Red Is For Leaving): before that, nobody has left.
    const seeded = !!g.matchups?.playoffs?.seeds?.length;
    const extras = [
      g.twists?.bounty?.[r.playerId] ? `${g.twists.bounty[r.playerId] > 0 ? "+" : "−"}${Math.abs(g.twists.bounty[r.playerId])} from bounties` : null,
      g.twists?.budget?.[r.playerId] != null ? `${g.twists.budget[r.playerId]} left to spend` : null,
    ].filter(Boolean);
    const knocked = !!g.twists?.out.includes(r.playerId);
    return { playerId: r.playerId, userId: r.userId, rank: r.rank, name: r.name, you: r.you, bot: r.bot, value: valueOf(g, page, r), sub: [sub, ...extras].filter(Boolean).join(" · ") || null, out: knocked || (seeded && !!r.record && !r.record.alive), face: isPool(page) && last?.castawayId ? last.castawayId : null };
  };
  const all = g.table.map(standing);
  const top = all.slice(0, 3);
  const you = all.find((s) => s.you);
  const podium = you && !top.includes(you) ? [...top, you] : top;
  const rows = all.filter((s) => !podium.includes(s));
  const notes: string[] = [];
  const cut = page.facts.cut;
  const next = g.twists?.cut;
  if (cut && !next) notes.push(`The cut${cut.every ? ` every ${plural(cut.every, E.toLowerCase())}` : cut.episode ? ` after ${E} ${cut.episode}` : cut.phase ? ` at ${cut.phase}` : ""}: ${cut.out === "half" ? "the bottom half go" : cut.out ? `the bottom ${cut.out} go` : "the bottom goes"}`);
  // The next cut's line: above it stays in, below it goes when it comes (the knocked out are below already).
  const still = all.filter((s) => !s.out).length;
  const going = next ? (next.out === "half" ? Math.floor(still / 2) : next.out) : 0;
  const cutAfter = next && going > 0 && going < still ? still - going : null;
  const phaseName = next?.phase ? next.phase.charAt(0).toUpperCase() + next.phase.slice(1) : null;
  // How many go says itself on the line (a short line can say it loosely: "Lowest score is cut").
  const cutLabel = next && cutAfter !== null ? `The cut · bottom ${going} · ${next.after ? `after ${epShort(E)} ${next.after}` : phaseName ? `when ${phaseName} starts` : "next"}` : null;
  if (has(page, "table", "reverse")) notes.push("Fewest points wins");
  if (has(page, "table", "bank") && page.facts.bank) notes.push(`Everyone starts with a bank of ${page.facts.bank}`);
  const teams = g.teams?.teams.length
    ? g.teams.teams
        .map((t) => t.members.map((id) => (g.table.find((r) => r.playerId === id)?.you ? "you" : first(g.table.find((r) => r.playerId === id)?.name ?? "someone"))).join(" + "))
        .join(" · ")
    : null;
  return { unit: unitOf(g, page), podium, rows, note: notes.join(" · ") || null, teams: teams ? `Teams: ${teams}` : null, coop: g.coop ? { lives: g.coop.lives, of: g.coop.of, result: g.coop.result } : null, players: g.players, cutAfter, cutLabel };
}

function previouslyOf(g: GameView, page: GamePage, phase: Phase, ctx: PageContext): PageModel["previously"] {
  const E = ctx.words.episode;
  if (phase === "before" || !g.through) return { asOf: g.from ? `It starts with ${E} ${g.from}` : "Nothing yet", items: [] };
  const items: PlateM[] = [];
  const you = g.you;
  if (you && isPool(page)) {
    for (const p of you.picks.filter((x) => x.castawayId && x.correct !== null).slice(-2).reverse()) {
      const c = faceOf(g, p.castawayId!);
      items.push({ tag: p.correct ? "Survived" : "Wrong", tone: p.correct ? "good" : "quiet", title: `${c ? first(c.name) : "Your pick"} · your pick`, line: `${E} ${p.episode}`, face: p.castawayId });
    }
  } else if (g.matchups?.last && g.matchups.last.points != null) {
    const l = g.matchups.last;
    const them = l.opponent ? g.table.find((r) => r.playerId === l.opponent) : null;
    items.push({ tag: l.result === "win" ? "W" : l.result === "loss" ? "L" : "T", tone: "quiet", title: `${E} ${l.episode}: ${l.points}–${l.against ?? "–"}`, line: them ? `Against ${first(them.name)}` : null, face: null });
  } else if (you?.weeks.length) {
    for (const w of you.weeks.slice(-2).reverse()) {
      const best = w.started[0];
      const c = best ? faceOf(g, best.id) : null;
      items.push({ tag: `${w.total >= 0 ? "+" : "−"}${Math.abs(w.total)} pts`, tone: "quiet", title: `${E} ${w.episode}: you scored ${w.total}`, line: c && best ? `Your best: ${first(c.name)} ${best.points >= 0 ? "+" : "−"}${Math.abs(best.points)}` : null, face: best?.id ?? null });
    }
  } else if (you?.week != null) {
    items.push({ tag: `${you.week >= 0 ? "+" : "−"}${Math.abs(you.week)}`, tone: "quiet", title: `${E} ${g.through}: you scored ${you.week}`, line: null, face: null });
  }
  for (const t of ctx.twist?.played.filter((x) => x.name).slice(-1) ?? []) items.push({ tag: "Twist", tone: "quiet", title: `${E} ${t.episode}: ${t.name ?? "no twist"}`, line: t.by ? `Chosen by ${t.by.name}` : null, face: null });
  if (ctx.roles?.revealed) items.push({ tag: "Revealed", tone: "quiet", title: `The ${ctx.roles.name}${ctx.roles.revealed.holders.length === 1 ? "" : "s"}: ${ctx.roles.revealed.holders.map((h) => h.name).join(", ")}`, line: `${E} ${ctx.roles.revealed.at}`, face: null });
  for (const l of g.coop?.lost.slice(-2).reverse() ?? []) items.push({ tag: "−1 life", tone: "quiet", title: `${E} ${l.episode}`, line: `Nobody got “${l.question}”`, face: null });
  // Who went home, as far as you've seen: the latest episode's exits (a red tag: leaving).
  const gone = g.cast.filter((c) => c.knocked && c.out === g.through).slice(0, 2);
  for (const c of gone) items.push({ tag: "Out", tone: "live", title: `${first(c.name)} went home`, line: `${E} ${g.through}`, face: c.id });
  return { asOf: `As of ${E} ${g.through} · as far as you've watched`, items: items.slice(0, 4) };
}

/** What's different about this game, a tag each: its twists from the spec (the state of each, a captain's or a bounty's, isn't in
 *  the view yet; How it plays says the rest), less any its short line already says. */
function chipsOf(page: GamePage, line: string, twists?: GameView["twists"], words?: string): string[] {
  const f = page.facts;
  const out: string[] = [];
  const add = (cond: boolean, w: string) => cond && !out.includes(w) && out.push(w);
  add(has(page, "badge", "captain"), `Captain ×${f.captainTimes ?? 2}`);
  // Which episode multiplies, from the view once it knows it; else what the spec says (the finale, from a phase).
  const t = f.times;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  add(has(page, "event", "times") && !twists?.times, t ? `×${t.times} ${t.finale ? "the finale" : t.episode ? `${(words ?? "Episode").slice(0, 2)} ${t.episode}` : t.phase ? `from ${cap(t.phase)}` : "some episodes"}` : "Points multiply");
  add(!!twists?.times, `×${twists?.times?.times} ${(words ?? "Episode").slice(0, 2)} ${twists?.times?.episode}`);
  add(has(page, "badge", "bounty"), "Bounties");
  add(has(page, "badge", "role"), "Secret roles");
  add(has(page, "event", "cut"), "The cut");
  add(has(page, "event", "twist"), "Top scorer picks a twist");
  add(has(page, "badge", "saves"), f.lives ? `${plural(f.lives, "life", "lives")}` : f.mulligans ? `${plural(f.mulligans, "mulligan")}` : "Lives");
  add(has(page, "move", "buyback"), "Buy back in");
  add(has(page, "move", "second"), "A second pick");
  add(has(page, "event", "draw"), "Order drawn");
  add(has(page, "move", "auction"), "Auction");
  add(has(page, "move", "blind"), "Blind draft");
  add(has(page, "move", "keepers"), "Keepers");
  add(has(page, "badge", "used"), "No repeats");
  add(has(page, "badge", "taken"), "One owner each");
  add(has(page, "badge", "group"), "Group slots");
  add(has(page, "move", "spread"), "One from each group");
  add(has(page, "badge", "times"), "Late joiners ×");
  add(has(page, "badge", "counted"), "Best ones count");
  add(has(page, "table", "teams") || has(page, "event", "teams"), f.teams ? `${f.teams} teams` : "Teams");
  add(has(page, "table", "handicap"), "Head starts");
  add(has(page, "rider", "rollover") || has(page, "event", "rollover"), "Rollovers");
  add(has(page, "event", "redraft"), "Redraft");
  add(has(page, "event", "change"), "Changes with the show");
  add(has(page, "move", "vote"), "The couch votes");
  add(has(page, "move", "host"), "A host writes the card");
  add(has(page, "move", "squares"), "Squares");
  add(has(page, "move", "waivers"), "Waivers");
  add(has(page, "rider", "beat"), "Beat the bot");
  add(has(page, "rider", "stake") && !!f.bank, `A bank of ${f.bank}`);
  add(has(page, "lock", "late"), "Late lock");
  // A tag the short line already says goes ("3 lives" beside "· 3 lives", "The cut" beside "Lowest score is cut", "Buy back in"
  // beside "Buyback"; "Blind draft" stays beside "Draft 5"): every word of it that carries meaning, or the whole of it run
  // together, found in the line.
  const said = line.toLowerCase();
  const flat = said.replace(/[^a-z0-9]/g, "");
  const filler = new Set(["the", "and", "one", "each", "some", "from", "with", "points", "a", "in", "of", "by"]);
  const saysIt = (c: string) => {
    const words = c.toLowerCase().split(/[^a-z0-9×]+/).filter((w) => w.length >= 3 && !filler.has(w));
    return flat.includes(c.toLowerCase().replace(/[^a-z0-9]/g, "")) || (words.length > 0 && words.every((w) => flat.includes(w)));
  };
  return out.filter((c) => !saysIt(c)).slice(0, 4);
}

/** The game's page, as blocks. */
/** A number at hero size: a fraction to one place (33.68 is 33.7; the couch keeps it whole). */
const big = (n: string | null): string | null => (n !== null && /^-?\d+\.\d{2,}$/.test(n) ? String(Math.round(Number(n) * 10) / 10) : n);

export function pageModel(g: GameView, page: GamePage, ctx: PageContext): PageModel {
  const next = nextOf(g, ctx);
  const phase = phaseOf(g, next.number);
  const E = ctx.words.episode;
  // The next episode's multiplier on its tag, once it's known (a multiplied episode, or the twist chosen for it).
  const chosenTwist = ctx.twist?.next?.choice ? ctx.twist.options.find((o) => o.id === ctx.twist!.next!.choice) : null;
  const times = g.twists?.times?.episode === next.number ? g.twists.times.times : chosenTwist && ctx.twist?.next?.episode === next.number ? chosenTwist.times : null;
  const tag = phase === "over" ? "Final" : `${epShort(E)} ${next.number}${times && times !== 1 ? ` ×${times}` : ""}`;
  // The tag says which episode; the title says when it airs.
  const when = phase === "over" ? `Through ${E} ${g.through}` : next.airsAt ? ctx.when(next.airsAt) : `${E} ${next.number} is next`;
  const strip = stripOf(g, page, phase, ctx);
  return {
    phase,
    main: page.main,
    title: { name: g.gameName, show: ctx.show, tag, when, line: ctx.line || `${plural(g.players, "player")}` },
    chips: chipsOf(page, ctx.line ?? "", g.twists, E),
    strip,
    hero: ((h) => ({ ...h, n: big(h.n) }))(heroOf(g, page, page.main, phase, ctx)),
    inPlace: strip.kind === "twist" ? "twist" : strip.kind === "slots" ? "slots" : strip.kind === "answers" && strip.inPlace ? "questions" : null,
    couch: couchOf(g, page, ctx),
    previously: previouslyOf(g, page, phase, ctx),
    rules: g.rules,
  };
}

/**
 * Every place a page can have, and where its drawing reads from: "view", the game as you may see it (game-view.ts, the questions'
 * own read); "spec", the spec alone (a twist's tag, How it plays) until the view carries its state. tests/game-page.test.js fails on a
 * place missing here.
 */
export const DRAWN = new Map<string, "view" | "spec">([
  ...(["together", "race", "matchup", "categories", "worth", "week", "board", "card", "objectives", "team", "picks", "ladder", "slate", "ballot", "stages", "weeklyCard"] as const).map((k) => [`main:${k}`, "view"] as [string, "view"]),
  ...(["draft", "pick", "lineup", "questions", "tick", "waivers", "squares"] as const).map((k) => [`move:${k}`, "view"] as [string, "view"]),
  // The draft room's (your-move.ts: a blind draft's, an auction's), a pool's mulligans and buying back (the strip, the hero), the twist.
  ...(["blind", "auction", "mulligan", "buyback", "twist"] as const).map((k) => [`move:${k}`, "view"] as [string, "view"]),
  ...(["keepers", "captain", "second", "spread", "teams", "host", "vote", "change"] as const).map((k) => [`move:${k}`, "spec"] as [string, "spec"]),
  ...(["person", "group", "yesNo", "number", "overUnder", "choice", "calls", "order", "confidence", "chips", "split", "pairs", "side", "bracket", "trivia", "ticket", "section", "eachGame", "eachPerson", "fromTeam", "filter"] as const).map((k) => [`control:${k}`, "view"] as [string, "view"]),
  ...(["stake", "double", "share", "beat", "rollover", "shrink", "majority", "rank", "legs"] as const).map((k) => [`rider:${k}`, "view"] as [string, "view"]),
  ...(["saves", "captain", "bounty", "role", "group"] as const).map((k) => [`badge:${k}`, "view"] as [string, "view"]),
  ...(["times", "counted", "used", "taken"] as const).map((k) => [`badge:${k}`, "spec"] as [string, "spec"]),
  ...(["times", "bounty", "roles", "cut", "twist"] as const).map((k) => [`event:${k}`, "view"] as [string, "view"]),
  ...(["draw", "change", "rollover", "redraft", "teams"] as const).map((k) => [`event:${k}`, "spec"] as [string, "spec"]),
  ...(["points", "streak", "stillIn", "worth", "shared", "wl", "weeks", "roto", "overall", "teams", "handicap"] as const).map((k) => [`table:${k}`, "view"] as [string, "view"]),
  // A bank is your points (AnswerLogic grades it as everyone's opening line); a budget, a cap's room or a market's cash; the cut's line.
  ...(["bank", "budget", "cut", "reverse"] as const).map((k) => [`table:${k}`, "view"] as [string, "view"]),
  ...(["start", "finale", "daily", "weekly", "game", "late"] as const).map((k) => [`lock:${k}`, "view"] as [string, "view"]),
]);

// ---------- a made-up game, for the census: every spec's page drawn at each phase ----------

/** A spec's page model against a made-up couch of five and a cast of twelve, at a phase (tests/game-page.test.js). */
export function sampleModel(page: GamePage, o: { phase: Phase; sport?: string | null }): PageModel {
  const cast: CastFace[] = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: `Cast ${i}`, photo: null, tribe: i % 2 ? { name: "Two", colour: "#5089c9" } : null, left: i > 9, knocked: i > 9, out: i > 9 ? 4 : null, place: null, points: 12 - i }));
  const names = ["Joanna", "You", "Andrew", "Sam", "Mia"];
  const through = o.phase === "before" ? 0 : 5;
  const table: TableRow[] = names.map((name, i) => ({
    playerId: `p${i}`, userId: null, name, you: name === "You", rank: String(i + 1), place: i + 1, total: 60 - i * 7, week: 6 - i, points: 60 - i * 7, team: ["c0", "c1", "c2", "c10"], last: ["c0"],
    picks: [{ episode: 4, castawayId: "c3", correct: true }, { episode: 5, castawayId: "c4", correct: i !== 2 }], bot: false, calls: 3,
    record: page.rank === "matchups" ? { wins: 4 - i, losses: i, ties: 0, for: 200, against: 180, seed: null, alive: true, champion: false } : null,
    side: null, handicap: has(page, "table", "handicap") && i === 3 ? 6 : null, weeks: [{ episode: 5, total: 9, predictions: 0, started: [{ id: "c0", points: 4, why: [] }], bench: [] }],
  }));
  const g = {
    leagueId: "L", name: "Couch", gameType: "made", gameName: "A game", yourRole: "player", playerId: "p1",
    through, from: 1, phase: null, to: null, over: o.phase === "over", table, you: table[1], players: 5, rules: ["A rule."], cast,
    lineup: page.main === "team" ? { epId: "e6", episode: 6, airsAt: null, locked: false, slots: 3, need: 3, starters: ["c0"], roster: ["c0", "c1", "c2"], set: false, carried: false } : null,
    pick: page.main === "ladder" ? { epId: "e6", episode: 6, airsAt: null, open: true, pick: null, available: ["c5"], blocked: [], streak: 5 } : null,
    call: null, bingo: page.main === "card" ? { episode: 6, airsAt: null, open: true, ticked: 3, lines: 1 } : null, linePoints: null,
    sheet: page.questions.length ? { episode: 6, of: page.questions.length, answered: 0, closesAt: null, behind: null, finale: false } : null,
    predictions: [], progress: null, revealFirst: null, catchingUp: false, catchUp: null, pace: null,
    coop: page.main === "together" ? { lives: 3, of: 4, lost: [{ episode: 4, question: "Who goes home?" }], result: null } : null,
    matchups: page.main === "matchup" ? { side: null, record: { wins: 3, losses: 1, ties: 0, for: 200, against: 180 }, next: null, last: { episode: 5, round: null, opponent: "p0", stand: null, points: 18, against: 14, result: "win" }, playoffs: null } : null,
    teams: null, handicap: null, weeksWon: page.rank === "weeks" ? { p0: 3, p1: 2, p2: 1, p3: 0, p4: 0 } : null,
    twists: {
      captain: has(page, "badge", "captain") ? { episode: 6, castawayId: "c1", times: page.facts.captainTimes ?? 2 } : null,
      pool: has(page, "badge", "saves") && page.main === "ladder" ? { lives: 2, livesOf: page.facts.lives, mulligans: page.facts.mulligans ? 1 : null, mulligansOf: page.facts.mulligans ?? 0, out: null, buyBack: false } : null,
      slots: has(page, "badge", "group") ? [{ slot: 0, status: "held", group: "Two", members: ["c1", "c3"] }] : null,
      cut: page.facts.cut ? { after: 6, phase: null, out: page.facts.cut.out ?? 1 } : null,
      out: page.facts.cut ? ["p4"] : [],
      times: has(page, "event", "times") ? { episode: 8, times: 2 } : null,
      bounty: has(page, "badge", "bounty") ? { p0: 4, p1: -2 } : null,
      budget: has(page, "table", "budget") ? { p0: 12, p1: 30 } : null,
    },
  } as unknown as GameView;
  return pageModel(g, page, { show: "Survivor 51", words: o.sport ? { episode: "Week", episodes: "Weeks" } : { episode: "Episode", episodes: "Episodes" }, next: { number: 6, airsAt: "2026-11-11T01:00:00Z" }, when: () => "Wed 8:00 PM", move: null, line: "All season · Pick 1 to stay in" });
}

export { compileGame };
