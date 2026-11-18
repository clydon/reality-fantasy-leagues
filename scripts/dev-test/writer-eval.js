// The writer spike's harness: how far a reader with no generative AI gets at turning a typed request into a playable game. Each
// request in the capability tracker (tests/fixtures/engine-capabilities.json: its corpus, examples, stretch rows and dials) is read
// by a reader (scripts/dev-test/writer-spike: words, meaning, or both as a cascade), its ORDER made into a game through the
// Start-a-game gallery's catalog (writer-spike/order.js), checked by the engine, and scored against the tracker's expected game at
// the facet level (writer-spike/compare.js: lenient, said, strict, F1, nearest gallery square). Rows the engine can't play yet,
// and requests the tracker says to question or refuse, score when the reader comes back unsure. The edit cases
// (writer-spike/edits.json) are scored as ops on a current game. No database, no server, no network (the meaning reader's model is
// on disk; meaning.js blocks fetch and reports any attempt).
//
//   node scripts/dev-test/writer-eval.js --reader=words|meaning|both [--set=corpus|examples|stretch|dials|edits|tuning|all]
//        [--json=<out>] [--verbose] [--fails] [--held-out] [--s51=captured|rulebook] [--only=<id,id>]
//
//   --set        which rows (default all: every part, the corpus reported apart as held out, and the edits; tuning: all but the
//                corpus, the sets the lexicon and thresholds were tuned on)
//   --held-out   drop the lexicon entries added after looking at a corpus failure (words.js marks them peek: true)
//   --s51        Survivor 51's page: the captured wizard read (default: .impeccable/mocks/wizard-r1/pages/s51.json, Episode 9
//                next, a couch of 4, 21 still in, the cast's names), or the tracker's rulebook page (scripts/engine-capabilities.js)
//   --verbose    every row; --fails only the misses
//
// Other shows' pages are the tracker's (its pageCtx: the show's rulebook, or a stand-in of its kind), with no couch, no cast and
// Episode 1 next. Sports rows are reported apart: the gallery's sport bases have no specs.
//
// Each row's class: answer (the engine plays its expected game: scored for coverage and precision), open (a corpus request whose
// expect.game is null or "draft": the wizard asks which game, so unsure is right and sure on its default is too), refuse (the
// engine can't play it yet, or the tracker says the request itself should be questioned or refused: right when unsure),
// resolver (only the resolver can tell: reported, not scored), sport (reported apart).
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, like the catalog (src/lib/game/start-gallery) */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const C = require(path.join(ROOT, "src", "lib", "game", "start-gallery", "index.js"));
const Cap = require(path.join(ROOT, "src", "lib", "game", "game-spec", "capabilities.js"));
const { ctxOf, pageName, TRACKER } = require(path.join(ROOT, "scripts", "engine-capabilities.js"));
const O = require("./writer-spike/order.js");
const K = require("./writer-spike/compare.js");
const W = require("./writer-spike/words.js");

const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const READER = opt("reader", "words");
const SET = opt("set", "all");
const VERBOSE = args.includes("--verbose");
const FAILS = args.includes("--fails");
const HELD_OUT = args.includes("--held-out");
const S51MODE = opt("s51", "captured");
const ONLY = opt("only", null) ? new Set(opt("only", "").split(",")) : null;
if (!["words", "meaning", "both"].includes(READER)) {
  console.error("--reader=words|meaning|both");
  process.exit(2);
}
W.READ_OPTS.heldOut = HELD_OUT;

// ---------- pages ----------

