import { VOCAB } from "../game-spec/index.js";
import { GRAMMAR, mainOf, type MainBlock, type PlaceKind } from "./grammar";

// A game's spec, compiled to its page (ported from the U0 mocks' compile.js and dials.js): the one code path every generated page
// takes. Reads the spec through the grammar (grammar.ts): every dial value it uses, and every piece the vocabulary leaves to numbers
// (lives, a captain's times, a bank, a race's target, a game in stages), becomes a place on the page: the main block, the moves, each
// question's control with its riders and lock, the badges, the events and the table. The page (src/new/show/game-page.tsx) draws
// the places; tests/game-page.test.js compiles every spec we have and fails on a hole, or on a place nothing draws (DRAWN).
// Deterministic and pure: nothing composes a page with AI when someone opens it. The model carries what the page needs, not the
// spec itself.

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** A spec's dials as "dial=value" over the engine's vocabulary: a leaf whose path is a dial and whose value is one of its words, or
 *  an object at a dial's path whose keys are its words (score.times' { finale }). Questions read as ask.*; a stage's game as its
 *  own top level. `paths`: every leaf path, to find shapes the vocabulary misses. */
export function dialsOf(spec: unknown): { hits: string[]; paths: string[] } {
  const V = VOCAB as Record<string, Record<string, unknown>>;
  const hits = new Set<string>();
  const paths = new Set<string>();
  const walk = (x: unknown, p: string) => {
    if (Array.isArray(x)) return x.forEach((y) => walk(y, p));
    if (isObj(x)) {
      if (V[p]) for (const k of Object.keys(x)) if (V[p][k]) hits.add(`${p}=${k}`);
      for (const [k, v] of Object.entries(x)) walk(v, (p ? `${p}.${k}` : k).replace(/^(stages\.)+/, ""));
      return;
    }
    paths.add(p);
    if (V[p] && typeof x === "string" && V[p][x]) hits.add(`${p}=${x}`);
    if (V[p] && x === true) hits.add(`${p}=true`);
  };
  walk(spec, "");
  return { hits: [...hits], paths: [...paths] };
}

/** A rider under a question's control: its kind, and what it's set to (a stake's odds, a share's kind, a shrink's per). */
export type Rider = { kind: "stake" | "double" | "share" | "beat" | "rollover" | "shrink" | "majority" | "rank" | "legs"; value: string | null };

export interface PageQuestion {
  id: string;
  ask: string;
  points: number | null;
  /** How it's answered: one of the sixteen controls (schema.js's answer kinds). */
  control: string;
  pick: number;
  riders: Rider[];
  /** Asked of each person still in, or of each game of the week; from your team; the pool filtered (a sport's positions). */
  mods: ("eachGame" | "eachPerson" | "fromTeam" | "filter")[];
  lock: string;
  /** When it's asked: once, each episode, every episode, each stage. */
  section: string;
  /** The stage it's in, by name, in a game in stages; else null. */
  stage: string | null;
}

export interface PageStage {
  id: string;
  name: string;
  alongside: boolean;
  main: MainBlock;
}

/** The numbers a page's words read from the spec. */
export interface PageFacts {
  /** How many start (a lineup), how many you hold (a team), a race's target, a bank's start, a captain's times. */
  start: number | null;
  each: number | null;
  raceTo: number | null;
  bank: number | null;
  captainTimes: number | null;
  lives: number | null;
  mulligans: number | null;
  /** How a game in stages ranks overall. */
  overallBy: string | null;
  /** When its moves lock (closes): at the start, daily, weekly, each game. */
  closes: string;
  /** The first cut (rank.cut): when, and how many go. */
  cut: { every: number | null; episode: number | null; phase: string | null; out: number | "half" | null } | null;
  /** How many teams of players, and how many the playoffs take. */
  teams: number | null;
  playoffs: number | null;
}

export interface GamePage {
  main: MainBlock;
  /** A game in stages: each, with its own main block; else null. */
  stages: PageStage[] | null;
  questions: PageQuestion[];
  /** Every place the page has, as "kind:id" ("badge:captain", "table:cut"). */
  places: string[];
  /** Dial values with no place: never any (the test fails on one). */
  holes: string[];
  /** How it ranks (total, streak, standing, worth, coop, matchups, weeks, categories, roto; overall for stages) and what you get. */
  rank: string;
  get: string;
  facts: PageFacts;
}

