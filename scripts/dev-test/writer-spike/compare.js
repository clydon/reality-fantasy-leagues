// The writer spike's yardstick: how close a reader's game is to the expected one, at the engine's level. Three matches:
//
//   lenient  the same VOCAB values (gallery-coverage.js facetsAll: what you do, what scores, how you win, how each question is
//            asked, answered and settled, its bets) and the same shape (which optional parts exist: a budget, lives, a captain, a
//            race, a cut, teams, a bank, a parlay, a stake, a rollover, a card, a beat-the-bot, how many questions up to 4).
//            Ignores every number, which moments, question wording and ids, the span, and a setting written out at its schema
//            default where the other game leaves it out (DEFAULTS below).
//   said     lenient, and every number the request's own words state that the expected game carries sits in the same slot of the
//            reader's game ("draft 3" means get.each 3, not just a 3 somewhere).
//   strict   lenient, and every number (points, sizes, lives, targets, stakes, multipliers) and every question's moment equal.
//
// facet F1 is over the VOCAB values and the shape tokens together. nearestBases is the coverage table's distance (pathFor's: a
// kind value 10, any other value 1, a shape part 2): the gallery squares nearest a game; "right base" is a shared nearest square.
//
// Needs: the repo only. CommonJS.
//   const K = require("./compare.js");  K.compare(produced, expected, saidNumbers)  K.nearestBases(spec)  K.facetsAll(spec)
//
// Reimplemented here because gallery-coverage.js doesn't export them: shapeOf (its own, copied) and pathFor's distance.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, like the catalog (src/lib/game/start-gallery) */
const path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..");
const C = require(path.join(ROOT, "src", "lib", "game", "start-gallery", "index.js"));
const S = require(path.join(ROOT, "src", "lib", "game", "game-spec", "schema.js"));
const G = require(path.join(ROOT, "scripts", "dev-test", "gallery-coverage.js"));

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** A spec's shape beyond its VOCAB values (gallery-coverage.js shapeOf, copied: it isn't exported). */
function shapeOf(spec) {
  const out = new Set();
  const walk = (s) => {
    if (!isObj(s)) return;
    const x = s.preset ? C.expand(s) : s;
    if (Array.isArray(x.stages)) {
      out.add(`stages:${x.stages.length}`);
      x.stages.forEach((st) => isObj(st) && walk(st.game));
      return;
    }
    const g = isObj(x.get) ? x.get : {};
    const sc = isObj(x.score) ? x.score : {};
    const r = isObj(x.rank) ? x.rank : {};
    for (const k of ["budget", "keep", "groups", "across", "second"]) if (g[k] !== undefined) out.add(`get.${k}`);
    if (isObj(g.budget) && isObj(g.budget.trade)) out.add("get.trade");
    for (const k of ["lives", "mulligans", "buyback", "bank", "parlays", "captain", "times", "reverse", "bounty", "roles", "twist", "only", "multiply"]) if (sc[k] !== undefined && sc[k] !== false) out.add(`score.${k}`);
    for (const k of ["race", "cut", "playoffs", "teams", "handicap"]) if (r[k] !== undefined) out.add(`rank.${k}`);
    if (isObj(x.card)) out.add("card");
    if (isObj(x.extras) && isObj(x.extras.seats)) out.add("seats");
    for (const q of Array.isArray(x.ask) ? x.ask : []) {
      if (!isObj(q)) continue;
      if (q.wager !== undefined) out.add(q.wager === "total" ? "wager:total" : "wager");
      if (q.rollover) out.add("rollover");
      if (q.shrink) out.add("shrink");
      if (q.beat) out.add("beat");
      if (q.card) out.add("ask.card");
    }
    const n = (Array.isArray(x.ask) ? x.ask : []).length;
    if (n) out.add(`asks:${Math.min(n, 4)}`);
  };
  walk(spec);
  return out;
}

const safeFacets = (s) => {
  try {
    return G.facetsAll(s);
  } catch {
    return new Set();
  }
};
/** The tokens F1 is taken over: the VOCAB values and the shape parts. */
const tokensOf = (s) => new Set([...safeFacets(s), ...[...shapeOf(s)].map((x) => `shape:${x}`)]);