const LAST = "<last season's game>";
const S51_FILE = path.join(ROOT, ".impeccable", "mocks", "wizard-r1", "pages", "s51.json");
let S51 = null;
function s51() {
  if (S51) return S51;
  const p = JSON.parse(fs.readFileSync(S51_FILE, "utf8"));
  const page = p.wizard ? p.wizard.page : p.page || p;
  S51 = C.pageFacts(page, { show: "Survivor 51", lastSeason: LAST, cast: (page.pack && page.pack.cast) || [] });
  return S51;
}
const PAGES = new Map();
function pageFor(row) {
  const p = row.page || { show: "Survivor", season: 51, rulebook: "survivor" };
  if (p.sport) return null;
  if (S51MODE === "captured" && p.show === "Survivor" && Number(p.season) === 51 && !p.also) return s51();
  const key = JSON.stringify(p);
  if (!PAGES.has(key)) {
    let pg = null;
    try {
      const ctx = ctxOf(p);
      pg = ctx ? C.pageFacts(ctx, { show: pageName(p) || p.show, lastSeason: LAST }) : null;
    } catch {
      pg = null;
    }
    PAGES.set(key, pg);
  }
  return PAGES.get(key);
}

// ---------- readers ----------

let R = null;
let B = null;
async function readWith(text, pg) {
  if (READER === "words") return W.read(text, pg);
  if (READER === "meaning") {
    R = R || require("./writer-spike/meaning.js");
    return R.read(text, pg);
  }
  B = B || require("./writer-spike/both.js");
  return B.read(text, pg);
}
async function editWith(text, current, pg) {
  if (READER === "words") return W.edit(text, current, pg);
  if (READER === "meaning") {
    R = R || require("./writer-spike/meaning.js");
    return R.edit(text, current, pg);
  }
  B = B || require("./writer-spike/both.js");
  return B.edit(text, current, pg);
}

// ---------- the tracker's rows ----------

/** A row's class: answer (the engine plays its expected game), refuse (the engine can't yet, or the request should be questioned
 *  or refused by whoever reads it), resolver (only the resolver can tell: the reader isn't scored on it), sport. */
function classOf(row) {
  if (row.page && row.page.sport) return { cls: "sport" };
  const st = Cap.statusOf(row, row.page ? ctxOf(row.page) : null);
  // The corpus says when the words leave the game open (expect.game null: the wizard asks which game; "draft": it asks Outlast or
  // Weekly Lineup). Its expected spec is then the wizard's default: unsure is right there, and sure on that default is too.
  if (st.state === "yes" && row.part === "corpus" && row.expect && (row.expect.game === null || row.expect.game === "draft")) return { cls: "open", st, why: row.expect.game === null ? "the wizard asks which game" : "the wizard asks Outlast or Weekly Lineup" };
  if (st.state === "yes") return { cls: "answer", st };
  const flag = row.expect && row.expect.flag;
  if (st.state === "gpt" && flag && row.expect.flagBy === "resolver") return { cls: "resolver", st, why: row.expect.why || "the resolver's" };
  return { cls: "refuse", st, why: st.state === "gpt" ? `the GPT's to ${flag === "refuse" ? "refuse" : "ask"}${row.expect && row.expect.why ? `: ${row.expect.why}` : ""}` : st.state === "step" ? `waits on ${st.step}` : st.state === "decide" ? "waits on a rule" : "not planned" };
}

async function scoreRow(row) {
  const words = row.words || row.what || "";
  const c = classOf(row);
  const pg = pageFor(row);
  const out = { id: row.id, part: row.part, group: row.group || row.dial || null, cls: c.cls, words, page: row.page ? pageName(row.page) || row.page.show || row.page.sport : "Survivor 51", why: c.why || null };
  if (c.cls === "sport") {
    // The sport bases have no specs: a reader can at most name one. Sure on a show game here is wrong.
    const t0 = process.hrtime.bigint();
    const r = W.read(words, s51());
    out.ms = Number(process.hrtime.bigint() - t0) / 1e6;
    out.sure = false;
    out.wordsSure = r.sure;
    out.order = r.order ? O.orderLine(r.order) : null;
    return out;
  }
  if (!pg) {
    out.error = "no page";
    return out;
  }
  const t0 = process.hrtime.bigint();
  const r = await readWith(words, pg);
  out.ms = Number(process.hrtime.bigint() - t0) / 1e6;
  out.sure = !!r.sure;
  out.by = r.by || READER;
  out.order = r.order ? O.orderLine(r.order) : null;
  out.readerWhy = r.why || [];
  out.trace = r.trace && { margin: r.trace.margin, topSim: r.trace.topSim, base: r.trace.base, clauses: r.trace.clauses, leftover: r.trace.leftover, numbers: r.trace.numbers };
  const built = r.built || (r.order ? O.build(r.order, pg) : null);
  const spec = built && built.spec;
  out.plays = !!(built && built.check && built.check.ok);
  if (c.cls === "answer" || c.cls === "open") {
    const cmp = K.compare(spec, row.spec, W.numbersIn(words));
    const nb = K.nearestBases(row.spec);
    const pb = spec ? K.nearestBases(spec) : new Set();
    out.expectedPlaysHere = C.check(row.spec, pg).ok;
    out.lenient = cmp.lenient;
    out.said = cmp.said;
    out.strict = cmp.strict;
    out.f1 = cmp.f1;
    out.rightBase = [...pb].some((x) => nb.has(x));
    out.nearest = [...nb].join("/");
    out.missing = cmp.missing;
    out.extra = cmp.extra;
    out.numbers = cmp.numbers;
    out.saidMiss = cmp.saidMiss;
  }
  return out;
}