const asks = (s: Obj): Obj[] => (Array.isArray(s.ask) ? (s.ask as Obj[]).filter(isObj) : []);

function questionOf(q: Obj, spec: Obj, stage: string | null): PageQuestion {
  const riders: Rider[] = [];
  const mods: PageQuestion["mods"] = [];
  const settle = isObj(q.settle) ? q.settle : {};
  const multiply = isObj(q.multiply) ? q.multiply : {};
  if (q.wager || q.odds) riders.push({ kind: "stake", value: q.odds === "pool" ? "pool" : "even" });
  if (q.double) riders.push({ kind: "double", value: null });
  if (q.share) riders.push({ kind: "share", value: String(q.share) });
  if (q.beat) riders.push({ kind: "beat", value: null });
  if (q.rollover) riders.push({ kind: "rollover", value: null });
  if (q.shrink) riders.push({ kind: "shrink", value: isObj(q.shrink) && typeof q.shrink.per === "string" ? q.shrink.per : "episode" });
  if (settle.by === "players") riders.push({ kind: "majority", value: null });
  if (q.answer === "confidence" || multiply.on === "rank") riders.push({ kind: "rank", value: null });
  if (q.answer === "ticket") riders.push({ kind: "legs", value: null });
  if (q.each) mods.push(q.each === "game" ? "eachGame" : "eachPerson");
  if (q.from === "team") mods.push("fromTeam");
  const pool = isObj(spec.pool) ? spec.pool : {};
  if (pool.where && pool.where !== "stillIn") mods.push("filter");
  return {
    id: String(q.id ?? ""),
    ask: typeof q.ask === "string" ? q.ask : "",
    points: num(q.points),
    control: String(q.answer ?? "choice"),
    pick: num(q.pick) ?? 1,
    riders,
    mods,
    lock: String(q.closes ?? spec.closes ?? "start"),
    section: String(q.asked ?? "once"),
    stage,
  };
}