/** Every number a game holds, by its slot ("get.each": 3, "ask[person|results:out|].points": 2), and each question's moment. */
function numbersOf(spec, prefix = "", out = new Map()) {
  if (!isObj(spec)) return out;
  const s = spec.preset ? C.expand(spec) : spec;
  const put = (k, v) => {
    if (isNum(v) || (typeof v === "string" && v)) out.set(prefix + k, v);
  };
  if (Array.isArray(s.stages)) {
    s.stages.forEach((st, i) => isObj(st) && numbersOf(st.game, `${prefix}stage${i}.`, out));
    return out;
  }
  const g = isObj(s.get) ? s.get : {};
  const sc = isObj(s.score) ? s.score : {};
  const r = isObj(s.rank) ? s.rank : {};
  put("get.each", g.each);
  if (isObj(s.count)) {
    put("count.start", s.count.start);
    put("count.best", s.count.best);
  }
  if (isObj(g.budget)) put("get.budget.total", g.budget.total);
  if (isObj(g.keep)) put("get.keep.each", g.keep.each);
  if (isObj(g.groups)) put("get.groups.slots", g.groups.slots);
  put("score.points", isNum(sc.points) ? sc.points : undefined);
  put("score.lives", sc.lives);
  put("score.mulligans", sc.mulligans);
  if (isObj(sc.buyback)) put("score.buyback.times", sc.buyback.times);
  if (isObj(sc.captain)) put("score.captain.times", sc.captain.times);
  if (isObj(sc.bank)) put("score.bank.start", sc.bank.start);
  if (isObj(sc.bounty)) put("score.bounty.points", sc.bounty.points);
  if (isObj(sc.roles)) {
    put("score.roles.count", sc.roles.count);
    put("score.roles.points", sc.roles.points);
  }
  (Array.isArray(sc.parlays) ? sc.parlays : []).forEach((p, i) => isObj(p) && put(`score.parlays${i}.times`, p.times));
  (Array.isArray(sc.times) ? sc.times : []).forEach((t, i) => isObj(t) && put(`score.times${i}.times`, t.times));
  (Array.isArray(sc.multiply) ? sc.multiply : []).forEach((m, i) => isObj(m) && (Array.isArray(m.times) ? m.times : [m.times]).forEach((t, j) => put(`score.multiply${i}.times${j}`, t)));
  if (Array.isArray(sc.only)) put("score.only", [...sc.only].sort().join(","));
  put("rank.race.to", isObj(r.race) ? r.race.to : undefined);
  if (isObj(r.teams)) put("rank.teams.of", r.teams.of);
  if (isObj(r.playoffs)) put("rank.playoffs.teams", r.playoffs.teams);
  if (isObj(r.handicap)) put("rank.handicap.points", r.handicap.points);
  (Array.isArray(r.cut) ? r.cut : []).forEach((c, i) => {
    if (!isObj(c)) return;
    put(`rank.cut${i}.out`, c.out);
    if (isObj(c.at)) for (const [k, v] of Object.entries(c.at)) put(`rank.cut${i}.at.${k}`, isObj(v) ? JSON.stringify(v) : v);
  });
  if (isObj(s.card)) put("card.each", s.card.each);
  if (isObj(s.extras) && isObj(s.extras.seats)) put("extras.seats.people", s.extras.seats.people);
  if (isObj(s.extras) && isObj(s.extras.bets)) put("extras.bets.points", s.extras.bets.points);
  // Questions by their signature (ids and wording differ between a hand-written game and the menu's), in order within one.
  const seen = new Map();
  for (const q of Array.isArray(s.ask) ? s.ask : []) {
    if (!isObj(q)) continue;
    const sig = `${q.answer}|${(q.settle && q.settle.by) || ""}:${(q.settle && q.settle.take) || ""}`;
    const n = (seen.get(sig) || 0) + 1;
    seen.set(sig, n);
    const k = `ask[${sig}${n > 1 ? `#${n}` : ""}].`;
    for (const f of ["points", "pick", "wager", "chips", "pairs", "line", "over", "every", "within"]) put(k + f, q[f]);
    if (isObj(q.shrink)) put(`${k}shrink.points`, q.shrink.points);
    if (q.settle && q.settle.moment) put(`${k}moment`, q.settle.moment);
  }
  return out;
}

/** A setting written out at its default is the same game as one left to it (the catalog writes a handicap's "new to the couch"
 *  out; a hand-written spec leaves it): a value at its schema default on one side, with nothing for that setting on the other,
 *  is dropped from both before comparing. */