// ---------- the edits ----------

async function scoreEdit(e) {
  const pg = e.page ? pageFor({ page: e.page }) : s51();
  const out = { id: e.id, part: "edit", words: e.words, current: O.orderLine(e.current), cls: e.expect.refuse ? "refuse" : "answer", why: e.expect.refuse || null };
  const t0 = process.hrtime.bigint();
  const r = await editWith(e.words, e.current, pg);
  out.ms = Number(process.hrtime.bigint() - t0) / 1e6;
  out.sure = !!r.sure;
  out.by = r.by || READER;
  out.ops = r.ops || [];
  out.readerWhy = r.why || [];
  if (e.expect.refuse) return out;
  const want = O.build(O.applyOps(e.current, e.expect.ops), pg);
  const got = O.build(O.applyOps(e.current, out.ops), pg);
  const cmp = K.compare(got.spec, want.spec, W.numbersIn(e.words));
  const key = (ops) => [...new Set(ops.map((o) => `${o.op === "set" ? "add" : o.op}:${o.change || o.option || o.base || ""}`))].sort().join(" ");
  out.opMatch = key(out.ops) === key(e.expect.ops);
  out.lenient = cmp.lenient;
  out.strict = cmp.strict;
  out.exact = JSON.stringify(got.spec) === JSON.stringify(want.spec);
  out.f1 = cmp.f1;
  out.expectOps = e.expect.ops;
  out.missing = cmp.missing;
  out.extra = cmp.extra;
  out.numbers = cmp.numbers;
  return out;
}

