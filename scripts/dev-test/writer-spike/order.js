// The writer spike's orders: what a reader hands back, made into a game through the gallery's catalog (no spec is ever written by
// hand here). An ORDER is a choice from the menu (menu.js):
//
//   { base: "fantasy",                                   a gallery base (src/lib/game/start-gallery/bases.json)
//     moment: "idolFound",                               for a base that leaves its moment open (One-moment draft, Who does it most)
//     length: { one: true } | { from, to },              the span: one episode, or from/to (an episode, "next", or { phase })
//     changes: [                                         applied in the menu's row order (see ORDER below), each:
//       { id: "captain", controls: { times: 3 } },       a change made (its apply) and its controls set (its setControl)
//       { id: "size", controls: { each: 3 } },           an always-on change: its controls only
//       { id: "jackpot", drop: true },                   a change the base has, taken off (dropChange)
//       { id: "addq", option: "who", moment: "individualImmunity", controls: { points: 2 } },   Add a question (a question kind)
//       { id: "dropq", option: "idol" },                 a base's question taken off, by its id (or a kind's signature)
//       { id: "setq", option: "boot", controls: { points: 5 } },  a question's own controls (QUESTION_CONTROLS)
//       { id: "only", moments: ["individualImmunity"] }, which moments count (the spike's: the change has no control for it)
//     ] }
//
// Edit ops (edits.json) are ops on an order: { op: add|set|drop|addq|dropq|setq|base|length, change, control, value, ... }.
//
// Needs: the repo only. CommonJS.
//   const O = require("./order.js");  O.build(order, pg) -> { spec, problems, check, ok }   O.applyOps(order, ops) -> order
//
// Reimplemented here because the catalog doesn't export them: a question from a question kind (gallery-coverage.js questionOf),
// and each change's state for one change (changeStates computes a whole row, applying and checking every change in it).
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, like the catalog (src/lib/game/start-gallery) */
const path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..");
const C = require(path.join(ROOT, "src", "lib", "game", "start-gallery", "index.js"));
const M = require("./menu.js");

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const asks = (s) => (isObj(s) && Array.isArray(s.ask) ? s.ask : []);

/** The order changes are made in: what a game is first, then its parts, its questions, how it scores, who plays, how you win, its
 *  bets (every bet but a parlay or a ticket takes the others off, so those go last), the details, and stages at the very end. */
const ORDER = [
  "what", "pickmeans", "size", "draft", "cap", "market", "pool", "repeat", "second", "spread", "slots", "keepers", "replacements", "joined", "card",
  "addq", "dropq", "setq",
  "only", "shows", "captain", "times", "reverse", "bounty", "toptwist", "traitors", "host", "majority", "beatbot", "early", "bootcall", "finalepicks",
  // Most points before teams (teams need a game ranked by points), teams before a race or a cut (they keep the teams).
  "total", "couch", "teams", "share", "handicap", "solo", "bot",
  "matchups", "weeks", "knockouts", "race", "standing", "coop", "streak", "worth", "categories", "roto",
  "nobets", "side", "stake", "double", "bank", "pot", "lone", "jackpot", "parlay", "ticket",
  "waivers", "room", "join", "hidden",
  "onegame", "redraft", "shakeup", "halves", "minis", "alongside", "sidegame", "nextshow",
];
const rankOf = (id) => {
  const i = ORDER.indexOf(id);
  return i < 0 ? ORDER.length : i;
};

/** A question's signature: what it's answered with and what settles it (and on which moment). */
const sigOf = (q) => `${q.answer}|${(q.settle && q.settle.by) || ""}:${(q.settle && q.settle.take) || ""}|${(q.settle && q.settle.moment) || ""}`;
const kindSig = (k, moment) => `${k.answer}|${k.settle.by}:${k.settle.take || ""}|${k.moment ? moment || "" : ""}`;

/** A question of a kind on the page (gallery-coverage.js questionOf's way): its moment the one named, else the season's first. */
function questionOf(kindId, pg, opt = {}) {
  const kind = C.QUESTION_KINDS.find((k) => k.id === kindId);
  if (!kind) return null;
  let q = { id: opt.id || `q-${kind.id}`, ask: kind.name, answer: kind.answer, points: kind.points, asked: kind.asked, settle: clone(kind.settle) };
  if (kind.closes) q.closes = kind.closes;
  if (kind.moment) {
    const ms = (pg && pg.moments) || [];
    q.settle.moment = opt.moment || (kind.moment === "group" ? ms.find((m) => /tribe|team/i.test(`${m.id} ${m.label || ""}`)) || ms[0] || {} : ms[0] || {}).id;
  }
  for (const k of ["pick", "within", "chips", "pairs", "line"]) if (kind[k] !== undefined) q[k] = kind[k];
  if (kind.options) q.options = clone(kind.options);
  if (kind.id === "role") q.settle.role = "Traitor";
  if (kind.id === "phase") q.settle.phase = opt.phase || ((pg && pg.later && pg.later[0]) || {}).id;
  for (const [k, v] of Object.entries(opt.controls || {})) {
    const ctl = C.QUESTION_CONTROLS.find((x) => x.id === k);
    if (ctl) q = ctl.write(q, v);
    else if (["line", "chips", "pairs", "within"].includes(k)) q[k] = v; // the kind's own numbers (no control holds them)
  }
  return q;
}

