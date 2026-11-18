// Start a game's coverage table (docs/PLAN-start-a-game-redo.md, Round 2's "the coverage table, complete"): every value the engine
// plays (the schema's VOCAB: 71 settings, 215 values), every number it holds to (GAME-PIECES.md "Size limits"), and every request
// the capability tracker holds (296: the dials' values, the examples, the stretch rows and the corpus), each given its path through
// the gallery (src/lib/game/start-gallery): the base it starts from, the row, the change and the control. A value's home is proven,
// not asserted: the change is made on a base the gallery offers and set to that value, and our check (specProblems, specWaitsFor,
// typeOf) has to pass it on Survivor 51's page, else on another show's (the tracker's pages), else a tracker row that plays it is
// named. A tracker request is matched to its nearest base by the values its spec sets, and its path is the changes between them.
// No database, no server, no browser.
//
//   node scripts/dev-test/gallery-coverage.js                     write docs/design-round/wizard-r2-coverage.md
//   node scripts/dev-test/gallery-coverage.js --page=<file>       Survivor 51's page from a captured wizard read (the round's
//                                                                 .impeccable/mocks/wizard-r1/pages/s51.json: Episode 9 next)
//   node scripts/dev-test/gallery-coverage.js --check             exit 1 when a value the engine plays now has no home that plays
//   node scripts/dev-test/gallery-coverage.js --json=<file>       also the rows as JSON (for the story and B1's driving check:
//                                                                 each value's `drive`, the taps that proved it, wizard-coverage.js)
//
// Reusable: B1's check that drives the built wizard to each value reads the same homes (--json). Pure reads of the repo.
const fs = require("fs");
const path = require("path");
const S = require("../../src/lib/game/game-spec/schema.js");
const Cap = require("../../src/lib/game/game-spec/capabilities.js");
const C = require("../../src/lib/game/start-gallery/index.js");
const { statusRows, ctxOf, TRACKER } = require("../engine-capabilities.js");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", "docs/design-round/wizard-r2-coverage.md"));
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();

// ---------- the pages a home is tried on ----------

/** A stand-in for this couch's game on the show's last season (keepers'), as the tracker's keepers row names one. */
const LAST = "<last season's game>";
/** Survivor 51 first (a captured wizard read when given: the real season, Episode 9 next), then a show of each other kind. */
function pages() {
  const out = [];
  const file = opt("page", null);
  if (file) {
    const p = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
    const page = p.wizard ? p.wizard.page : p.page || p;
    out.push({ id: "s51", name: "Survivor 51", pg: C.pageFacts(page, { show: "Survivor 51", lastSeason: LAST }) });
  } else out.push({ id: "s51", name: "Survivor 51", pg: C.pageFacts(ctxOf({ show: "Survivor", season: 51, rulebook: "survivor" }), { show: "Survivor 51", lastSeason: LAST }) });
  for (const [id, name, page] of [
    ["c42", "The Challenge", { show: "The Challenge", season: 40, rulebook: "challenge" }],
    ["t5", "The Traitors", { show: "The Traitors", season: 3, rulebook: "traitors" }],
    ["bd", "Below Deck", { show: "Below Deck", season: 11, rulebook: "belowDeck" }],
  ]) {
    try {
      const ctx = ctxOf(page);
      if (ctx) out.push({ id, name, pg: C.pageFacts(ctx, { show: name, lastSeason: LAST }) });
    } catch {
      /* a page the tracker can't build: skipped */
    }
  }
  return out;
}
const PAGES = pages();
const SPAN = (pg) => ({ from: pg.from, to: null });

// ---------- a spec's values ----------