// ---------- the report ----------

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const p95 = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(0.95 * s.length))];
};
function summarize(rows) {
  const ans = rows.filter((r) => r.cls === "answer" && !r.error);
  const sure = ans.filter((r) => r.sure);
  const ref = rows.filter((r) => r.cls === "refuse");
  const res = rows.filter((r) => r.cls === "resolver");
  const sport = rows.filter((r) => r.cls === "sport");
  const open = rows.filter((r) => r.cls === "open");
  const ms = rows.filter((r) => r.cls !== "sport" && typeof r.ms === "number").map((r) => r.ms);
  return {
    n: rows.length,
    answerable: ans.length,
    sure: sure.length,
    coverage: ans.length ? sure.length / ans.length : 0,
    lenient: sure.filter((r) => r.lenient).length,
    said: sure.filter((r) => r.said).length,
    strict: sure.filter((r) => r.strict).length,
    rightBase: ans.filter((r) => r.rightBase).length,
    rightBaseSure: sure.filter((r) => r.rightBase).length,
    guessRight: ans.filter((r) => r.lenient).length,
    f1Sure: mean(sure.map((r) => r.f1 || 0)),
    f1All: mean(ans.map((r) => r.f1 || 0)),
    refuse: ref.length,
    refused: ref.filter((r) => !r.sure).length,
    resolver: res.length,
    resolverUnsure: res.filter((r) => !r.sure).length,
    sport: sport.length,
    sportWordsSure: sport.filter((r) => r.wordsSure).length,
    expectedOff: ans.filter((r) => r.expectedPlaysHere === false).length,
    ms: mean(ms),
    p95: p95(ms),
    byMeaning: rows.filter((r) => r.by === "meaning").length,
    open: open.length,
    openUnsure: open.filter((r) => !r.sure).length,
    openSureRight: open.filter((r) => r.sure && r.lenient).length,
    openGuessRight: open.filter((r) => r.lenient).length,
  };
}
function table(title, groups) {
  const lines = [];
  lines.push(`\n${title}`);
  lines.push("| rows | n | answerable | sure (coverage) | lenient when sure | said when sure | strict when sure | right square (all / sure) | best guess right (sure or not) | F1 sure / all | should be unsure | unsure there | game left open: n, asks (unsure), sure and right | resolver-only (unsure) | sport (words sure on a show game) | ms mean / p95 |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const [name, rows] of groups) {
    const s = summarize(rows);
    lines.push(`| ${name} | ${s.n} | ${s.answerable} | ${s.sure} (${pct(s.sure, s.answerable)}) | ${s.lenient}/${s.sure} (${pct(s.lenient, s.sure)}) | ${s.said}/${s.sure} (${pct(s.said, s.sure)}) | ${s.strict}/${s.sure} (${pct(s.strict, s.sure)}) | ${pct(s.rightBase, s.answerable)} / ${pct(s.rightBaseSure, s.sure)} | ${s.guessRight} (${pct(s.guessRight, s.answerable)}) | ${s.f1Sure.toFixed(2)} / ${s.f1All.toFixed(2)} | ${s.refuse} | ${s.refused} (${pct(s.refused, s.refuse)}) | ${s.open ? `${s.open}: ${s.openUnsure} asks, ${s.openSureRight} sure+right (guess right ${s.openGuessRight})` : "–"} | ${s.resolver} (${s.resolverUnsure}) | ${s.sport} (${s.sportWordsSure}) | ${s.ms.toFixed(1)} / ${s.p95.toFixed(1)} |`);
  }
  return lines.join("\n");
}
function editTable(rows) {
  const ans = rows.filter((r) => r.cls === "answer");
  const sure = ans.filter((r) => r.sure);
  const ref = rows.filter((r) => r.cls === "refuse");
  const ms = rows.map((r) => r.ms);
  return [
    "\nEdits (writer-spike/edits.json)",
    "| n | changes | sure (coverage) | ops match when sure | lenient when sure | strict when sure | exact spec when sure | F1 sure / all | should be unsure | unsure there | ms mean / p95 |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    `| ${rows.length} | ${ans.length} | ${sure.length} (${pct(sure.length, ans.length)}) | ${sure.filter((r) => r.opMatch).length}/${sure.length} | ${sure.filter((r) => r.lenient).length}/${sure.length} (${pct(sure.filter((r) => r.lenient).length, sure.length)}) | ${sure.filter((r) => r.strict).length}/${sure.length} | ${sure.filter((r) => r.exact).length}/${sure.length} | ${mean(sure.map((r) => r.f1)).toFixed(2)} / ${mean(ans.map((r) => r.f1 || 0)).toFixed(2)} | ${ref.length} | ${ref.filter((r) => !r.sure).length} | ${mean(ms).toFixed(1)} / ${p95(ms).toFixed(1)} |`,
  ].join("\n");
}
function rowLine(r) {
  const mark = r.cls === "answer" ? (r.sure ? (r.lenient ? (r.strict ? "OK " : "ok~") : "BAD") : "uns") : r.cls === "open" ? (r.sure ? (r.lenient ? "opn+" : "opn!") : "opn?") : r.cls === "sport" ? "spt" : r.cls === "resolver" ? (r.sure ? "res+" : "res?") : r.sure ? "BAD" : "ok ";
  const diff = r.cls === "answer" && r.sure && !r.strict ? ` | missing ${r.missing.join(",") || "-"} | extra ${r.extra.join(",") || "-"}${r.numbers && r.numbers.length ? ` | nums ${r.numbers.slice(0, 4).join("; ")}` : ""}` : "";
  const why = !r.sure && r.readerWhy && r.readerWhy.length ? ` | why: ${r.readerWhy.slice(0, 3).join(" / ")}` : "";
  return `${mark} ${r.id} [${r.cls}${r.group ? ` ${r.group}` : ""}] ${r.words.slice(0, 110)}\n      -> ${r.order || r.ops && JSON.stringify(r.ops) || "(none)"}${r.by && r.by !== READER ? ` (by ${r.by})` : ""}${diff}${why}${r.cls === "answer" && !r.rightBase ? ` | nearest ${r.nearest}` : ""}`;
}