const DEFAULTS = {
  "rank.handicap.newTo": S.HANDICAP.newTo, "rank.handicap.who": S.HANDICAP.who, "rank.teams.made": S.TEAMS.made, "rank.teams.score": S.TEAMS.score,
  "rank.teams.unplaced": S.TEAMS.unplaced, "score.roles.on": S.ROLES.on, "score.roles.deal": S.ROLES.deal, "score.roles.reveal": S.ROLES.reveal,
  "score.twist.who": S.TWIST.who, "score.twist.by": S.TWIST.by, "rank.cut.tie": S.CUT.tie, "rank.cut.quiet": S.CUT.quiet, "rank.odd": S.MATCHUPS.odd,
  "rank.quiet": S.MATCHUPS.quiet, "rank.ties": S.WEEKS.ties, "get.second.fallback": S.SECOND_PICK.fallback, "get.fallback": S.NEVER.fallback,
  "ask.beat.none": S.BEAT.none, "ask.odds": S.ODDS, "get.budget.fallback": S.AUCTION.fallback, "get.budget.gone": S.CAP.gone, "get.budget.left": S.MARKET_LEFT,
  "get.groups.own": S.GROUP_SLOTS.own, "get.groups.fallback": S.GROUP_SLOTS.fallback, "get.groups.points": S.GROUP_SLOTS.points, "get.keep.fallback": S.KEEP.fallback,
  "card.fallback": S.CARD.fallback, "extras.changes.ok": S.CHANGES.ok, "extras.changes.unanswered": S.CHANGES.unanswered, "score.saves": S.COOP.saves,
  "ask.settle.tie": S.PLAYERS.tie, "score.multiply.per": S.JOINED.per, "score.multiply.then": S.JOINED.then, "score.bounty.on": S.BOUNTY.on, "get.across.then": S.DRAFT_ACROSS.then,
};
function dropDefaults(a, b) {
  const keys = (set) => new Set([...set].filter((x) => !x.startsWith("shape:")).map((x) => x.split("=")[0]));
  const ka = keys(a);
  const kb = keys(b);
  const dropped = [];
  for (const [set, other] of [[a, kb], [b, ka]]) {
    for (const x of [...set]) {
      if (x.startsWith("shape:")) continue;
      const [k, v] = [x.split("=")[0], x.split("=").slice(1).join("=")];
      if (k in DEFAULTS && String(DEFAULTS[k]) === v && !other.has(k)) {
        set.delete(x);
        dropped.push(x);
      }
    }
  }
  return dropped;
}

/** How close a reader's game is to the expected one: lenient, said (numbers the words state), strict, F1, and what differs. */
function compare(produced, expected, said = []) {
  if (!produced || !expected) return { lenient: false, said: false, strict: false, f1: 0, missing: [], extra: [], numbers: [] };
  const a = tokensOf(produced);
  const b = tokensOf(expected);
  const defaults = dropDefaults(a, b);
  const missing = [...b].filter((x) => !a.has(x));
  const extra = [...a].filter((x) => !b.has(x));
  const tp = [...a].filter((x) => b.has(x)).length;
  const f1 = a.size + b.size ? (2 * tp) / (a.size + b.size) : 1;
  const lenient = !missing.length && !extra.length;
  const na = numbersOf(produced);
  const nb = numbersOf(expected);
  const numbers = [];
  for (const k of new Set([...na.keys(), ...nb.keys()])) if (String(na.get(k)) !== String(nb.get(k))) numbers.push(`${k}: ${na.has(k) ? na.get(k) : "-"} vs ${nb.has(k) ? nb.get(k) : "-"}`);
  const saidSet = new Set(said.map(Number));
  const saidMiss = [...nb.entries()].filter(([, v]) => isNum(v) && saidSet.has(v)).filter(([k, v]) => na.get(k) !== v).map(([k, v]) => `${k}=${v}`);
  return { lenient, said: lenient && !saidMiss.length, strict: lenient && !numbers.length, f1, missing, extra, numbers, saidMiss, defaults };
}

// ---------- the nearest gallery squares (the coverage table's pathFor distance) ----------

const KIND_KEYS = new Set(["get.by", "score.by", "count"]);
let BASE_FACETS = null;
function baseFacets() {
  if (BASE_FACETS) return BASE_FACETS;
  BASE_FACETS = C.BASES.filter((b) => b.spec).map((b) => {
    const spec = C.baseSpec(b, { from: 1, to: null });
    return { id: b.id, f: safeFacets(spec), shape: shapeOf(spec) };
  });
  return BASE_FACETS;
}
/** The bases nearest a game (every one at the least distance). */
function nearestBases(spec) {
  if (!spec) return new Set();
  const want = safeFacets(spec);
  const shape = shapeOf(spec);
  let best = Infinity;
  const at = [];
  for (const x of baseFacets()) {
    let d = 0;
    for (const v of want) if (!x.f.has(v)) d += KIND_KEYS.has(v.split("=")[0]) ? 10 : 1;
    for (const v of x.f) if (!want.has(v)) d += KIND_KEYS.has(v.split("=")[0]) ? 10 : 1;
    for (const v of shape) if (!x.shape.has(v)) d += 2;
    for (const v of x.shape) if (!shape.has(v)) d += 2;
    at.push([x.id, d]);
    best = Math.min(best, d);
  }
  return new Set(at.filter(([, d]) => d === best).map(([id]) => id));
}

module.exports = { compare, nearestBases, shapeOf, numbersOf, tokensOf, facetsAll: safeFacets };