/** The VOCAB values a spec sets (explicitly, and its preset's): "key=value" strings. */
function facetsOf(spec, out = new Set()) {
  if (!isObj(spec)) return out;
  const add = (k, v) => {
    if (v === undefined || v === null) return;
    if (S.VOCAB[k] && S.VOCAB[k][String(v)] !== undefined) out.add(`${k}=${v}`);
  };
  const s = spec.preset ? C.expand(spec) : spec;
  if (Array.isArray(s.stages)) {
    add("score.by", "stages");
    if (isObj(s.overall)) add("overall.by", s.overall.by);
    for (const st of s.stages) {
      if (isObj(st) && isObj(st.on)) for (const k of Array.isArray(st.on.change) ? st.on.change : st.on.again ? S.ON_CHANGE.change : []) add("on.change", k);
      if (isObj(st) && isObj(st.game)) facetsOf(st.game, out);
    }
    if (isObj(s.extras) && isObj(s.extras.changes)) {
      add("extras.changes.ok", s.extras.changes.ok);
      add("extras.changes.unanswered", s.extras.changes.unanswered);
    }
    return out;
  }
  const g = isObj(s.get) ? s.get : {};
  add("get.by", g.by), add("get.order", g.order), add("get.own", g.own), add("get.repeat", g.repeat), add("get.fallback", g.fallback);
  if (isObj(s.count)) add("count", Object.keys(s.count)[0]);
  const sc = isObj(s.score) ? s.score : {};
  add("score.by", sc.by), add("score.means", sc.means), add("score.hits", sc.hits), add("score.saves", sc.saves);
  if (Array.isArray(sc.times)) {
    add("multiply.on", "when");
    for (const t of sc.times) for (const k of S.WHEN) if (isObj(t) && t[k] !== undefined && t[k] !== false) add("score.times", k);
  }
  if (isObj(sc.captain)) add("multiply.on", "captain");
  if (Array.isArray(sc.multiply)) {
    add("multiply.on", "joined");
    for (const m of sc.multiply) if (isObj(m)) add("score.multiply.joined", m.joined), add("score.multiply.per", m.per), add("score.multiply.then", m.then);
  }
  if (Array.isArray(sc.parlays)) add("multiply.on", "legs");
  if (isObj(sc.bounty)) add("score.bounty.on", sc.bounty.on || S.BOUNTY.on);
  if (isObj(sc.roles)) add("score.roles.on", sc.roles.on || S.ROLES.on), add("score.roles.deal", sc.roles.deal || S.ROLES.deal), add("score.roles.reveal", sc.roles.reveal || S.ROLES.reveal);
  if (isObj(sc.twist)) add("score.twist.who", sc.twist.who || S.TWIST.who), add("score.twist.by", sc.twist.by || S.TWIST.by), add("score.twist.tie", sc.twist.tie);
  const r = isObj(s.rank) ? s.rank : {};
  add("rank.by", r.by), add("rank.ties", r.ties), add("rank.odd", r.odd), add("rank.quiet", r.quiet), add("rank.oneLeft", r.oneLeft), add("rank.allOut", r.allOut);
  if (Array.isArray(r.cut)) for (const c of r.cut) if (isObj(c)) isObj(c.at) && add("rank.cut.at", Object.keys(c.at)[0]), add("rank.cut.tie", c.tie), add("rank.cut.quiet", c.quiet);
  if (isObj(r.teams)) add("rank.teams.made", r.teams.made), add("rank.teams.score", r.teams.score), add("rank.teams.unplaced", r.teams.unplaced);
  if (isObj(r.handicap)) add("rank.handicap.who", r.handicap.who || S.HANDICAP.who), add("rank.handicap.newTo", r.handicap.newTo);
  if (isObj(s.card)) add("card.from", s.card.from), add("card.fallback", s.card.fallback);
  add("closes", s.closes === "start" ? undefined : s.closes);
  if (isObj(s.pool) && isObj(s.pool.where)) for (const k of Object.keys(s.pool.where)) add("pool.where", k);
  if (isObj(g.groups)) add("get.groups.own", g.groups.own), add("get.groups.fallback", g.groups.fallback), add("get.groups.points", g.groups.points);
  if (isObj(g.second)) add("get.second.fallback", g.second.fallback || S.SECOND_PICK.fallback);
  if (isObj(g.across)) add("get.across.of", g.across.of), add("get.across.then", g.across.then);
  if (isObj(g.budget)) add("get.budget.gone", g.budget.gone), add("get.budget.fallback", g.budget.fallback), add("get.budget.left", g.budget.left);
  if (isObj(g.keep)) add("get.keep.cost", g.keep.cost), add("get.keep.fallback", g.keep.fallback);
  const e = isObj(s.extras) ? s.extras : {};
  if (isObj(e.waivers) && isObj(e.waivers.own)) for (const v of Object.values(e.waivers.own)) add("extras.waivers.own", v);
  if (isObj(e.draft)) add("extras.draft.opens", e.draft.opens);
  if (isObj(e.changes)) add("extras.changes.ok", e.changes.ok), add("extras.changes.unanswered", e.changes.unanswered);
  for (const q of Array.isArray(s.ask) ? s.ask : []) {
    if (!isObj(q)) continue;
    add("ask.answer", q.answer), add("ask.asked", q.asked), add("ask.closes", q.closes), add("ask.from", q.from), add("ask.each", q.each), add("ask.share", q.share), add("ask.odds", q.odds), add("ask.fallback", q.fallback);
    if (isObj(q.settle)) add("ask.settle", q.settle.by), add("ask.settle.source", q.settle.source), add("ask.settle.tie", q.settle.tie);
    if (isObj(q.beat)) add("ask.beat.by", q.beat.by), add("ask.beat.none", q.beat.none);
    if (isObj(q.shrink)) add("ask.shrink.per", q.shrink.per);
    if (q.answer === "confidence") add("multiply.on", "rank");
  }
  return out;
}