/** A spec, compiled to its page. */
export function compileGame(spec: Obj): GamePage {
  const places: string[] = [];
  const holes: string[] = [];
  const put = (kind: PlaceKind | "hole", id: string) => {
    const k = `${kind}:${id}`;
    if (kind === "hole") {
      if (!holes.includes(id)) holes.push(id);
    } else if (!places.includes(k)) places.push(k);
  };
  const stageList = Array.isArray(spec.stages) ? (spec.stages as Obj[]).filter(isObj) : null;
  const stages = stageList?.length ? stageList.map((st, i) => ({ id: String(st.id ?? i + 1), name: String(st.name ?? st.id ?? `Stage ${i + 1}`), alongside: !!st.alongside, game: (isObj(st.game) ? st.game : st) as Obj })) : null;
  const games = stages ? stages.map((s) => s.game) : [spec];
  // The vocabulary's places.
  for (const g of stages ? [spec, ...games] : [spec])
    for (const h of dialsOf(g).hits) {
      const [dial, v] = h.split("=");
      const ps = GRAMMAR[dial]?.[v];
      if (!ps) put("hole", h);
      else for (const [kind, id] of ps) if (kind !== "line" && id) put(kind, id);
    }
  // The pieces the vocabulary leaves to numbers and objects.
  for (const g of games) {
    const sc = isObj(g.score) ? g.score : {};
    const rk = isObj(g.rank) ? g.rank : {};
    const gt = isObj(g.get) ? g.get : {};
    const ex = isObj(g.extras) ? g.extras : {};
    if (sc.lives) put("badge", "saves");
    if (sc.mulligans) {
      put("badge", "saves");
      put("move", "mulligan");
    }
    if (sc.buyback) put("move", "buyback");
    if (sc.captain) {
      put("badge", "captain");
      put("move", "captain");
    }
    if (sc.bounty) {
      put("badge", "bounty");
      put("event", "bounty");
    }
    if (sc.roles) {
      put("badge", "role");
      put("event", "roles");
    }
    if (sc.twist) {
      put("move", "twist");
      put("event", "twist");
    }
    if (sc.times) put("event", "times");
    if (sc.multiply) put("badge", "times");
    if (sc.bank) {
      put("rider", "stake");
      put("table", "bank");
    }
    if (sc.parlays) put("rider", "legs");
    if (sc.reverse) put("table", "reverse");
    if (sc.categories) put("main", "categories");
    if (rk.race) put("main", "race");
    if (rk.cut) {
      put("table", "cut");
      put("event", "cut");
    }
    if (rk.teams) put("table", "teams");
    if (rk.handicap) put("table", "handicap");
    if (gt.across) put("move", "spread");
    if (gt.budget) {
      put("move", "auction");
      put("table", "budget");
    }
    if (gt.groups) put("badge", "group");
    if (gt.second) put("move", "second");
    if (gt.keep) put("move", "keepers");
    if (ex.waivers) put("move", "waivers");
    if (ex.lateLock) put("lock", "late");
    if (g.card && (gt.by === "pick" || gt.by === "draft")) put("main", "weeklyCard");
  }
  // The questions, each with its control, riders, lock and section.
  const questions: PageQuestion[] = [];
  games.forEach((g, i) => {
    for (const q of asks(g)) {
      const qq = questionOf(q, g, stages ? stages[i].name : null);
      questions.push(qq);
      put("control", qq.control);
      for (const r of qq.riders) put("rider", r.kind);
      for (const m of qq.mods) put("control", m);
      put("lock", qq.lock);
    }
  });
  if (questions.length) put("move", "questions");
  // A blind draft or an auction is the draft: its room by the order.
  if ((places.includes("move:blind") || places.includes("move:auction")) && places.includes("move:draft")) places.splice(places.indexOf("move:draft"), 1);
  const main: MainBlock = stages ? "stages" : mainOf(spec);
  put("main", main);
  const stageMains = stages ? stages.map((s) => ({ id: s.id, name: s.name, alongside: s.alongside, main: mainOf(s.game) })) : null;
  for (const s of stageMains ?? []) put("main", s.main);
  const sc = isObj(spec.score) ? spec.score : {};
  const rk = isObj(spec.rank) ? spec.rank : {};
  const gt = isObj(spec.get) ? spec.get : {};
  const count = isObj(spec.count) ? spec.count : {};
  const bank = isObj(sc.bank) ? num(sc.bank.start) : null;
  const captain = isObj(sc.captain) ? num(sc.captain.times) : sc.captain ? 2 : null;
  const race = isObj(rk.race) ? num(rk.race.to) : null;
  const cut0 = Array.isArray(rk.cut) && isObj(rk.cut[0]) ? (rk.cut[0] as Obj) : null;
  const at = cut0 && isObj(cut0.at) ? cut0.at : {};
  return {
    main,
    stages: stageMains,
    questions,
    places,
    holes,
    rank: typeof rk.by === "string" ? rk.by : isObj(spec.overall) ? "overall" : "total",
    get: typeof gt.by === "string" ? gt.by : "none",
    facts: {
      start: num(count.start),
      each: num(gt.each),
      raceTo: race,
      bank,
      captainTimes: captain,
      lives: num(sc.lives),
      mulligans: num(sc.mulligans),
      overallBy: isObj(spec.overall) && typeof spec.overall.by === "string" ? spec.overall.by : null,
      closes: typeof spec.closes === "string" ? spec.closes : "start",
      cut: cut0 ? { every: num(at.every), episode: num(at.episode), phase: typeof at.phase === "string" ? at.phase : null, out: cut0.out === "half" ? "half" : num(cut0.out) } : null,
      teams: isObj(rk.teams) ? num(rk.teams.of) : null,
      playoffs: isObj(rk.playoffs) ? num(rk.playoffs.teams) : null,
    },
  };
}

/** Whether a page has a place ("badge", "captain"). */
export const has = (p: Pick<GamePage, "places">, kind: PlaceKind, id: string) => p.places.includes(`${kind}:${id}`);

/** The sixteen answer controls (schema.js's answer kinds), each drawn by the page and the questions sheet. */
export const CONTROLS = ["person", "group", "yesNo", "number", "overUnder", "choice", "calls", "order", "confidence", "chips", "split", "pairs", "side", "bracket", "trivia", "ticket"] as const;