/** A change's state on this game, for one change: offered (its kinds), on, and why it doesn't fit. */
function stateOf(c, s, pg) {
  const kind = C.kindOf(s);
  const offered = (!c.kinds || c.kinds.includes(kind)) && (!c.sport || (pg && pg.sport));
  if (!offered) return { offered: false };
  const on = !!(c.on && c.on(s));
  let why = c.coming ? `coming${c.coming === "later" ? "" : ` (${c.coming})`}` : null;
  if (!why && !on && c.fits) {
    try {
      why = c.fits(s, pg) || null;
    } catch (e) {
      why = String(e.message || e);
    }
  }
  return { offered: true, on, why };
}

/** The span an order asks for: its length, else the base's own (one episode, or the rest of the season). */
function spanFor(length, base, pg) {
  const from = (pg && pg.from) || 1;
  if (!length) return base.len === "1 episode" ? { from, to: from } : { from, to: null };
  if (length.one) return { from, to: from };
  const at = (v, d) => (v === "next" || v === undefined ? d : v);
  return { from: at(length.from, from), to: length.to === undefined ? null : length.to === "next" ? from : length.to };
}

function step(s, ch, pg, problems) {
  if (ch.id === "addq") {
    if (C.kindOf(s) !== "questions") {
      problems.push(`Add a question isn't offered on a ${C.kindOf(s)} game`);
      return s;
    }
    const q = questionOf(ch.option, pg, { moment: ch.moment, controls: ch.controls, phase: ch.phase });
    if (!q) {
      problems.push(`no question kind ${ch.option}`);
      return s;
    }
    const ids = new Set(asks(s).map((x) => x.id));
    let id = q.id;
    for (let i = 2; ids.has(id); i++) id = `${q.id}${i}`;
    return { ...s, ask: [...asks(s), { ...q, id }] };
  }
  if (ch.id === "dropq") {
    const left = asks(s).filter((q) => q.id !== ch.option && sigOf(q) !== ch.option);
    if (left.length === asks(s).length) problems.push(`no question ${ch.option} to take off`);
    return { ...s, ask: left };
  }
  if (ch.id === "setq") {
    let hit = false;
    const ask = asks(s).map((q) => {
      if (!(q.id === ch.option || sigOf(q) === ch.option || (ch.option === "*" && !q.card))) return q;
      hit = true;
      let x = { ...q };
      for (const [k, v] of Object.entries(ch.controls || {})) {
        const ctl = C.QUESTION_CONTROLS.find((y) => y.id === k);
        const entry = M.controlOf("q", k);
        if (ctl && M.valueFits(entry, v)) x = ctl.write(x, v);
        else if (["line", "chips", "pairs", "within"].includes(k)) x[k] = v;
        else problems.push(`a question's ${k}: ${v} doesn't fit`);
      }
      return x;
    });
    if (!hit) problems.push(`no question ${ch.option} to set`);
    return { ...s, ask };
  }
  const c = C.changeById(ch.id);
  if (!c) {
    problems.push(`no change ${ch.id}`);
    return s;
  }
  if (ch.drop) return C.dropChange(s, c.id, pg);
  const st = stateOf(c, s, pg);
  if (!st.offered) {
    problems.push(`${c.name} isn't offered on a ${C.kindOf(s)} game`);
    return s;
  }
  if (!st.on) {
    if (st.why) {
      problems.push(`${c.name}: ${st.why}`);
      return s;
    }
    if (c.apply) s = C.applyChange(s, c.id, pg);
    else if (c.sheet) {
      problems.push(`${c.name} needs its own sheet`);
      return s;
    } else if (!c.start) {
      problems.push(`${c.name} isn't on, and has no way on`);
      return s;
    }
  }
  if (c.id === "only" && Array.isArray(ch.moments) && ch.moments.length) {
    const have = new Set(((pg && pg.moments) || []).map((m) => m.id));
    const ms = ch.moments.filter((m) => have.has(m));
    if (ms.length < ch.moments.length) problems.push(`a moment this season's research doesn't answer: ${ch.moments.filter((m) => !have.has(m)).join(", ")}`);
    if (ms.length) s = { ...s, score: { ...s.score, only: ms } };
  }
  for (const [k, v] of Object.entries(ch.controls || {})) {
    const ctl = (c.controls || []).find((x) => x.id === k);
    if (!ctl) {
      problems.push(`${c.name} has no control ${k}`);
      continue;
    }
    if (!M.valueFits(M.controlOf(c.id, k), v)) {
      problems.push(`${c.name} › ${ctl.label}: ${JSON.stringify(v)} is outside what it holds`);
      continue;
    }
    try {
      s = C.setControl(s, c.id, k, v, pg);
    } catch (e) {
      problems.push(`${c.name} › ${ctl.label}: ${e.message}`);
    }
  }
  return s;
}