// ---------- each home, proven on a base ----------

const HOMES = C.homesOf();
const ROWNAME = { who: "Who's playing", compete: "How you win", bets: "Bets", play: "Your team / pick / questions", scoring: "Scoring", twists: "Twists", season: "Over the season", details: "The details", lock: "When moves lock", length: "How long" };
const label = (h) => {
  const c = C.changeById(h.change);
  const k = c && h.control ? (c.controls || []).find((x) => x.id === h.control) : null;
  const q = h.change === "addq" ? [...C.QUESTION_KINDS].find((x) => x.id === h.control) || C.QUESTION_CONTROLS.find((x) => x.id === h.control) : null;
  const opt = k && k.options ? k.options.find((o) => String(o[0]) === String(h.value)) : q && q.options ? q.options.find((o) => String(o[0]) === String(h.value)) : null;
  return [c ? rowName(c) : ROWNAME[h.row] || h.row, c ? c.name : h.change, k ? k.label : q ? q.name || q.label : null, opt ? `“${opt[1]}”` : null].filter(Boolean).join(" › ");
};

/** A question of a kind, on the page: its moment the season's first that research answers. */
function questionOf(kind, pg) {
  const q = { id: `q-${kind.id}`, ask: kind.name, answer: kind.answer, points: kind.points, asked: kind.asked, settle: clone(kind.settle) };
  if (kind.closes) q.closes = kind.closes;
  if (kind.moment) q.settle.moment = (kind.moment === "group" ? pg.moments.find((m) => /tribe|team/i.test(`${m.id} ${m.label || ""}`)) || pg.moments[0] || {} : pg.moments[0] || {}).id;
  if (kind.pick) q.pick = kind.pick;
  if (kind.within !== undefined) q.within = kind.within;
  if (kind.chips) q.chips = kind.chips;
  if (kind.pairs) q.pairs = kind.pairs;
  if (kind.line) q.line = kind.line;
  if (kind.options) q.options = clone(kind.options);
  if (kind.id === "role") q.settle.role = "Traitor";
  if (kind.id === "phase") q.settle.phase = (pg.later[0] || {}).id;
  return q;
}

/** A spec's values, its defaults filled in too (fullSpec writes what a spec leaves out: a stage's draft opening at its start). */
function facetsAll(s) {
  const out = facetsOf(s);
  try {
    facetsOf(S.fullSpec(s), out);
  } catch {
    /* a spec fullSpec can't fill: its own values only */
  }
  return out;
}
const QGAME = (ask, span) => ({ get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, span, ask });
/** A question home tried as a game of questions of its own on each page (the kind, or a kind its control goes with). */
function proveQuestion(h) {
  const kind = C.QUESTION_KINDS.find((k) => k.id === h.control);
  const k = kind ? null : C.QUESTION_CONTROLS.find((x) => x.id === h.control);
  const opt = k && k.options ? k.options.find((o) => String(o[0]) === String(h.value)) : null;
  let last = null;
  for (const P of PAGES) {
    const pg = P.pg;
    const span = { from: pg.from, to: null };
    const tries = [];
    if (kind) tries.push(QGAME([questionOf(kind, pg)], span));
    else {
      const base = (id) => questionOf(C.QUESTION_KINDS.find((x) => x.id === id), pg);
      const v = opt ? opt[0] : h.value;
      if (h.control === "from" && v === "team") {
        const draft = C.baseSpec(C.baseById("outlast"), span, pg);
        tries.push({ ...draft, ask: [{ ...base("who"), from: "team", asked: "each" }] });
      } else if (h.control === "fallback") {
        const g = { ...base("group"), fallback: v };
        if (v === "next-stage") tries.push({ stages: [{ id: "pairs", name: "In pairs", game: QGAME([g], { from: pg.from }) }, { id: "after", name: "After", game: QGAME([base("out")]) }], overall: { by: "points" } });
        else tries.push(QGAME([g], span));
      } else if (h.control === "each") tries.push(QGAME([{ ...base("happens"), each: v, settle: { by: "results", take: "out" } }], span));
      else if (h.control === "closes" && v === "finale") tries.push(QGAME([{ ...base("winner"), closes: "finale", asked: "once" }], span));
      else for (const id of ["out", "who", "happens", "winner"]) tries.push(QGAME([k.write(base(id), v)], span));
    }
    for (const s of tries) {
      const r = C.check(s, pg);
      const has = facetsAll(s).has(`${h.key}=${h.value}`);
      if (r.ok && has) return { ok: true, base: "sheet", page: P.id, single: true };
      last = { why: r.problems[0] || r.waits[0] || (has ? "no type" : "the value didn't land"), base: "sheet", page: P.id };
    }
  }
  return { ok: false, ...last };
}

