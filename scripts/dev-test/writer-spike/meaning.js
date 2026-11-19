// The writer spike's "meaning" reader: a typed request to an ORDER (order.js) by sentence embeddings instead of word lists. It uses
// the app's existing local model (db/embeddings.js: bge-small-en-v1.5, 8-bit, already in .models/), embeds the menu once per run
// (each base's name, square line and sentences; each change's name and line; each segment option's label; each question kind's
// name, and on each page each moment-settled kind crossed with the page's moments: "Who won the Immunity challenge?"), then
// matches the whole request to a base and each of its clauses to a change, an option, a question or the base. Numbers are bound by
// the words reader's slot rules (words.js) and placed on what the clauses matched; a clause that starts with a negation takes a
// change off (a small word rule: embeddings don't see "no"). sure: false when the best base isn't clearly ahead, a clause matches
// nothing well, a number has no slot here, or the menu or the engine refuses the result. With opt.current (an order) it reads a
// sentence as ops on that game (edit), through the words reader's shared ops step.
//
// Needs: the model's files in .models/Xenova/bge-small-en-v1.5 (db/fetch-embedding-model.js put them there) and
// @huggingface/transformers in node_modules. No network: this file sets transformers.js's allowRemoteModels to false and replaces
// fetch with one that throws and records the attempt (networkTried()), so a missing file fails loudly instead of downloading.
// db/embeddings.js loads .env.local; nothing here reads or prints it.
//   const R = require("./meaning.js");  await R.init(pg)  await R.read(text, pg)  await R.edit(text, currentOrder, pg)
//   node scripts/dev-test/writer-spike/meaning.js "a pool with 2 lives"   (reads it on Survivor 51)
//
// Thresholds (TH): the model's own calibration (db/embeddings.js: a right match 0.62 to 0.80, off-topic 0.46 to 0.58, so 0.62 is
// its floor) is for research notes against questions; these were tuned on the tracker's examples, stretch rows, dials and
// edits.json, never on its corpus.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, like the catalog (src/lib/game/start-gallery) */
const path = require("path");
const { pathToFileURL } = require("url");
const ROOT = path.join(__dirname, "..", "..", "..");
const C = require(path.join(ROOT, "src", "lib", "game", "start-gallery", "index.js"));
const M = require("./menu.js");
const O = require("./order.js");
const W = require("./words.js");

const TH = {
  // From the tuning sets: a base right in about 1 of 10 below a 0.05 lead over another kind, 6 of 10 above 0.08; 7 of 10 at 0.8.
  base: 0.7, // the chosen base's similarity to the request, at least
  margin: 0.08, // and ahead of the best base of another kind by this much
  close: 0.8, // or this close to the request
  closeMargin: 0.04, // and ahead by this much
  clause: 0.64, // a clause's best match (a change, a question, a base) to count as understood
  change: 0.68, // a clause's best change to make it
  option: 0.72, // a clause's best option (a change set one way) to make it
  question: 0.7, // a clause's best question to ask it
  switch: 0.8, // an edit's clause naming another kind of game this closely switches the base
};

// ---------- the model, offline ----------

const tried = [];
let ready = null;
let loadMs = null;
function blockNetwork() {
  if (globalThis.__writerSpikeBlocked) return;
  globalThis.__writerSpikeBlocked = true;
  globalThis.fetch = async (u) => {
    const url = String((u && u.url) || u);
    tried.push(url);
    throw new Error(`the writer spike blocks the network (asked for ${url})`);
  };
}
async function model() {
  if (ready) return ready;
  ready = (async () => {
    blockNetwork();
    const t0 = Date.now();
    const tf = await import(pathToFileURL(path.join(ROOT, "node_modules", "@huggingface", "transformers", "dist", "transformers.node.mjs")).href);
    tf.env.allowRemoteModels = false;
    if (path.resolve(process.cwd()) !== path.resolve(ROOT)) process.chdir(ROOT); // db/embeddings.js reads .models/ from the working directory
    const E = require(path.join(ROOT, "db", "embeddings.js"));
    await E.embedTexts(["warm up"], "query");
    loadMs = Date.now() - t0;
    return E;
  })();
  return ready;
}
const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