/** An order made into a game: { spec, problems (the order's own), check (the engine's verdict), ok }. */
function build(order, pg) {
  const problems = [];
  const b = order && C.baseById(order.base);
  if (!b) return { spec: null, problems: [`no base ${order && order.base}`], check: null, ok: false };
  if (!b.spec) return { spec: null, problems: [b.coming ? `${b.name} is coming (${b.coming})` : `${b.name} needs ${b.needs || "its own setup"}`], check: null, ok: false };
  let s;
  try {
    s = C.baseSpec(b, spanFor(order.length, b, pg), pg, order.moment);
  } catch (e) {
    return { spec: null, problems: [String(e.message || e)], check: null, ok: false };
  }
  const changes = (order.changes || []).map((c, i) => ({ c, i })).sort((x, y) => rankOf(x.c.id) - rankOf(y.c.id) || x.i - y.i).map((x) => x.c);
  for (const ch of changes) {
    try {
      s = step(s, ch, pg, problems);
    } catch (e) {
      problems.push(`${ch.id}: ${e.message}`);
    }
  }
  // A change asked for that a later one took off (every bet but a parlay or a ticket clears the others; Most points clears lives):
  // the menu can't hold the two together, so the order isn't what was asked.
  for (const ch of changes) {
    const c = C.changeById(ch.id);
    if (!c || ch.drop || !c.apply || !c.on || ["total", "couch", "onegame", "nobets"].includes(c.id) || problems.some((p) => p.startsWith(`${c.name}`))) continue;
    let on = true;
    try {
      on = !!c.on(s);
    } catch {
      on = true;
    }
    if (!on && !Array.isArray(s.stages)) problems.push(`${c.name} was taken off by another change (the menu can't hold them together)`);
  }
  const check = C.check(s, pg);
  return { spec: s, problems, check, ok: !!check.ok && !problems.length };
}

/** Edit ops applied to an order (a new order; the old one untouched). */
function applyOps(order, ops) {
  const o = clone(order) || {};
  o.changes = o.changes || [];
  for (const op of ops || []) {
    if (op.op === "base") o.base = op.base;
    else if (op.op === "length") o.length = op.length;
    else if (op.op === "moment") o.moment = op.moment;
    else if (op.op === "add" || op.op === "set") {
      const ex = o.changes.find((c) => c.id === op.change && !c.drop);
      const controls = op.op === "set" ? { [op.control]: op.value } : op.controls || {};
      if (ex) {
        ex.controls = { ...(ex.controls || {}), ...controls };
        if (op.moments) ex.moments = op.moments;
      } else {
        o.changes = o.changes.filter((c) => !(c.id === op.change && c.drop));
        o.changes.push({ id: op.change, ...(Object.keys(controls).length ? { controls } : {}), ...(op.moments ? { moments: op.moments } : {}) });
      }
    } else if (op.op === "drop") {
      const had = o.changes.some((c) => c.id === op.change && !c.drop);
      o.changes = o.changes.filter((c) => c.id !== op.change);
      if (!had) o.changes.push({ id: op.change, drop: true });
    } else if (op.op === "addq") o.changes.push({ id: "addq", option: op.option, ...(op.moment ? { moment: op.moment } : {}), ...(op.controls ? { controls: op.controls } : {}) });
    else if (op.op === "dropq") o.changes.push({ id: "dropq", option: op.option });
    else if (op.op === "setq") o.changes.push({ id: "setq", option: op.option, controls: op.controls || {} });
  }
  return o;
}

/** An order in one line, for the report and --verbose. */
function orderLine(o) {
  if (!o) return "(none)";
  const ch = (o.changes || []).map((c) => {
    const ctl = c.controls && Object.keys(c.controls).length ? `{${Object.entries(c.controls).map(([k, v]) => `${k}:${JSON.stringify(v)}`).join(",")}}` : "";
    return `${c.drop ? "-" : "+"}${c.id}${c.option ? `(${c.option}${c.moment ? `@${c.moment}` : ""})` : ""}${c.moments ? `[${c.moments.join(",")}]` : ""}${ctl}`;
  });
  return `${o.base}${o.moment ? `@${o.moment}` : ""}${o.length ? ` len=${JSON.stringify(o.length)}` : ""}${ch.length ? ` ${ch.join(" ")}` : ""}`;
}

module.exports = { build, applyOps, questionOf, sigOf, kindSig, stateOf, spanFor, orderLine, ORDER };