const TRACKER_ROWS = (() => {
  const tracker = JSON.parse(fs.readFileSync(TRACKER, "utf8"));
  return statusRows(tracker).filter((x) => x.st.state === "yes" && x.row.spec).map((x) => ({ id: x.row.id, page: x.row.page, f: facetsAll(x.row.spec) }));
})();
const SPORT_ROWS = fs.readdirSync(path.join(__dirname, "..", "..", "src", "lib", "sports", "defaults")).filter((f) => f.endsWith(".json")).flatMap((f) => {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "lib", "sports", "defaults", f), "utf8"));
  return Object.entries(d.specs || {}).map(([id, w]) => ({ id: `${d.sport || f.replace(".json", "")}'s ${id}`, page: { sport: d.sport || f.replace(".json", "") }, f: facetsAll((w && w.spec) || w) }));
});
/** A tracker row our check plays that sets the value, or a sport's own game (its defaults): the engine plays it there. */
const trackerWitness = (k) => TRACKER_ROWS.find((r) => r.f.has(k)) || SPORT_ROWS.find((r) => r.f.has(k)) || null;

/** Try one home on every page's bases until our check passes it: { ok, base, page, why }. */
function prove(h) {
  if (h.change === "addq") {
    const q = proveQuestion(h);
    if (q.ok) return q;
    const t = trackerWitness(`${h.key}=${h.value}`);
    return t ? { ok: true, tracker: t.id, page: t.page } : q;
  }
  const c = C.changeById(h.change);
  if (c && c.coming) return { ok: false, coming: c.coming };
  let last = null;
  for (const P of PAGES) {
    const pg = P.pg;
    for (const b of C.BASES) {
      if (!b.spec) continue;
      let spec;
      try {
        spec = C.baseSpec(b, b.len === "1 episode" ? { from: pg.from, to: pg.from } : SPAN(pg), pg);
      } catch {
        continue;
      }
      if (!spec) continue;
      let s = spec;
      if (h.change === "addq") {
        if (C.kindOf(spec) !== "questions" || Array.isArray(spec.stages)) continue;
        const kind = C.QUESTION_KINDS.find((k) => k.id === h.control);
        if (kind) s = { ...spec, ask: [...(spec.ask || []).slice(0, 2), questionOf(kind, pg)] };
        else {
          const k = C.QUESTION_CONTROLS.find((x) => x.id === h.control);
          const opt = k.options.find((o) => String(o[0]) === String(h.value));
          const qs = (spec.ask || []).map((q, i) => (i === 0 ? k.write(q, opt ? opt[0] : h.value) : q));
          s = { ...spec, ask: qs };
          if (h.control === "closes" && String(h.value) === "finale") s.ask = s.ask.map((q, i) => (i === 0 ? { ...q, asked: "once" } : q));
          if (h.control === "each" && String(h.value) === "person") s.ask = s.ask.map((q, i) => (i === 0 ? { ...q, each: "person", answer: "yesNo", settle: { by: "results", take: "out" } } : q));
        }
      } else if (c) {
        if (c.kinds && !c.kinds.includes(C.kindOf(spec))) continue;
        const st = C.changeStates(spec, c.row, pg).find((x) => x.id === c.id);
        if (!st || (st.why && !st.on)) {
          last = last || { why: st && st.why, base: b.id, page: P.id };
          continue;
        }
        if (!st.on && c.apply) s = C.applyChange(spec, c.id, pg);
        if (h.control) {
          const k = (c.controls || []).find((x) => x.id === h.control);
          const opt = k && k.options ? k.options.find((o) => String(o[0]) === String(h.value)) : null;
          s = C.setControl(s, c.id, h.control, opt ? opt[0] : h.value, pg);
        }
      }
      if (String(h.value) === "next-stage" && !Array.isArray(s.stages)) {
        const { span, ...game } = s;
        const after = clone(game);
        if (after.get) delete after.get.groups;
        s = { stages: [{ id: "pairs", name: "In pairs", game: { ...game, span: { from: span.from } } }, { id: "after", name: "After", game: after }], overall: { by: "points" } };
      }
      const v = C.check(s, pg);
      const k = c && h.control ? (c.controls || []).find((x) => x.id === h.control) : null;
      const reads = k ? k.read(s) : undefined;
      const has = facetsAll(s).has(`${h.key}=${h.value}`) || (k && (Array.isArray(reads) ? reads.map(String).includes(String(h.value)) : String(reads) === String(h.value)));
      if (v.ok && has) return { ok: true, base: b.id, page: P.id };
      if (P.id === "s51" || !last) last = { why: v.problems[0] || v.waits[0] || (has ? "no type" : "the value didn't land"), base: b.id, page: P.id };
    }
  }
  const t = trackerWitness(`${h.key}=${h.value}`);
  if (t) return { ok: true, tracker: t.id, page: t.page };
  // A sport's pool of one team's (or one position's) players: no sport page here, so the shape is checked on a sport's own game
  // (basketball's short draft) with a team's id, as a team's sheet would give it.
  if (h.key === "pool.where" && (h.value === "teams" || h.value === "positions")) {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "src", "lib", "sports", "defaults", "basketball.json"), "utf8"));
    const spec = clone(d.specs.short.spec || d.specs.short);
    spec.pool = { of: "cast", where: { stillIn: true, [h.value]: h.value === "teams" ? ["20"] : ["G"] } };
    if (!S.specProblems(spec, null).length) return { ok: true, tracker: `basketball's short, from ${h.value === "teams" ? "one team" : "one position"} (its shape: a sport's page names the team)`, page: { sport: "basketball" } };
  }
  return { ok: false, why: last && last.why, base: last && last.base, page: last && last.page };
}