// ---------- the menu's vectors ----------

let MENU_VECS = null;
const PAGE_VECS = new Map();
const QUESTION_TEMPLATES = {
  who: (l) => `Who: ${l}?`,
  happens: (l) => `Will anyone this episode: ${l}?`,
  count: (l) => `How many times: ${l}?`,
  ou: (l) => `Over or under a number: ${l}`,
  most: (l) => `Who does it the most by the finale: ${l}`,
  first: (l) => `Who is the first: ${l}`,
};
const pageKey = (pg) => `${(pg && pg.show) || ""}`;
async function init(pg) {
  const E = await model();
  if (!MENU_VECS) {
    const m = M.menu();
    const docs = [];
    for (const b of m.bases) if (!b.sport) docs.push({ type: "base", id: b.id, kind: b.kind, state: b.state, text: b.doc });
    for (const c of m.changes) if (!["couch", "onegame", "total", "shows", "size", "draft", "pool", "room", "addq", "categories", "roto"].includes(c.id)) docs.push({ type: "change", id: c.id, text: `${c.name}: ${c.line}` });
    // Options people ask for by themselves ("nobody shares a castaway", "draft by bids"); the rest are details a change carries.
    const OPTIONS = new Set(["draft:own", "draft:order", "pickmeans:means", "repeat:repeat", "what:by", "spread:of", "card:from", "early:per", "joined:joined", "times:when", "knockouts:at", "traitors:on", "toptwist:who"]);
    for (const k of m.controls) for (const o of k.options) if (k.kind === "segment" && OPTIONS.has(`${k.change}:${k.id}`) && !/coming|a sport/i.test(o.sub || "")) docs.push({ type: "option", id: `${k.change}:${k.id}=${o.value}`, change: k.change, text: `${M.changeOf(k.change).name}, ${k.label.toLowerCase()}: ${o.label}${o.sub ? `. ${o.sub}` : ""}` });
    for (const q of m.questions) if (!q.sport && !q.moment) docs.push({ type: "question", id: q.id, text: q.name });
    // What the menu can't make, so a request for it lands somewhere that says so.
    docs.push({ type: "cant", id: "live play (A15)", text: "Live calls while the episode is on: guess as it happens, lock at a minute of the episode" });
    docs.push({ type: "cant", id: "an outside number", text: "Predict the episode's ratings or viewers from an outside source like IMDb" });
    docs.push({ type: "cant", id: "a moment's points", text: "No negative points: nothing costs points, change what a moment is worth" });
    docs.push({ type: "cant", id: "a late lock", text: "Someone watches a day late: let them lock their picks later" });
    const vecs = await E.embedTexts(docs.map((d) => d.text), "document");
    MENU_VECS = docs.map((d, i) => ({ ...d, v: vecs[i] }));
  }
  const key = pageKey(pg);
  if (!PAGE_VECS.has(key)) {
    const ms = (pg && pg.moments) || [];
    const docs = [];
    for (const m of ms) {
      const l = m.label || m.id;
      for (const [kind, f] of Object.entries(QUESTION_TEMPLATES)) docs.push({ type: "question", id: kind, moment: m.id, text: f(l) });
      if (/tribe|team/i.test(`${m.id} ${l}`)) docs.push({ type: "question", id: "group", moment: m.id, text: `Which tribe or team: ${l}?` });
    }
    const vecs = docs.length ? await E.embedTexts(docs.map((d) => d.text), "document") : [];
    PAGE_VECS.set(key, docs.map((d, i) => ({ ...d, v: vecs[i] })));
  }
  return { loadMs };
}