async function main() {
  const tracker = JSON.parse(fs.readFileSync(TRACKER, "utf8"));
  const all = Cap.rowsOf(tracker);
  const want = { corpus: ["corpus"], examples: ["example"], stretch: ["stretch"], dials: ["dial"], tuning: ["example", "stretch", "dial"], all: ["example", "stretch", "dial", "corpus"], edits: [] }[SET];
  if (!want) {
    console.error("--set=corpus|examples|stretch|dials|edits|tuning|all");
    process.exit(2);
  }
  const rows = all.filter((r) => want.includes(r.part) && (!ONLY || ONLY.has(r.id)));
  const t0 = Date.now();
  let loadMs = null;
  if (READER !== "words") {
    R = require("./writer-spike/meaning.js");
    const l0 = Date.now();
    await R.init(s51());
    loadMs = { model: R.loadMs(), menuVectors: Date.now() - l0 - (R.loadMs() || 0) };
  }
  const results = [];
  for (const row of rows) results.push(await scoreRow(row));
  const edits = [];
  if (SET === "edits" || SET === "all" || SET === "tuning") {
    const E = JSON.parse(fs.readFileSync(path.join(__dirname, "writer-spike", "edits.json"), "utf8"));
    for (const e of E.cases) if (!ONLY || ONLY.has(e.id)) edits.push(await scoreEdit(e));
  }
  const lines = [];
  lines.push(`# writer-eval: reader=${READER}${HELD_OUT ? " (held-out lexicon)" : ""}, set=${SET}, Survivor 51 page=${S51MODE}`);
  if (loadMs) lines.push(`model load ${loadMs.model} ms (transformers.js import + bge-small from .models/), menu vectors ${loadMs.menuVectors} ms; network attempts: ${R.networkTried().length}`);
  const parts = [["corpus (held out)", results.filter((r) => r.part === "corpus")], ["examples", results.filter((r) => r.part === "example")], ["stretch", results.filter((r) => r.part === "stretch")], ["dials", results.filter((r) => r.part === "dial")]].filter(([, xs]) => xs.length);
  const tuning = results.filter((r) => r.part !== "corpus");
  if (parts.length > 1 && tuning.length) parts.push(["tuning sets together", tuning]);
  if (results.length) lines.push(table("Requests (the capability tracker)", parts));
  if (edits.length) lines.push(editTable(edits));
  const offHere = results.filter((r) => r.cls === "answer" && r.expectedPlaysHere === false);
  if (offHere.length) lines.push(`\nExpected games that don't play on the page used here (scored anyway): ${offHere.map((r) => r.id).join(", ")}`);
  lines.push(`\n${results.length + edits.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (VERBOSE || FAILS) {
    lines.push("\nRows:");
    for (const r of [...results, ...edits]) {
      const fail = (r.cls === "answer" && (!r.sure || !r.strict || (r.part === "edit" && !r.exact))) || (r.cls === "refuse" && r.sure);
      if (VERBOSE || fail) lines.push(rowLine(r));
    }
  }
  console.log(lines.join("\n"));
  const json = opt("json", null);
  if (json) {
    fs.writeFileSync(path.resolve(json), JSON.stringify({ reader: READER, set: SET, heldOut: HELD_OUT, s51: S51MODE, loadMs, network: R ? R.networkTried() : [], summary: Object.fromEntries(parts.map(([n, xs]) => [n, summarize(xs)])), results, edits }, null, 1));
    console.log(`wrote ${json}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