// ---------- the tracker's rows, matched to bases ----------

/** A spec's shape beyond its VOCAB values (a budget, a stake, a captain, lives, a race...): what tells a salary cap from a lineup. */
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
const safe = (f) => {
  try {
    return !!f();
  } catch {
    return false;
  }
};

const BASE_FACETS = C.BASES.filter((b) => b.spec).map((b) => {
  const spec = C.baseSpec(b, { from: 1, to: null });
  return { b, spec, f: facetsAll(spec), shape: shapeOf(spec) };
});
const KIND_KEYS = new Set(["get.by", "score.by", "count"]);
const homeFor = new Map();
for (const h of HOMES) {
  const k = `${h.key}=${h.value}`;
  if (!homeFor.has(k)) homeFor.set(k, h);
}
/** The nearest base to a spec (by its values and its shape), and the path from it: the changes the spec has on that the base
 *  hasn't (each a row and a square: two taps), then the values those don't explain (each a control: a tap). */
function pathFor(spec) {
  const want = facetsAll(spec);
  const shape = shapeOf(spec);
  let best = null;
  for (const x of BASE_FACETS) {
    let d = 0;
    for (const v of want) if (!x.f.has(v)) d += KIND_KEYS.has(v.split("=")[0]) ? 10 : 1;
    for (const v of x.f) if (!want.has(v)) d += KIND_KEYS.has(v.split("=")[0]) ? 10 : 1;
    for (const v of shape) if (!x.shape.has(v)) d += 2;
    for (const v of x.shape) if (!shape.has(v)) d += 2;
    if (!best || d < best.d) best = { ...x, d };
  }
  if (!best) return null;
  const req = spec.preset ? C.expand(spec) : spec;
  const changes = C.CHANGES.filter((c) => c.on && (c.apply || c.sheet) && !c.coming && safe(() => c.on(req)) && !safe(() => c.on(best.spec)));
  let made = best.spec;
  for (const c of changes) if (c.apply) made = safe(() => (made = C.applyChange(made, c.id, {}))) ? made : made;
  const explained = facetsAll(made);
  const steps = changes.map((c) => `${rowName(c)} › ${c.name}`);
  const seen = new Set(steps);
  let controls = 0;
  for (const v of [...want].filter((x) => !best.f.has(x) && !explained.has(x))) {
    const h = homeFor.get(v);
    const line = h ? label(h) : `(${v}: no home)`;
    if (!seen.has(line)) seen.add(line), steps.push(line), controls++;
  }
  return { base: best.b, steps, taps: 2 + changes.length * 2 + controls, d: best.d };
}
/** A change's row as the screen names it: the play row is the game's own (Your team, Your pick, The questions). */
function rowName(c) {
  if (c.row !== "play") return ROWNAME[c.row] || c.row;
  if (!c.kinds) return "Your team";
  return c.kinds.includes("questions") ? "The questions" : c.kinds.includes("pick") && !c.kinds.includes("draft") ? "Your pick" : "Your team";
}

// ---------- the numbers ----------