/** A request's clauses: split at sentence marks, semicolons, colons, and "and"/"but"/"then"/"plus" between clauses. */
function clausesOf(t) {
  const parts = t
    .split(/[.;:!?]+|,\s+(?=and |but |then |plus |with |if |when |so |the |you )|\s+(?:but|then|plus|and also|also)\s+|\s+and\s+(?=(?:who|what|which|if|the|a|an|each|every|you|we|newcomers|nobody|everyone|whether|it|its)\b)/)
    .map((x) => x.trim())
    .filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (out.length && p.split(/\s+/).length < 3) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  if (out.length > 1 && out[0].split(/\s+/).length < 3) out.splice(0, 2, `${out[0]} ${out[1]}`);
  return out;
}
const NEG = /^(no|not|without|never|remove|drop|take off|get rid of|turn off|stop|cancel)\b|\b(no|without) (more )?\w+$/;

// ---------- reading ----------

async function read(text, pg, opt = {}) {
  const E = await model();
  await init(pg);
  const current = opt.current || null;
  const why = [];
  const trace = {};
  const t = W.normalize(text).trim();
  const clauses = clausesOf(t);
  if (!clauses.length) clauses.push(t);
  const qv = await E.embedTexts([t, ...clauses], "query");
  const whole = qv[0];
  const cv = qv.slice(1);
  const docs = [...MENU_VECS, ...(PAGE_VECS.get(pageKey(pg)) || [])];
  const sims = (v) => docs.map((d) => ({ d, s: dot(v, d.v) })).sort((a, b) => b.s - a.s);
  const perClause = cv.map((v) => sims(v));

  // 1. what each clause is nearest: a base, a change or option, a question, something the menu can't make
  const clauseBest = perClause.map((r) => ({
    any: r[0],
    change: r.find((x) => x.d.type === "change" || (x.d.type === "option" && x.s >= TH.option)),
    q: r.find((x) => x.d.type === "question"),
    base: r.find((x) => x.d.type === "base"),
    cant: r.find((x) => x.d.type === "cant"),
  }));

  // 2. the base: near the whole request, with the clauses' changes that its kind takes
  let cur = null;
  if (current) {
    const b = O.build(current, pg);
    cur = { spec: b.spec, kind: b.spec ? C.kindOf(b.spec) : null, on: b.spec ? W.onIn(b.spec) : new Set(), asks: (b.spec && b.spec.ask) || [] };
  }
  const ws = sims(whole);
  const baseSims = new Map();
  for (const { d, s } of ws) if (d.type === "base") baseSims.set(d.id, s);
  clauseBest.forEach((c) => {
    if (c.base) baseSims.set(c.base.d.id, Math.max(baseSims.get(c.base.d.id) || 0, c.base.s * 0.97));
  });
  const wantChanges = clauseBest.map((c) => (c.change && c.change.s >= TH.change ? (c.change.d.type === "option" ? c.change.d.change : c.change.d.id) : null)).filter(Boolean);
  const scoreBase = (id, s) => {
    const k = M.baseOf(id).kind;
    let x = s;
    for (const ch of wantChanges) {
      const c = M.changeOf(ch);
      x += !c.kinds || c.kinds.includes(k) ? 0.01 : -0.04;
    }
    return x;
  };
  const ranked = [...baseSims.entries()].map(([id, s]) => [id, scoreBase(id, s), s]).sort((a, b) => b[1] - a[1]);
  trace.base = ranked.slice(0, 4).map(([id, x, s]) => `${id}:${s.toFixed(3)}${x !== s ? `→${x.toFixed(3)}` : ""}`);
  let base;
  if (cur) {
    base = current.base;
    const sw = clauseBest.find((c) => c.base && c.base.s >= TH.switch && c.base.d.id !== base && M.baseOf(c.base.d.id).kind !== cur.kind && c.base.s >= c.any.s - 0.005);
    if (sw) base = sw.base.d.id;
  } else {
    const top = ranked[0];
    base = top[0];
    const rival = ranked.find(([id]) => M.baseOf(id).kind !== M.baseOf(base).kind);
    trace.topSim = top[2];
    trace.margin = rival ? top[1] - rival[1] : 1;
    const lead = rival ? top[1] - rival[1] : 1;
    const clear = (top[2] >= TH.base && lead >= TH.margin) || (top[2] >= TH.close && lead >= TH.closeMargin);
    if (!clear) why.push(`no base clearly nearest (${base} ${top[2].toFixed(2)}, ahead of ${rival ? rival[0] : "-"} by ${lead.toFixed(3)})`);
  }
  const bm = M.baseOf(base);
  if (bm.state === "coming") why.push(`${bm.name} is coming (${bm.coming})`);
  if (bm.state === "needs") why.push(`${bm.name} needs ${bm.needs || "its own setup"}`);
  const info = W.baseInfo(base, pg);
  const kind = cur && base === current.base ? cur.kind : info.kind;
  const isOn = (id) => (cur && base === current.base ? cur.on.has(id) : info.on.has(id));

  // 3. each clause to what it's nearest
  const order = { base, changes: [] };
  const qs = [];
  const clauseTrace = [];
  clauses.forEach((c, i) => {
    const b = clauseBest[i];
    let took = "nothing";
    const neg = NEG.test(c);
    if (b.cant && b.cant.s >= TH.clause && b.cant.s >= b.any.s - 0.01) {
      why.push(`can't: ${b.cant.d.id} ("${c}")`);
      took = `cant:${b.cant.d.id}`;
    } else if (kind === "questions" && b.q && b.q.s >= TH.question && b.q.s >= (b.change ? b.change.s : 0) - 0.01 && !neg) {
      qs.push({ kind: b.q.d.id, moment: b.q.d.moment || null, clause: c });
      took = `q:${b.q.d.id}${b.q.d.moment ? `@${b.q.d.moment}` : ""}`;
    } else if (b.change && b.change.s >= TH.change && (!b.base || b.change.s >= b.base.s - 0.02 || b.base.d.id !== base)) {
      const id = b.change.d.type === "option" ? b.change.d.change : b.change.d.id;
      const ch = M.changeOf(id);
      if (ch && (!ch.kinds || ch.kinds.includes(kind))) {
        if (neg && isOn(id)) order.changes.push({ id, drop: true });
        else if (neg) why.push(`"${c}" takes off ${ch.name}, which isn't on`);
        else {
          let entry = order.changes.find((x) => x.id === id && !x.drop);
          if (!entry) {
            entry = { id };
            order.changes.push(entry);
          }
          if (b.change.d.type === "option") {
            const [k, v] = b.change.d.id.split(":")[1].split("=");
            entry.controls = { ...(entry.controls || {}), [k]: v === "true" ? true : v === "false" ? false : /^\d+(\.\d+)?$/.test(v) ? Number(v) : v };
          }
        }
        took = `change:${b.change.d.id}${neg ? " (off)" : ""}`;
      } else {
        why.push(`"${c}" reads as ${ch ? ch.name : id}, which ${bm.name} doesn't take`);
        took = `off:${id}`;
      }
    } else if (b.base && b.base.s >= TH.clause && (b.base.d.id === base || M.baseOf(b.base.d.id).kind === kind)) took = `base:${b.base.d.id}`;
    else if (b.any.s < TH.clause) {
      why.push(`a clause it can't place ("${c}", best ${b.any.d.type} ${b.any.d.id} ${b.any.s.toFixed(2)})`);
      took = "unplaced";
    } else took = `near:${b.any.d.type}:${b.any.d.id}`;
    clauseTrace.push(`${c} => ${took} (${b.any.d.type}:${b.any.d.id}${b.any.d.moment ? `@${b.any.d.moment}` : ""} ${b.any.s.toFixed(3)})`);
  });
  trace.clauses = clauseTrace;

  // 4. questions: the base's questions to the ones asked (an edit only adds)
  if (kind === "questions" && qs.length) {
    const have = cur && base === current.base ? cur.asks.filter((q) => !q.card && q.answer !== "ticket").map((q) => ({ id: q.id, sig: O.sigOf(q) })) : info.asks.filter((q) => !q.card && !q.ticket);
    const used = new Set();
    const seen = new Set();
    for (const q of qs) {
      if (seen.has(`${q.kind}@${q.moment}`)) continue;
      seen.add(`${q.kind}@${q.moment}`);
      const want = W.KIND_SIG[q.kind] + (q.moment ? `|${q.moment}` : "");
      const hit = have.find((h) => !used.has(h.id) && h.sig.startsWith(want));
      if (hit) used.add(hit.id);
      else order.changes.push({ id: "addq", option: q.kind, ...(q.moment ? { moment: q.moment } : {}) });
    }
    if (!cur) for (const h of have) if (!used.has(h.id)) order.changes.push({ id: "dropq", option: h.id });
  }

  // 5. numbers: the words reader's slots, placed on this order (a number whose change isn't here can't be placed)
  const wr = W.read(text, pg, current ? { current } : {});
  const wo = wr.order || { changes: [] };
  for (const c of wo.changes) {
    if (!c.controls || c.drop) continue;
    const nums = Object.entries(c.controls).filter(([, v]) => typeof v === "number" || c.id === "size" || c.id === "setq");
    if (!nums.length) continue;
    if (c.id === "setq" || c.id === "addq") {
      if (kind !== "questions") continue;
      const mine = order.changes.filter((x) => x.id === "addq");
      if (mine.length) mine.forEach((x) => (x.controls = { ...(x.controls || {}), ...c.controls }));
      else order.changes.push({ id: "setq", option: "*", controls: { ...c.controls } });
      continue;
    }
    const ch = M.changeOf(c.id);
    const fits = ch && (!ch.kinds || ch.kinds.includes(kind));
    const entry = order.changes.find((x) => x.id === c.id && !x.drop);
    if (entry) entry.controls = { ...(entry.controls || {}), ...Object.fromEntries(nums) };
    else if (fits && (ch.always || isOn(c.id))) order.changes.push({ id: c.id, controls: Object.fromEntries(nums) });
    else why.push(`a number for ${ch ? ch.name : c.id}, which this reading didn't pick`);
  }
  why.push(...(wr.why || []).filter((w) => /^a number it can't place|doesn't fit|^can't:/.test(w)));
  if (wo.length) order.length = wo.length;
  if (base === "onemoment" || base === "most") {
    const m = W.momentFor(t, pg, "who");
    if (m) order.moment = m;
  }

  // 6. built and checked
  if (cur) return { ...W.editResult(order, why, current, pg), trace };
  const built = O.build(order, pg);
  if (built.problems.length) why.push(...built.problems.map((p) => `menu: ${p}`));
  if (built.check && !built.check.ok) why.push(`engine: ${built.check.problems[0] || built.check.waits[0] || "no type"}`);
  return { order, sure: !why.length, why: [...new Set(why)], trace, built };
}

/** A sentence read as ops on the current game (an order). */
async function edit(text, current, pg) {
  return read(text, pg, { current });
}

module.exports = { init, read, edit, clausesOf, TH, loadMs: () => loadMs, networkTried: () => tried.slice() };

if (require.main === module) {
  (async () => {
    const fs = require("fs");
    const ed = process.argv.find((a) => a.startsWith("--edit="));
    const text = process.argv.slice(2).filter((a) => !a.startsWith("--")).join(" ") || "a pool with 2 lives";
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, ".impeccable", "mocks", "wizard-r1", "pages", "s51.json"), "utf8"));
    const page = p.wizard ? p.wizard.page : p.page || p;
    const pg = C.pageFacts(page, { show: "Survivor 51", lastSeason: "<last season's game>", cast: (page.pack && page.pack.cast) || [] });
    const t0 = Date.now();
    await init(pg);
    const t1 = Date.now();
    const r = ed ? await edit(text, { base: ed.slice(7), changes: [] }, pg) : await read(text, pg);
    console.log(JSON.stringify({ order: O.orderLine(r.order), ops: r.ops, sure: r.sure, why: r.why, trace: r.trace, loadMs, initMs: t1 - t0, readMs: Date.now() - t1, network: tried }, null, 1));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
