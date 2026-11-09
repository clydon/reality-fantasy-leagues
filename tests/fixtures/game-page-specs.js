// Every game spec the repo can make, for the game page's census (tests/game-page.test.js; docs/PLAN-start-a-game-gpt.md U1): the
// engine's rolls on each rulebook the tracker names (free, then each base, way to win, twist and length locked in turn), each
// sport's standard games (src/lib/sports/defaults), the presets, and the engine's own worked examples, stretch requests and spec
// fixtures (the shapes no roll makes: an order, confidence, chips, pairs, a ticket, a bracket...). Each { src, id, spec, describe? }.
// `extra`: more files of specs (the U0 mocks' made-for and typed games, when they're on this machine), walked the same way.
const fs = require("fs");
const path = require("path");
const G = require("../../src/lib/game/game-spec/index.js");
const R = require("../../src/lib/game/game-spec/roll.js");
const B = require("./game-words/bank.js");

const ROOT = path.join(__dirname, "..", "..");
const PAGES = [
  { page: { show: "Survivor", season: 51, rulebook: "survivor", couch: 6, pool: 18 }, total: 13 },
  { page: { show: "The Traitors", season: 4, rulebook: "traitors", couch: 4, pool: 23 }, total: 12 },
  { page: { show: "Below Deck", season: 13, rulebook: "belowDeck", couch: 4, pool: 10 }, total: 16 },
  { page: { show: "Saturday Night Live", season: null, rulebook: "snl", couch: 4 }, total: 21 },
];
const pageOf = ({ page, total }) => ({ ctx: B.ctxOf(page), pack: { episodes: { aired: 0, total, next: { number: 1 } }, stillIn: page.pool, couch: { people: page.couch } } });

function rolls(n) {
  const out = [];
  const seen = new Set();
  for (const p of PAGES) {
    const page = pageOf(p);
    const add = (r, why) => {
      if (!r || !r.ok) return;
      const k = JSON.stringify(r.spec);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ src: "roll", id: `${p.page.rulebook}:${why}#${r.seed}`, spec: r.spec, describe: r.describe });
    };
    for (let s = 1; s <= n; s++) add(R.rollSpec(page, {}, s), "free");
    for (const b of R.ROLL.bases) for (let s = 1; s <= 12; s++) add(R.rollSpec(page, { base: b.id }, 1000 + s), `base:${b.id}`);
    for (const w of R.ROLL.wins) for (let s = 1; s <= 12; s++) add(R.rollSpec(page, { win: w }, 2000 + s), `win:${w}`);
    for (const t of R.ROLL.twists) for (let s = 1; s <= 8; s++) add(R.rollSpec(page, { twists: [t.id] }, 3000 + s), `twist:${t.id}`);
    for (const l of R.ROLL.lengths) for (let s = 1; s <= 6; s++) add(R.rollSpec(page, { length: l }, 4000 + s), `length:${l}`);
  }
  return out;
}
function sports() {
  const dir = path.join(ROOT, "src/lib/sports/defaults");
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const [id, s] of Object.entries(d.specs || {})) out.push({ src: "sport", id: `${d.sport}:${id}`, spec: s.spec || s, sport: d.sport });
  }
  return out;
}
const isSpec = (x) =>
  x && typeof x === "object" && !Array.isArray(x) && (x.get || x.ask) && (x.rank || x.score || x.span || x.ask) && !x.spec &&
  (!x.ask || (Array.isArray(x.ask) && x.ask.every((q) => q && typeof q === "object" && q.answer))) && (!x.get || (typeof x.get === "object" && x.get.by));
function walked(src, root, where) {
  const out = [];
  const walk = (x, w) => {
    if (Array.isArray(x)) return x.forEach((y, i) => walk(y, `${w}.${i}`));
    if (x && typeof x === "object") {
      if (isSpec(x)) return void out.push({ src, id: w, spec: x });
      // A made-for or typed game's answer: { spec: { game } } or { spec }.
      const sp = x.spec && typeof x.spec === "object" ? (x.spec.game && typeof x.spec.game === "object" ? x.spec.game : x.spec) : null;
      if (sp && isSpec(sp)) return void out.push({ src, id: `${w}:${x.name || ""}`, spec: sp });
      for (const [k, v] of Object.entries(x)) walk(v, `${w}.${k}`);
    }
  };
  walk(root, where);
  return out;
}
function fixtures() {
  const out = walked("fixture", JSON.parse(fs.readFileSync(path.join(__dirname, "engine-capabilities.json"), "utf8")), "capabilities");
  for (const f of ["game-specs.js", "sports-examples.js"]) out.push(...walked("fixture", require(path.join(__dirname, f)), f));
  for (const [id, spec] of Object.entries(G.PRESETS)) out.push({ src: "preset", id, spec });
  return out;
}
function allSpecs({ rolls: n = 200, extra = [] } = {}) {
  const more = extra.filter((f) => fs.existsSync(f)).flatMap((f) => walked("made", JSON.parse(fs.readFileSync(f, "utf8")), path.basename(f)));
  return [...rolls(n), ...sports(), ...fixtures(), ...more];
}
module.exports = { allSpecs };