/** Each size limit (GAME-PIECES.md "Size limits"), the control that holds it. */
const NUMBERS = [
  ["A team scored by place (Outlast)", `1 to ${S.MAX_TEAM}`, "Your team › How many › On a team"],
  ["A lineup", `1 to ${S.MAX_STARTERS} starters, a bench of up to ${S.MAX_BENCH} (${S.MAX_LINEUP_TEAM} drafted)`, "Your team › How many › On a team, How many of them"],
  ["Questions a game", `${S.MAX_QUESTIONS}`, "The questions › Add a question (offered until 12)"],
  ["A person or group pick", `1 to ${S.MAX_PICK}`, "The questions › a question › How many to name"],
  ["An order, a confidence ranking", `2 to ${S.MAX_ORDER}, within 0 to ${S.MAX_WITHIN} places`, "The questions › The order they go / Rank who goes"],
  ["Chips to spread", `2 to ${S.MAX_CHIPS}`, "The questions › Spread chips on who wins"],
  ["Pairs", `1 to ${S.MAX_PAIRS}`, "The questions › Who outlasts whom"],
  ["A question's points", `0 to ${S.MAX_QUESTION_POINTS}`, "The questions › a question › Worth"],
  ["A choice's options", `2 to ${S.MAX_OPTIONS}`, "The questions › Pick from a list"],
  ["A window (every, over, a cut's every)", `2 to ${S.MAX_WINDOW} (a cut, 1 to ${S.MAX_WINDOW})`, "The questions › a question › Asked: Every few episodes, Over the next; How you win › Knockouts › Every how many episodes"],
  ["Parlays", `6, each 2 to ${S.MAX_LEGS} legs; more than 1, up to ${S.MAX_TIMES}`, "Bets › A parlay › Pays"],
  ["When points multiply", `${S.MAX_WHEN}`, "Scoring › Points multiply"],
  ["How a holding joined", `1 to 3; a list of 1 to ${S.MAX_JOINED}`, "Scoring › How they joined"],
  ["A bounty", `0.5 to ${S.MAX_BOUNTY}, in halves`, "Scoring › Bounties on the vote › A bounty is"],
  ["Secret roles", `1 to ${S.MAX_ROLE_SEATS} seats, 0.5 to ${S.MAX_ROLE_POINTS}, a name up to ${S.MAX_ROLE_NAME}`, "Twists › Secret Traitors"],
  ["The top scorer's twist", `2 to ${S.MAX_TWISTS} twists, a name up to ${S.MAX_TWIST_NAME}, closing 0 to ${S.MAX_TWIST_HOURS} h before`, "Twists › Twist of the week"],
  ["Stages", `2 to ${S.MAX_STAGES}, a name up to ${S.MAX_STAGE_NAME}; copies ${S.MAX_COPIES}`, "Over the season › A season of mini-games / A redraft on a shake-up"],
  ["A pick each episode", `1 (a pool); 1 to ${S.MAX_PICKS} scored by what they do`, "Your pick › What a pick is › Picks an episode"],
  ["Only these moments", `1 to ${S.MAX_ONLY}`, "Scoring › Only some moments"],
  ["A side stage's grouping", `held 1 to ${S.MAX_HELD} episodes`, "Over the season › A side game while a pair lasts"],
  ["The overall's points for places", `1 to ${S.MAX_PLACES} places`, "Over the season › The overall: Points for each place"],
  ["Lives", `1 to ${S.MAX_LIVES}; mulligans 1 to ${S.MAX_MULLIGANS}; buybacks 1 to ${S.MAX_BUYBACKS}, cost 0 to ${S.MAX_BUYBACK_COST}`, "How you win › Last one standing"],
  ["Cuts", `${S.MAX_CUTS}; 1 to ${S.MAX_CUT_OUT} out, or half`, "How you win › Knockouts › How many go"],
  ["Teams of players", `2 to ${S.MAX_PLAYER_TEAMS}; a name up to ${S.MAX_TEAM_NAME}`, "Who's playing › In teams"],
  ["Playoffs", `2 to ${S.MAX_PLAYOFF_TEAMS} teams`, "How you win › Head to head › A final at the end"],
  ["A handicap", `1 to ${S.MAX_HANDICAP} points an episode`, "Who's playing › Head start for newcomers"],
  ["A budget", `1 to ${S.MAX_BUDGET}; a sealed bid sheet, ${S.MAX_BIDS} bids`, "Your team › How the draft runs › Bids; Prices and a cap"],
  ["A shared seat", `2 to ${S.MAX_SEAT_PEOPLE} people`, "Who's playing › Share a team"],
  ["Group slots", `1 or ${S.MAX_GROUP_SLOTS}`, "Your team › A slot for a pair"],
  ["Side bets", `1 to ${S.MAX_BET_POINTS} points`, "Bets › Side bets"],
  ["A race", `1 to ${S.MAX_RACE} points`, "How you win › Race to a target"],
  ["A bank", `1 to ${S.MAX_BANK.toLocaleString("en-US")} to start`, "Bets › A bank › Everyone starts with"],
  ["A ticket", `2 to ${S.MAX_TICKET_LEGS} legs; pays up to ${S.MAX_PAYS} times`, "Bets › Build a ticket"],
  ["A card", `1 to ${S.MAX_CARD} lines an episode, from 1 to ${S.MAX_ONLY} moments`, "The questions › A new sheet each episode; Your card (bingo)"],
  ["A host's card", `the host's deadline 1 to ${S.MAX_HOST_HOURS} hours before`, "Twists › Rotating host"],
  ["An outside number", `read 1 to ${S.MAX_OUTSIDE_DAYS} days after`, "Not offered: the user turned down TVmaze's ratings (2026-11-07)"],
  ["Squares", `a ${S.SQUARE_GRIDS.join(" or ")} grid; taken ${S.SQUARE_TAKES.join(" or ")}; pays up to ${S.MAX_SQUARE_PAYS}`, "Your squares (a sport's Squares)"],
  ["Waivers", `${S.WAIVER_FEELS.join(", ")}; ${S.REPLACE_RULES.join(", ")}; ${S.WAIVER_ORDERS.join(", ")}; ${S.WAIVER_HOURS.join(", ")} h`, "The details › Waivers; Your team › Replacements"],
  ["A draft's clock", `${S.DRAFT_TIMERS.map((t) => (t ? `${t / 60} min` : "none")).join(", ")}`, "The details › The draft's time"],
  ["Who can join", `${S.JOINS.join(", ")}`, "The details › Who can join"],
];

// ---------- the table ----------

function main() {
  const homes = new Map();
  for (const h of HOMES) {
    const k = `${h.key}=${h.value}`;
    if (!homes.has(k)) homes.set(k, []);
    homes.get(k).push(h);
  }
  // Values a base square is the home of (what you do, what scores): the first base whose spec sets it.
  for (const { b, f } of BASE_FACETS) for (const x of f) if (!homes.has(x)) homes.set(x, [{ key: x.split("=")[0], value: x.split("=").slice(1).join("="), row: "gallery", change: null, control: null, base: b.id }]);
  const sportHomes = { "closes=daily": "When moves lock (a sport) › By the day", "closes=weekly": "When moves lock (a sport) › By the week", "closes=game": "When moves lock (a sport) › At each game", "closes=start": "When moves lock › At airtime", "get.by=squares": "Gallery › Betting › Squares (a sport)", "score.by=stats": "Gallery › Fantasy leagues › Season league (a sport)", "score.by=squares": "Gallery › Betting › Squares (a sport)", "ask.settle.source=tvmaze": null, "ask.settle=outside": null };

  const vocabRows = [];
  for (const [key, vals] of Object.entries(S.VOCAB)) {
    for (const [value, built] of Object.entries(vals)) {
      const k = `${key}=${value}`;
      const hs = (homes.get(k) || []).slice().sort((a, b) => (b.control ? 1 : 0) - (a.control ? 1 : 0));
      const h = hs.find((x) => x.change) || hs[0] || null;
      let where, proof;
      // B1's driving check (wizard-coverage.js): the home that proved it, as taps (its base, row, change, control) on a page.
      let drive = null;
      if (k in sportHomes && !hs.length) {
        where = sportHomes[k] || "Not offered: the user turned down TVmaze's ratings (2026-11-07)";
        proof = sportHomes[k] ? "a sport's (the tracker's sports rows)" : "—";
      } else if (!h) {
        where = "**no home**";
        proof = "—";
      } else if (h.row === "gallery") {
        const b = C.baseById(h.base);
        where = `Gallery › ${(C.CATS.find((x) => x.id === b.cat) || {}).name} › ${b.name}`;
        proof = "the base itself (it plays on Survivor 51)";
        drive = { key, value, base: h.base, row: null, change: null, control: null, page: "s51" };
      } else {
        where = hs.filter((x) => x.change).map(label).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).join("; ");
        let p = built === "later" ? { ok: false, coming: "later" } : null;
        for (const x of p ? [] : hs.filter((y) => y.change)) {
          const r = prove(x);
          if (r.ok) {
            p = r;
            if (!r.tracker) drive = { key, value, base: r.base, row: x.row, change: x.change, control: x.control, page: r.page, single: !!r.single };
            break;
          }
          p = p || r;
        }
        if (!p) p = { ok: false, why: "no change to try" };
        proof = p.ok ? (p.tracker ? `plays: ${/'s /.test(p.tracker) ? p.tracker : `the tracker's ${p.tracker}`} (${p.page && (p.page.show || p.page.sport || "")})` : p.single ? `plays: a game of that question on ${PAGES.find((x) => x.id === p.page).name}` : `plays: ${C.baseById(p.base).name} on ${PAGES.find((x) => x.id === p.page).name}`) : p.coming ? (p.coming === "later" ? "later: shown as Coming" : `coming: ${p.coming}`) : `needs: ${p.why || "?"}${p.base ? ` (tried ${C.baseById(p.base).name})` : ""}`;
      }
      vocabRows.push({ key, value, built, where, proof, drive });
    }
  }

  const tracker = JSON.parse(fs.readFileSync(TRACKER, "utf8"));
  const rows = statusRows(tracker).map(({ row, st, needs }) => {
    let pathLine = "";
    let taps = "";
    if (st.state === "yes" && row.spec) {
      const p = pathFor(row.spec);
      pathLine = p ? [`${p.base.name}`, ...p.steps].join(" → ") : "";
      taps = p ? p.taps : "";
    } else if (st.state === "step") pathLine = `${st.step === "A15" ? "Predictions › Live calls (Coming)" : st.step === "C8" ? "Head to head & teams › Two against one (Coming)" : "Shown as Coming"}`;
    else if (st.state === "gpt") pathLine = "Describe your game (our AI asks or says no)";
    else if (st.state === "decide") pathLine = `Waits on a rule: ${row.decide || ""}`;
    else pathLine = "Not planned";
    return { id: row.id, part: row.part, words: row.words || row.what || "", state: st.state, path: pathLine, taps };
  });

  const counts = (xs, f) => xs.reduce((a, x) => ((a[f(x)] = (a[f(x)] || 0) + 1), a), {});
  const playsNow = vocabRows.filter((r) => r.built === "now");
  const homed = playsNow.filter((r) => !/no home/.test(r.where));
  const proven = playsNow.filter((r) => /^plays|the base itself|a sport's/.test(r.proof));
  const refused = playsNow.filter((r) => /^Not offered/.test(r.where));
  const st = counts(rows, (r) => r.state);
  const lines = [];
  lines.push("# Start a game's coverage table (Round 2)");
  lines.push("");
  lines.push("Generated by `node scripts/dev-test/gallery-coverage.js` from `src/lib/game/start-gallery` and the engine; run it again after a change to either.");
  lines.push("");
  lines.push(`**Every engine value:** ${Object.keys(S.VOCAB).length} settings, ${vocabRows.length} values (${playsNow.length} the engine plays now): ${homed.length - refused.length} have a home in the gallery and ${proven.length} of them are proven by a game our check passes from that home; ${refused.length} isn't offered (TVmaze's ratings: the user's no, 2026-11-07). The ${vocabRows.length - playsNow.length} values still to build show as Coming where they'd live.`);
  lines.push(`**Every tracker request:** ${rows.length} (${st.yes || 0} play now, each given its base and changes; ${st.step || 0} wait on a step, ${st.decide || 0} on a rule, ${st.gpt || 0} are the GPT's, ${st.new || 0} not planned).`);
  lines.push("");
  lines.push("## Every value the engine plays");
  lines.push("");
  lines.push("| Setting | Value | Built | Home: row › change › control | Proof |");
  lines.push("|---|---|---|---|---|");
  for (const r of vocabRows) lines.push(`| \`${r.key}\` | \`${r.value}\` | ${r.built} | ${cell(r.where)} | ${cell(r.proof)} |`);
  lines.push("");
  lines.push("## Every number it holds to");
  lines.push("");
  lines.push("| What | Limit | Control |");
  lines.push("|---|---|---|");
  for (const [w, l, c] of NUMBERS) lines.push(`| ${cell(w)} | ${cell(l)} | ${cell(c)} |`);
  lines.push("");
  lines.push("## Every request in the tracker");
  lines.push("");
  lines.push("Taps are counted from the gallery: the base's square, each change's row and square (two), and Start. A control left on its default costs nothing; a number changed adds one.");
  lines.push("");
  lines.push("| Row | Request | Status | Path | Taps |");
  lines.push("|---|---|---|---|---|");
  const MARK = { yes: "plays", step: "waits on its step", decide: "waits on a rule", gpt: "the GPT's", new: "not planned" };
  for (const r of rows) lines.push(`| ${r.id} | ${cell(r.words).slice(0, 140)} | ${MARK[r.state] || r.state} | ${cell(r.path)} | ${r.taps} |`);
  lines.push("");
  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  const json = opt("json", null);
  if (json) fs.writeFileSync(path.resolve(json), JSON.stringify({ vocab: vocabRows, numbers: NUMBERS, rows }, null, 1));
  const gaps = playsNow.filter((r) => (/no home/.test(r.where) || /^needs/.test(r.proof)) && !/^Not offered/.test(r.where));
  console.log(`values: ${homed.length}/${playsNow.length} homed, ${proven.length}/${playsNow.length} proven; tracker: ${JSON.stringify(st)}; wrote ${path.relative(process.cwd(), OUT)}`);
  for (const g of gaps) console.log(`GAP ${g.key}=${g.value}: ${g.where} :: ${g.proof}`);
  if (args.includes("--check") && gaps.length) process.exit(1);
}

if (require.main === module) main();
module.exports = { prove, facetsOf, facetsAll, PAGES, HOMES };
