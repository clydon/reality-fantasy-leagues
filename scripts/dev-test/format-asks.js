// Dev-only: F2's proof (docs/PLAN-start-a-game-gpt.md, "Formats nobody announced"; the results are in
// docs/STUDY-format-changes.md, "F2: the format section asked again"). Asks recorded episodes again with the research prompt's
// format section (db/episode-research.js: the whole full-research prompt as the bot's run sends it, structured JSON), through
// the LOCAL bot only, keeps each answer beside the season's tapes (never over a tape), and scores each answer's format section
// against F1's ground truth (tests/fixtures/format-timelines, scripts/dev-test/format-study.js):
//   - the state at the episode's end: how the episode was played, each group found exactly, each person's group (who they're
//     with, or on their own), the newcomers, and whether a whole group went home (wentHomeAs);
//   - the changes: the answer's own (kind, the episode it takes effect, when it came in) and the ones our code works out by
//     comparing the state going in with the answer's (formats/format-state.js changesBetween, crossCheck: a change both find
//     is as sure as the answer says; one only one side finds is unsure), each against the fixture's changes reported in that
//     episode (where it was shown; for one never shown, where it took effect).
// The state going in (shown in the prompt, as research's own earlier answer would be live): the answer this run has for the
// episode before, else the fixture's truth at the end of the episode before (the first of a run, or a gap), else none. Each
// person's group after their name (the cast list's, then every earlier answer's newGroup, as staging would have moved them).
//
//   node scripts/dev-test/format-asks.js plan                          the study's set: what `ask` would ask next, in order
//   node scripts/dev-test/format-asks.js prompt <show> <season> <ep>   the prompt it would send (asks nothing)
//   node scripts/dev-test/format-asks.js ask [<show> <season> <eps>] [--again] [--max=N] [--pause=75]
//                                                                      asks what isn't answered yet (the study's set, or
//                                                                      episodes "4-10,16"); --again asks answered ones anew
//   node scripts/dev-test/format-asks.js score [<show> <season>] [--md] each answer scored, then per season and overall
//   node scripts/dev-test/format-asks.js reread [<show> <season>]      the kept answers read again by the code as it stands
//                                                                      (no bot): after a change to the parser or the checks
//   node scripts/dev-test/format-asks.js timeline [<show> <season>] [--md]
//                                                                      F3: the format's state over time built from the kept
//                                                                      answers (format-timeline.js), scored against F1's
//                                                                      fixtures (no bot)
//
// The study's set (F1's proposal): The Challenge 41 episodes 4-10 and 16, Survivor 49 3-8, The Challenge 40 2, 3, 9, 10 and
// 12, The Traitors 4 1, 7, 8 and 9.
//
// Where: ~\rfl-tapes\<show>\<season>\format\e<NN>.json (TAPES_DIR moves it, as tapes.js has it), with .prompt.md and
// .answer.md beside it for reading; a new ask of an answered episode (--again) is e<NN>.2.json and on, a failed one
// e<NN>.fail<k>.json. Scoring reads the latest answer.
// Needs: the lane's .env.local (AUTH_DATABASE_URL on localhost, with the seasons loaded: `tapes.js load <show> <season>`;
// LLM_BROWSER_API_KEY for the local bot), and for `ask` the local bot up at http://127.0.0.1:8765. Never production's bot:
// this lane's LLM_BROWSER_API_URL lists it first, so it isn't read; FORMAT_ASKS_BOT may name another local one. The local
// bot answers one question at a time and the tapes recorder uses it too: `ask` waits until it's free, and pauses between its
// own questions so the recorder gets its turns. It writes nothing to the database. Stop with Ctrl+C (after this question).
"use strict";
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const Study = require("./format-study.js");
const FS = require("../../src/lib/game/formats/format-state.js");
const Timeline = require("../../src/lib/game/formats/format-timeline.js");

const TAPES = process.env.TAPES_DIR || path.join(os.homedir(), "rfl-tapes");
const BOT = (process.env.FORMAT_ASKS_BOT || "http://127.0.0.1:8765").replace(/\/$/, "");
const BOT_WAIT_S = Number(process.env.BOT_WAIT_S) || 420;


const STUDY_SET = [
  { show: "the-challenge", season: 41, episodes: [4, 5, 6, 7, 8, 9, 10, 16] },
  { show: "survivor", season: 49, episodes: [3, 4, 5, 6, 7, 8] },
  { show: "the-challenge", season: 40, episodes: [2, 3, 9, 10, 12] },
  { show: "the-traitors-us", season: 4, episodes: [1, 7, 8, 9] },
];

const GROUPED = new Set(["tribes", "teams", "pairs"]);
const AT = { start: 0, mid: 1, end: 2 };
const cmp = (a, b) => a[0] - b[0] || AT[a[1]] - AT[b[1]];
const low = (v) => String(v || "").trim().toLowerCase();
const pad = (n) => String(n).padStart(2, "0");

// ---------- the truth (pure) ----------

/** The layers of a season's groupings that are how people play (not a label like Vets / New Threats). */
const playLayers = (t) => Object.keys(t.groupings || {}).filter((l) => !t.groupings[l].label);

/**
 * What an answer for episode n should say, from the fixture: { playedAs, phase, groups, alone, newcomers, wentHomeAs, alt }.
 * The groups are as known at n's end going into n+1 (format-study's stateAtEnd, per layer that's how people play), when the
 * next episode is played in groups as far as anyone knew by then (its way of playing shown by n's end, or the same as n's),
 * or when a new grouping for it was shown by n's end; otherwise none (everyone for themselves). `alt` is the groups at the
 * start of n+1 when they differ (a change at n+1's start that a recap written later reads back into n's end): either counts.
 * One group of everyone is no grouping, as in changesBetween. Pure.
 */
function truthAtEnd(t, n) {
  const e = t.episodes.find((x) => x.n === n);
  if (!e) return null;
  const next = t.episodes.find((x) => x.n === n + 1);
  let playNext = e.play;
  if (next && next.play !== "none" && next.play !== e.play) playNext = next.playShown && cmp(next.playShown, [n, "end"]) <= 0 ? next.play : e.play;
  const layers = playLayers(t);
  let groups = [];
  let alone = [];
  for (const layer of layers) {
    const s = Study.stateAtEnd(t, layer, n);
    const spell = s.spell >= 0 ? t.groupings[layer].spells[s.spell] : null;
    const announced = spell && spell.from[0] === n + 1;
    if (GROUPED.has(playNext) || announced) {
      groups = groups.concat(s.groups);
      alone = alone.concat(s.alone);
    }
  }
  if (groups.length < 2) {
    groups = [];
    alone = [];
  }
  let alt = null;
  if (next && next.play !== "none") {
    let g2 = [];
    if (GROUPED.has(next.play)) {
      const left = Study.exits(t);
      for (const layer of layers) {
        const first = Study.groupsIn(t, layer, n + 1)[0];
        if (first) g2 = g2.concat(first.groups.filter((g) => g.members.every((m) => !left.has(m) || left.get(m).episode > n)));
      }
    }
    if (g2.length < 2) g2 = [];
    const keys = (gs) => gs.map((g) => FS.keyOf(g.members)).sort().join(" | ");
    if (keys(g2) !== keys(groups)) alt = { groups: g2.filter((g) => g.members.length > 1), alone: [] };
  }
  const gone = (e.out || []).filter((o) => o.how !== "placed" && o.how !== "won").map((o) => o.name);
  let wentHomeAs = gone.length ? "individuals" : "nobody";
  if (gone.length > 1 && GROUPED.has(e.play)) {
    for (const layer of layers) {
      for (const { groups: gs } of Study.groupsIn(t, layer, n)) {
        if (gs.some((g) => g.members.length > 1 && g.members.every((m) => gone.includes(m)))) wentHomeAs = "groups";
      }
    }
  }
  return { playedAs: e.play, phase: e.phase || null, groups, alone: alone.sort(), newcomers: (e.in || []).map((x) => x.name), wentHomeAs, alt };
}

/** The fixture's changes an answer for episode n should report: those shown in n (or, never shown, taking effect in n). */
function changesReportedIn(t, n) {
  return Study.changes(t)
    .filter((c) => (c.shown ? c.shown[0] : c.from[0]) === n)
    .map((c) => ({ kind: c.kind, from: c.from[0], when: c.shown ? c.shown[1] : c.from[1], what: c.what || "" }));
}

/**
 * The state going into episode n for the prompt: this run's answer for n - 1 (when it says who is with whom), else the
 * fixture's truth at the end of n - 1, else none (episode 1). `answers`: episode -> a result record. Pure.
 */
function goingInFor(t, n, answers) {
  const prev = answers[n - 1];
  const newcomers = [...new Set(Object.entries(answers).filter(([k]) => Number(k) < n).flatMap(([, r]) => ((r.parsed && r.parsed.formatState && r.parsed.formatState.newcomers) || []).map((x) => x.name)))];
  if (prev && prev.ok && prev.parsed && prev.parsed.formatState && Array.isArray(prev.parsed.formatState.groups)) {
    return { from: "answer", episode: n - 1, state: prev.parsed.formatState, newcomers };
  }
  if (n <= 1) return { from: "none", episode: null, state: null, newcomers };
  const truth = truthAtEnd(t, n - 1);
  if (!truth) return { from: "none", episode: null, state: null, newcomers };
  return { from: "truth", episode: n - 1, state: { playedAs: truth.playedAs, phase: truth.phase, groups: truth.groups, alone: truth.alone }, newcomers: [...new Set([...newcomers, ...truth.newcomers])] };
}

// ---------- scoring (pure) ----------

/** A state's division: its groups of two or more by key, none when there's only one (one group of everyone isn't divided). */
function divisionOf(state) {
  const gs = ((state && state.groups) || []).filter((g) => g.members.length > 1);
  return gs.length > 1 ? gs : [];
}

/** Each person's place in a division: their group's key, or "alone". */
function placesOf(division, alone = []) {
  const m = new Map();
  for (const g of division) for (const x of g.members) m.set(low(x), FS.keyOf(g.members));
  for (const x of alone) if (!m.has(low(x))) m.set(low(x), "alone");
  return m;
}

/** One answer's groups against one expected set: { exact, found, expected, extra, people, peopleRight }. */
function groupScore(answerState, expected) {
  const E = divisionOf(expected);
  const A = answerState && Array.isArray(answerState.groups) ? divisionOf(answerState) : null;
  const ek = new Set(E.map((g) => FS.keyOf(g.members)));
  const universe = E.length ? [...E.flatMap((g) => g.members), ...(expected.alone || [])] : null;
  if (!A) return { known: false, exact: false, found: 0, expected: E.length, extra: 0, people: universe ? universe.length : 0, peopleRight: 0 };
  const ak = new Set(A.map((g) => FS.keyOf(g.members)));
  const found = [...ek].filter((k) => ak.has(k)).length;
  const extra = [...ak].filter((k) => !ek.has(k)).length;
  let people = 0;
  let peopleRight = 0;
  if (universe) {
    const pe = placesOf(E, expected.alone || []);
    const pa = placesOf(A, answerState.alone || []);
    for (const x of universe) {
      people += 1;
      if (pa.get(low(x)) === pe.get(low(x))) peopleRight += 1;
    }
  }
  return { known: true, exact: found === E.length && extra === 0, found, expected: E.length, extra, people, peopleRight };
}

/** Changes listed against the expected ones: each expected matched once by kind (preferring the right episode). */
function matchChanges(expected, listed) {
  const left = listed.slice();
  const rows = expected.map((x) => {
    let i = left.findIndex((c) => c.kind === x.kind && c.from === x.from);
    if (i < 0) i = left.findIndex((c) => c.kind === x.kind);
    const c = i >= 0 ? left.splice(i, 1)[0] : null;
    return { expected: x, got: c, kind: !!c, from: !!c && c.from === x.from, when: !!c && c.when === x.when };
  });
  return { rows, extra: left };
}

/**
 * One answer scored against the fixture: { episode, ok, playedAs, groups (the better of the end and `alt`), alone, newcomers,
 * wentHomeAs, said (the answer's own changes), ours (our comparison crossed with them), problems }. Pure.
 */
function scoreAnswer(t, record) {
  const n = record.episode;
  const truth = truthAtEnd(t, n);
  const out = { episode: n, ok: !!(record.ok && record.parsed && record.parsed.formatState), goingIn: record.goingIn ? record.goingIn.from : "none" };
  if (!out.ok || !truth) return { ...out, why: record.error || (truth ? "no format section" : "no truth for this episode") };
  const st = record.parsed.formatState;
  out.playedAs = { want: truth.playedAs, got: st.playedAs, right: st.playedAs === truth.playedAs };
  const main = groupScore(st, truth);
  const alt = truth.alt ? groupScore(st, truth.alt) : null;
  out.groups = alt && (alt.exact > main.exact || (alt.exact === main.exact && alt.peopleRight / (alt.people || 1) > main.peopleRight / (main.people || 1))) ? { ...alt, by: "alt" } : { ...main, by: "end" };
  const wantNew = truth.newcomers.map(low);
  const gotNew = (st.newcomers || []).map((x) => low(x.name));
  out.newcomers = { want: truth.newcomers, got: (st.newcomers || []).map((x) => x.name), found: wantNew.filter((x) => gotNew.includes(x)).length, extra: gotNew.filter((x) => !wantNew.includes(x)).length };
  out.wentHomeAs = { want: truth.wentHomeAs, got: st.wentHomeAs, right: st.wentHomeAs === truth.wentHomeAs };
  const expected = changesReportedIn(t, n);
  out.expected = expected;
  out.said = matchChanges(expected, st.changes || []);
  const before = record.goingIn && record.goingIn.state;
  const left = (record.parsed.left || []).slice();
  const theirs = (st.newcomers || []).map((x) => x.name);
  const ours = before ? FS.changesBetween(before, st, { left, newcomers: theirs }) : null;
  const crossed = FS.crossCheck(ours, st.changes || []);
  out.oursKnown = !!ours;
  out.ours = matchChanges(expected.filter((x) => FS.GROUPING_KINDS.includes(x.kind)), crossed.filter((c) => c.by === "both" || c.by === "ours"));
  out.crossed = crossed;
  out.problems = record.problems || [];
  return out;
}

/** Totals over scored answers. Pure. */
function totals(scored) {
  const ok = scored.filter((s) => s.ok);
  const sum = (f) => ok.reduce((n, s) => n + f(s), 0);
  const g = (s) => s.groups;
  return {
    asked: scored.length,
    answered: ok.length,
    playedAs: sum((s) => (s.playedAs.right ? 1 : 0)),
    groupsKnown: sum((s) => (g(s).known ? 1 : 0)),
    groupsExact: sum((s) => (g(s).exact ? 1 : 0)),
    groupsFound: sum((s) => g(s).found),
    groupsExpected: sum((s) => g(s).expected),
    groupsExtra: sum((s) => g(s).extra),
    people: sum((s) => g(s).people),
    peopleRight: sum((s) => g(s).peopleRight),
    newcomersWant: sum((s) => s.newcomers.want.length),
    newcomersFound: sum((s) => s.newcomers.found),
    newcomersExtra: sum((s) => s.newcomers.extra),
    wentHomeAs: sum((s) => (s.wentHomeAs.right ? 1 : 0)),
    changes: sum((s) => s.expected.length),
    saidKind: sum((s) => s.said.rows.filter((r) => r.kind).length),
    saidFrom: sum((s) => s.said.rows.filter((r) => r.from).length),
    saidWhen: sum((s) => s.said.rows.filter((r) => r.when).length),
    saidExtra: sum((s) => s.said.extra.length),
    groupingChanges: sum((s) => s.ours.rows.length),
    oursKind: sum((s) => s.ours.rows.filter((r) => r.kind).length),
    oursSure: sum((s) => s.ours.rows.filter((r) => r.kind && r.got.sure === "high").length),
    oursExtra: sum((s) => s.ours.extra.length),
    oursUnknown: ok.filter((s) => !s.oursKnown).length,
  };
}

// ---------- files ----------

const dirOf = (show, season) => path.join(TAPES, show, String(season), "format");
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};

/** The latest answer per episode on disk: episode -> record (an ok one over a failed one). */
function answersOf(show, season) {
  const dir = dirOf(show, season);
  if (!fs.existsSync(dir)) return {};
  const by = {};
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^e(\d+)(?:\.(\d+))?\.json$/);
    if (!m) continue;
    const n = Number(m[1]);
    const k = Number(m[2] || 1);
    if (!by[n] || by[n].k < k) by[n] = { k, record: readJson(path.join(dir, f)) };
  }
  return Object.fromEntries(Object.entries(by).filter(([, v]) => v.record).map(([n, v]) => [n, v.record]));
}

const fence = (s) => {
  const text = String(s ?? "");
  const ticks = text.includes("```") ? "~~~~" : "```";
  return `${ticks}\n${text}\n${ticks}`;
};

function writeAnswer(show, season, episode, record, { again = false } = {}) {
  const dir = dirOf(show, season);
  fs.mkdirSync(dir, { recursive: true });
  let stem;
  if (!record.ok) {
    let k = 1;
    while (fs.existsSync(path.join(dir, `e${pad(episode)}.fail${k}.json`))) k += 1;
    stem = `e${pad(episode)}.fail${k}`;
  } else {
    stem = `e${pad(episode)}`;
    let k = 1;
    while (fs.existsSync(path.join(dir, `${stem}${k === 1 ? "" : `.${k}`}.json`))) k += 1;
    if (k > 1 && !again) throw new Error(`e${pad(episode)} is answered already (--again to ask it anew)`);
    if (k > 1) stem = `${stem}.${k}`;
  }
  fs.writeFileSync(path.join(dir, `${stem}.json`), JSON.stringify(record, null, 2), "utf8");
  writeSides(path.join(dir, stem), record);
  return path.join(dir, `${stem}.json`);
}

/** The prompt and the answer as Markdown beside a record, for reading (`base`: the record's path without .json). */
function writeSides(base, record) {
  const head = `# ${record.show} ${record.season} episode ${record.episode}: the format section (F2)\n`;
  fs.writeFileSync(`${base}.prompt.md`, `${head}\n## Prompt\n\n${fence(record.prompt)}\n`, "utf8");
  fs.writeFileSync(`${base}.answer.md`, `${head}\n## Answer\n\n${fence(record.answer || record.error)}\n\n## Format section, as read\n\n${fence(JSON.stringify(record.parsed && record.parsed.formatState, null, 2))}\n\n## Problems\n\n${(record.problems || []).map((p) => `- ${p}`).join("\n") || "none"}\n`, "utf8");
}

// ---------- the app's code, the database and the bot ----------

let app = null;
function appCode() {
  if (app) return app;
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) throw new Error("format-asks.js only reads a local database (AUTH_DATABASE_URL)");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BOT)) throw new Error("format-asks.js asks only a local bot (FORMAT_ASKS_BOT), never production's");
  const { Pool } = require("pg");
  app = { pool: new Pool({ connectionString: DB }), Research: require("../../db/episode-research.js") };
  return app;
}

/** The prompt for episode n of a season, with the state going in (goingInFor) and each person's group as staging would have it. */
async function promptFor(show, season, n, answers, t) {
  const { pool, Research } = appCode();
  const ctx = await Research.resolveSeasonResearchContext(pool, show, season, n);
  const goingIn = goingInFor(t, n, answers);
  // Each person's group as staging would have moved them: the cast list's, then every earlier answer's newGroup in order.
  const castGroups = { ...(ctx.castGroups || {}) };
  for (const k of Object.keys(answers).map(Number).filter((k) => k < n).sort((a, b) => a - b)) {
    for (const [name, group] of Object.entries((answers[k].parsed && answers[k].parsed.newGroup) || {})) castGroups[name] = group;
  }
  const asked = { ...ctx, castGroups, formatGoingIn: goingIn.state ? goingIn : null };
  return { ctx: asked, goingIn, prompt: Research.buildPastePrompt(asked, [], { structured: true }) };
}

/** The answer read the way the bot's run reads it (no database writes): the parse, the review's problems, who left. */
function readAnswer(ctx, answer) {
  const { Research } = appCode();
  const parsed = Research.parseJsonAnswer(Research.extractJsonObject(answer), Research.researchSchemaFor(ctx.format, false), "The answer");
  const review = Research.validateResearch(parsed, ctx.castNames, ctx.terms, ctx.format, { groups: ctx.castGroups, formatGoingIn: ctx.formatGoingIn, episode: ctx.episodeNumber });
  const left = review.entries.filter((e) => e.leftTheGame === "yes").map((e) => ctx.castNames.find((n) => low(n) === low(e.name)) || e.name);
  const newGroup = Object.fromEntries(review.entries.filter((e) => typeof e.newGroup === "string" && e.newGroup.trim()).map((e) => [e.name, e.newGroup.trim()]));
  return {
    parsed: { episodeTitle: parsed.episodeTitle ?? null, summary: parsed.summary ?? null, merged: parsed.merged ?? null, rulesNote: parsed.rulesNote ?? null, formatState: parsed.formatState ?? null, left, newGroup },
    problems: [...(parsed.repairs || []), ...review.problems, ...review.fatal],
  };
}

async function botFree() {
  try {
    const res = await fetch(`${BOT}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const body = await res.json();
    return !(body.busy && body.busy.length) && !(body.queued && Object.values(body.queued).some((x) => x > 0));
  } catch {
    return false;
  }
}

async function botAsk(prompt) {
  const res = await fetch(`${BOT}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": process.env.LLM_BROWSER_API_KEY || "", "User-Agent": "GameYourShow/1.0 (+https://gameyourshow.com)" },
    body: JSON.stringify({ provider: "chatgpt", prompt, search: true, max_wait: BOT_WAIT_S, keepalive: true }),
    signal: AbortSignal.timeout((BOT_WAIT_S + 30) * 1000),
  });
  const text = await res.text();
  let body = {};
  try {
    body = JSON.parse(text.trim());
  } catch {
    body = { detail: `not JSON (HTTP ${res.status}): ${text.trim().slice(0, 200)}` };
  }
  if (res.ok && body.response) return { answer: body.response, seconds: body.seconds ?? null };
  throw new Error(`the bot didn't answer: ${body.detail || `HTTP ${res.status}`}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Whether the tapes recorder is holding for a usage limit or a bot check (its state.json): then nobody should ask. */
function recorderLimited() {
  const s = readJson(path.join(TAPES, "state.json"));
  return !!(s && s.pausedUntil && Date.parse(s.pausedUntil) > Date.now() && /limit|bot check/.test(String(s.pauseWhy || "")));
}

const commitOf = () => {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: path.join(__dirname, "..", "..") }).toString().trim();
  } catch {
    return "unknown";
  }
};

function setOf(args, { episodes: need = true } = {}) {
  const rest = args.filter((a) => !a.startsWith("--"));
  if (!rest.length) return STUDY_SET;
  const [show, season, eps] = rest;
  const episodes = String(eps || "")
    .split(",")
    .flatMap((x) => {
      const m = x.match(/^(\d+)-(\d+)$/);
      return m ? Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, i) => Number(m[1]) + i) : [Number(x)];
    })
    .filter((x) => Number.isInteger(x) && x > 0);
  if (!show || !Number.isInteger(Number(season)) || (!episodes.length && need)) throw new Error("usage: <show> <season> <episodes, e.g. 4-10,16>");
  return [{ show, season: Number(season), episodes }];
}

async function ask(args) {
  const { looksLimited } = require("./tapes.js");
  const again = args.includes("--again");
  const max = Number((args.find((a) => a.startsWith("--max=")) || "").slice(6)) || Infinity;
  const pause = (Number((args.find((a) => a.startsWith("--pause=")) || "").slice(8)) || 75) * 1000;
  let asked = 0;
  let stop = false;
  process.on("SIGINT", () => {
    if (stop) process.exit(1);
    stop = true;
    console.log("Stopping after this question (Ctrl+C again to stop now)");
  });
  const left = [];
  for (const { show, season, episodes } of setOf(args.slice(1))) {
    const t = Study.loadTimeline(show, season);
    for (const n of episodes) {
      const answers = answersOf(show, season);
      if (!again && answers[n] && answers[n].ok) continue;
      if (stop || asked >= max) {
        left.push(`${show} ${season} e${n}`);
        continue;
      }
      if (recorderLimited()) {
        console.log("The tapes recorder is holding for a usage limit or a bot check: stopping.");
        stop = true;
        left.push(`${show} ${season} e${n}`);
        continue;
      }
      // The local bot answers one question at a time: wait for it, and once more a little later (the recorder may be
      // about to ask: it looks every minute).
      for (;;) {
        if (await botFree()) {
          await sleep(10_000 + Math.floor(Math.random() * 10_000));
          if (await botFree()) break;
        }
        await sleep(30_000);
      }
      const { ctx, goingIn, prompt } = await promptFor(show, season, n, answers, t);
      const t0 = Date.now();
      const record = { show, season, episode: n, at: new Date().toISOString(), commit: commitOf(), bot: { url: BOT, provider: "chatgpt" }, goingIn, castAsked: ctx.castNames, castGroups: ctx.castGroups, prompt, answer: null, ok: false, error: null, parsed: null, problems: [], seconds: null };
      try {
        const out = await botAsk(prompt);
        record.answer = out.answer;
        record.bot.seconds = out.seconds;
        if (looksLimited(out.answer) && !/^\s*\{/.test(out.answer)) throw Object.assign(new Error("the answer reads like a usage limit or a bot check"), { limited: true });
        const read = readAnswer(ctx, out.answer);
        record.parsed = read.parsed;
        record.problems = read.problems;
        record.ok = !!read.parsed.formatState;
        if (!record.ok) record.error = "no format section in the answer";
      } catch (e) {
        record.error = e instanceof Error ? e.message : String(e);
        if (e && e.limited) stop = true;
        if (looksLimited(record.error)) stop = true;
      }
      record.seconds = Math.round((Date.now() - t0) / 100) / 10;
      const file = writeAnswer(show, season, n, record, { again });
      asked += 1;
      const st = record.parsed && record.parsed.formatState;
      console.log(`${new Date().toISOString()}  ${show} ${season} e${pad(n)}  ${record.ok ? "ok" : "FAILED"}  ${record.seconds}s  going in: ${goingIn.from}${st ? `  ${st.playedAs}, ${Array.isArray(st.groups) ? `${st.groups.length} groups` : "groups not known"}, ${st.changes.length} change(s)` : `  ${record.error}`}  -> ${path.relative(TAPES, file)}`);
      if (!stop && asked < max) await sleep(pause);
    }
  }
  if (left.length) console.log(`Not asked this run: ${left.join(", ")}`);
}

/**
 * Every kept answer read again with the code as it stands (the parser, the review's checks), its raw answer and the state it
 * was asked with unchanged: the way a parser that changes is checked without asking again. Rewrites the files' read parts.
 */
async function reread(args) {
  const set = args.filter((a) => !a.startsWith("--")).length > 1 ? setOf(args, { episodes: false }) : STUDY_SET;
  const { pool, Research } = appCode();
  for (const { show, season } of set) {
    const dir = dirOf(show, season);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => /^e\d+(\.\d+)?\.json$/.test(x))) {
      const record = readJson(path.join(dir, f));
      if (!record || !record.answer) continue;
      const ctx = await Research.resolveSeasonResearchContext(pool, show, season, record.episode);
      const asked = { ...ctx, castNames: record.castAsked || ctx.castNames, castGroups: record.castGroups || ctx.castGroups, formatGoingIn: record.goingIn && record.goingIn.state ? record.goingIn : null };
      try {
        const read = readAnswer(asked, record.answer);
        Object.assign(record, { parsed: read.parsed, problems: read.problems, ok: !!read.parsed.formatState, error: read.parsed.formatState ? null : "no format section in the answer" });
      } catch (e) {
        Object.assign(record, { parsed: null, problems: [], ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      fs.writeFileSync(path.join(dir, f), JSON.stringify(record, null, 2), "utf8");
      writeSides(path.join(dir, f.replace(/\.json$/, "")), record);
      console.log(`${show} ${season} ${f}: ${record.ok ? "read" : record.error}`);
    }
  }
}

// ---------- printing ----------

const pct = (a, b) => (b ? `${a} of ${b}` : "-");
const changeCell = (m) =>
  m.rows.length || m.extra.length
    ? [
        ...m.rows.map((r) => `${r.expected.kind} ${r.expected.from}${r.expected.when ? `/${r.expected.when}` : ""}: ${r.kind ? `${r.from ? "" : `from ${r.got.from ?? "?"} `}${r.when ? "" : r.got.when ? `${r.got.when} ` : ""}${r.from && r.when ? "yes" : "partly"}${r.got.sure ? ` (${r.got.sure})` : ""}` : "missed"}`),
        ...m.extra.map((c) => `+${c.kind} ${c.from ?? "?"}${c.sure ? ` (${c.sure})` : ""}`),
      ].join("; ")
    : "none, none";

function scoreSeason(show, season, { md = false } = {}) {
  const t = Study.loadTimeline(show, season);
  const answers = answersOf(show, season);
  const scored = Object.keys(answers)
    .map(Number)
    .sort((a, b) => a - b)
    .map((n) => scoreAnswer(t, answers[n]));
  const lines = [];
  lines.push(md ? `\n**${t.title} (${show} ${season})**\n` : `== ${t.title} (${show} ${season}): ${scored.length} answer(s)`);
  if (md) lines.push("| Ep | Going in | Played as | Groups at the end | People | New | Went home as | Its changes (want: got) | Ours |", "|---|---|---|---|---|---|---|---|---|");
  for (const s of scored) {
    if (!s.ok) {
      lines.push(md ? `| ${s.episode} | ${s.goingIn} | ${s.why} | | | | | | |` : `E${pad(s.episode)}  not scored: ${s.why}`);
      continue;
    }
    const g = s.groups;
    const groups = !g.known ? "not known" : g.expected === 0 && g.extra === 0 ? "none, none" : `${g.found} of ${g.expected}${g.extra ? `, +${g.extra}` : ""}${g.by === "alt" ? " (next start)" : ""}`;
    const cells = [
      s.goingIn,
      `${s.playedAs.got}${s.playedAs.right ? "" : ` (want ${s.playedAs.want})`}`,
      groups,
      g.people ? pct(g.peopleRight, g.people) : "-",
      s.newcomers.want.length || s.newcomers.got.length ? `${s.newcomers.got.join(", ") || "none"}${s.newcomers.found === s.newcomers.want.length && !s.newcomers.extra ? "" : ` (want ${s.newcomers.want.join(", ") || "none"})`}` : "-",
      `${s.wentHomeAs.got}${s.wentHomeAs.right ? "" : ` (want ${s.wentHomeAs.want})`}`,
      changeCell(s.said),
      s.oursKnown ? changeCell(s.ours) : "can't compare",
    ];
    lines.push(md ? `| ${s.episode} | ${cells.join(" | ").replace(/\n/g, " ")} |` : `E${pad(s.episode)}  ${cells.join("  |  ")}`);
    if (!md && s.problems.length) lines.push(`      problems: ${s.problems.filter((p) => /formatState/.test(p)).join("; ") || "none in the format section"}`);
  }
  return { lines, scored };
}

function totalsLine(x, md) {
  const parts = [
    `answered ${x.answered} of ${x.asked}`,
    `played as right ${pct(x.playedAs, x.answered)}`,
    `who's with whom known ${pct(x.groupsKnown, x.answered)}, exactly right ${pct(x.groupsExact, x.answered)}`,
    `groups found ${pct(x.groupsFound, x.groupsExpected)} (+${x.groupsExtra} not there)`,
    `each person's group ${pct(x.peopleRight, x.people)}`,
    `newcomers ${pct(x.newcomersFound, x.newcomersWant)} (+${x.newcomersExtra})`,
    `went home as ${pct(x.wentHomeAs, x.answered)}`,
    `changes: the answer's own kind ${pct(x.saidKind, x.changes)}, its episode ${pct(x.saidFrom, x.changes)}, when ${pct(x.saidWhen, x.changes)}, +${x.saidExtra} not in the fixture`,
    `ours (grouping changes) ${pct(x.oursKind, x.groupingChanges)}, sure ${pct(x.oursSure, x.groupingChanges)}, +${x.oursExtra}${x.oursUnknown ? `, ${x.oursUnknown} answer(s) not comparable` : ""}`,
  ];
  return md ? parts.map((p) => `- ${p}`).join("\n") : parts.join("; ");
}

function score(args) {
  const md = args.includes("--md");
  const set = args.filter((a) => !a.startsWith("--")).length > 1 ? setOf(args.slice(1), { episodes: false }) : STUDY_SET;
  const all = [];
  for (const { show, season } of set) {
    const { lines, scored } = scoreSeason(show, season, { md });
    console.log(lines.join("\n"));
    if (scored.length) console.log((md ? "\n" : "   ") + totalsLine(totals(scored), md));
    all.push(...scored);
  }
  if (set.length > 1) console.log(`${md ? "\n**All**\n\n" : "\n== All: "}${totalsLine(totals(all), md)}`);
}

// ---------- F3: the format's state over time, built from the kept answers (pure but for answersOf) ----------

/**
 * The season's format state over time (src/lib/game/formats/format-timeline.js) built from the kept answers as the engine
 * builds it from stored research: each answer's format section and who it has going home; an episode between them not asked
 * again carried on, with the fixture's exits (its research's checklist has them); the groups going into the first asked
 * episode F1's truth, as F2's first asks were shown it. The cast: everyone the answers were asked about. Pure given the
 * answers: { tl, asked }.
 */
function timelineOf(t, answers) {
  const asked = Object.keys(answers).map(Number).filter((n) => answers[n] && answers[n].ok && answers[n].parsed).sort((a, b) => a - b);
  if (!asked.length) return { tl: null, asked };
  const exits = Study.exits(t);
  const reports = [];
  for (let n = asked[0]; n <= asked[asked.length - 1]; n++) {
    const a = asked.includes(n) ? answers[n].parsed : null;
    reports.push(a ? { episode: n, state: a.formatState, left: a.left || [], merged: a.merged } : { episode: n, state: null, left: [...exits].filter(([, v]) => v.episode === n).map(([k]) => k), merged: null });
  }
  const before = asked[0] > 1 ? truthAtEnd(t, asked[0] - 1) : null;
  const cast = [...new Set(asked.flatMap((n) => answers[n].castAsked || []))];
  return { tl: Timeline.buildTimeline(reports, { cast, start: before ? { after: asked[0] - 1, state: before, sure: true } : null }), asked };
}

/** Whether the fixture has episode n played without the groups that went into it (an individual episode between grouped ones). */
function apartIn(t, n) {
  const e = t.episodes.find((x) => x.n === n);
  const prev = t.episodes.filter((x) => x.n < n && x.play !== "none").pop();
  return !!(e && prev && ["individuals", "everyone"].includes(e.play) && GROUPED.has(prev.play));
}

/**
 * The timeline against F1's fixture, over the asked episodes. Per episode: who is with whom at its end (as the answer said it,
 * against the fixture's truth, either state counting at an end before a change at the next start), whether the timeline
 * calls it sure, whether it was played apart (the fixture's, the timeline's), and who went home as a whole group (the fixture's,
 * ours from the exits, the answer's word). Then the changes: every grouping change the timeline calls sure (what a game's
 * structure would move on) against the fixture's (kind and the episode it takes effect; a swap of every group as itself), the
 * fixture's within reach (shown in an asked episode) found sure, unsure or not at all, and the groups' lifetimes against the
 * fixture's (the episodes each played, for groups the fixture has). Pure.
 */
function scoreTimeline(t, tl, asked) {
  const rows = asked.filter((n) => truthAtEnd(t, n)).map((n) => {
    const e = Timeline.at(tl, n);
    const truth = truthAtEnd(t, n);
    const main = groupScore(e.end, truth);
    const alt = truth.alt ? groupScore(e.end, truth.alt) : null;
    const groups = alt && alt.exact && !main.exact ? alt : main;
    return { episode: n, sure: e.sure, why: e.why, groups, apart: { want: apartIn(t, n), got: !!(e.played && e.played.apart && divided(e.played) === false && Timeline.goingInto(tl, n).divided) }, home: { want: truth.wentHomeAs, ours: e.wentHomeAs.ours, theirs: e.wentHomeAs.theirs } };
  });
  const fixture = Study.changes(t).filter((c) => FS.GROUPING_KINDS.includes(c.kind) && c.kind !== "newcomer");
  const reach = fixture.filter((c) => asked.includes(c.shown ? c.shown[0] : c.from[0]));
  const ours = tl.episodes.filter((e) => asked.includes(e.episode)).flatMap((e) => e.changes.filter((c) => FS.GROUPING_KINDS.includes(c.kind) && c.kind !== "newcomer" && !c.ahead).map((c) => ({ ...c, at: Timeline.effective(c, e.episode) })));
  const same = (c, f) => c.kind === f.kind && c.at === f.from[0] && (c.kind !== "swap" || !!c.allNew === !!f.allNew);
  const sure = ours.filter((c) => c.sure === "high" && c.by === "both");
  // Each of ours used once, a sure one before an unsure one, the same kind of swap before another.
  const isSure = (c) => c.sure === "high" && c.by === "both";
  const pool = [...ours].sort((a, b) => Number(isSure(b)) - Number(isSure(a)));
  const take = (test) => {
    const i = pool.findIndex(test);
    return i >= 0 ? pool.splice(i, 1)[0] : null;
  };
  const found = reach
    .map((f) => ({ f, hit: take((c) => same(c, f)) }))
    .map(({ f, hit }) => ({ f, hit: hit || take((c) => c.kind === f.kind && c.at === f.from[0]) }))
    .map(({ f, hit }) => ({ kind: f.kind, from: f.from[0], allNew: f.allNew, got: hit ? (isSure(hit) ? "sure" : "unsure") : "missed", exact: !!hit && same(hit, f) }));
  const lines = Object.values(t.groupings || {}).some((g) => !g.label) ? Object.keys(t.groupings).filter((l) => !t.groupings[l].label).flatMap((l) => Study.lifetimes(t, l).groups) : [];
  const lo = asked[0];
  const hi = asked[asked.length - 1];
  const life = tl.groups
    .filter((g) => g.played.some((n) => asked.includes(n)))
    .map((g) => {
      // The same people can be together again later (a new group, Q4): the fixture's line is the one it overlaps most. Its
      // episodes are the ones played in groups (a fixed grouping is still listed while everyone plays alone).
      const keys = (l) => [...l.keys].map((k) => FS.keyOf(k.split(" + ")));
      const overlap = (l) => l.episodes.filter((n) => g.played.includes(n)).length;
      const line = lines.filter((l) => keys(l).includes(FS.keyOf(g.members)) || keys(l).includes(FS.keyOf(g.now))).sort((x, y) => overlap(y) - overlap(x))[0];
      const grouped = (n) => GROUPED.has((t.episodes.find((e) => e.n === n) || {}).play);
      const want = line ? line.episodes.filter((n) => n >= lo && n <= hi && grouped(n)) : null;
      const got = g.played.filter((n) => n >= lo && n <= hi);
      return { id: g.id, known: !!line, right: !!line && want.join() === got.join(), want, got };
    });
  return {
    rows,
    sure: sure.map((c) => ({ id: c.id, kind: c.kind, at: c.at, allNew: c.allNew, right: fixture.some((f) => same(c, f)) })),
    found,
    life,
  };
}

const divided = (p) => !!p && Array.isArray(p.groups) && p.groups.length > 1;

function timelineSeason(show, season, { md = false } = {}) {
  const t = Study.loadTimeline(show, season);
  const { tl, asked } = timelineOf(t, answersOf(show, season));
  const out = [md ? `\n**${t.title} (${show} ${season})**\n` : `== ${t.title} (${show} ${season}): episodes ${asked.join(", ")}`];
  if (!tl) return { lines: [...out, "no answers"], score: null };
  const s = scoreTimeline(t, tl, asked);
  if (md) out.push("| Ep | Groups at the end | Sure | Played apart | Went home as (ours / the answer's) |", "|---|---|---|---|---|");
  for (const r of s.rows) {
    const g = r.groups;
    const cells = [
      !g.known ? "not known" : g.expected === 0 && g.extra === 0 ? "none, none" : `${g.found} of ${g.expected}${g.extra ? `, +${g.extra}` : ""}`,
      r.sure ? "sure" : `unsure: ${r.why.join("; ")}`,
      r.apart.want || r.apart.got ? `${r.apart.got ? "yes" : "no"}${r.apart.got === r.apart.want ? "" : ` (want ${r.apart.want ? "yes" : "no"})`}` : "-",
      `${r.home.ours}${r.home.ours === r.home.want ? "" : ` (want ${r.home.want})`} / ${r.home.theirs}`,
    ];
    out.push(md ? `| ${r.episode} | ${cells.join(" | ")} |` : `E${pad(r.episode)}  ${cells.join("  |  ")}`);
  }
  const say = (x) => `${x.kind}${x.allNew ? " (every group new)" : ""} from ${x.at ?? x.from}`;
  out.push(
    `${md ? "\n- " : "   "}sure changes (what a game's structure would move on): ${s.sure.length ? s.sure.map((c) => `${say(c)}${c.right ? "" : " WRONG"}`).join("; ") : "none"}`,
    `${md ? "- " : "   "}the fixture's grouping changes within reach: ${s.found.length ? s.found.map((f) => `${say(f)}: ${f.got}${f.got !== "missed" && !f.exact ? " (another kind of swap)" : ""}`).join("; ") : "none"}`,
    `${md ? "- " : "   "}lifetimes: ${s.life.filter((l) => l.known).length} of ${s.life.length} groups the fixture has, ${s.life.filter((l) => l.right).length} with the episodes it played exactly${s.life.filter((l) => l.known && !l.right).length ? ` (off: ${s.life.filter((l) => l.known && !l.right).map((l) => `${l.got.join(",")} for ${l.want.join(",")}`).join("; ")})` : ""}`,
    `${md ? "- " : "   "}side stages (held 2): ${Timeline.sideStages(tl).filter((x) => x.opens).map((x) => `after ${x.opensAfter}${x.closesAfter ? `, closed after ${x.closesAfter}` : ""}${x.sure ? "" : " (unsure)"}`).join("; ") || "none"}`,
    `${md ? "- " : "   "}newcomers: ${tl.newcomers.map((x) => `${x.name} (${x.episode}${x.replaces ? `, for ${x.replaces}` : ""})`).join("; ") || "none"}`
  );
  return { lines: out, score: s };
}

function timelineTotals(scores) {
  const rows = scores.flatMap((s) => s.rows);
  const sure = scores.flatMap((s) => s.sure);
  const found = scores.flatMap((s) => s.found);
  const life = scores.flatMap((s) => s.life);
  return [
    `episodes ${rows.length}: sure ${rows.filter((r) => r.sure).length}; groups at the end exactly right ${rows.filter((r) => r.groups.known && r.groups.found === r.groups.expected && !r.groups.extra).length}`,
    `played apart ${pct(rows.filter((r) => r.apart.want && r.apart.got).length, rows.filter((r) => r.apart.want).length)} (+${rows.filter((r) => r.apart.got && !r.apart.want).length} not)`,
    `went home as: ours ${pct(rows.filter((r) => r.home.ours === r.home.want).length, rows.length)}, the answer's ${pct(rows.filter((r) => r.home.theirs === r.home.want).length, rows.length)}`,
    `sure grouping changes ${sure.length}, right ${sure.filter((c) => c.right).length}, wrong ${sure.filter((c) => !c.right).length}`,
    `the fixture's within reach ${found.length}: sure ${found.filter((f) => f.got === "sure").length}, unsure ${found.filter((f) => f.got === "unsure").length}, missed ${found.filter((f) => f.got === "missed").length}`,
    `lifetimes: ${pct(life.filter((l) => l.right).length, life.filter((l) => l.known).length)} exactly (${life.filter((l) => !l.known).length} groups the fixture doesn't have)`,
  ];
}

function timeline(args) {
  const md = args.includes("--md");
  const set = args.filter((a) => !a.startsWith("--")).length > 1 ? setOf(args.slice(1), { episodes: false }) : STUDY_SET;
  const scores = [];
  for (const { show, season } of set) {
    const { lines, score: s } = timelineSeason(show, season, { md });
    console.log(lines.join("\n"));
    if (s) scores.push(s);
  }
  if (scores.length) console.log(`${md ? "\n**All**\n\n" : "\n== All: "}${timelineTotals(scores).map((x) => (md ? `- ${x}` : x)).join(md ? "\n" : "; ")}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "plan") {
    for (const { show, season, episodes } of STUDY_SET) {
      const answers = answersOf(show, season);
      const todo = episodes.filter((n) => !(answers[n] && answers[n].ok));
      console.log(`${show} ${season}: ${todo.length ? `asks ${todo.join(", ")}` : "all answered"}${todo.length < episodes.length ? ` (answered: ${episodes.filter((n) => !todo.includes(n)).join(", ")})` : ""}`);
    }
  } else if (cmd === "prompt") {
    const [{ show, season, episodes }] = setOf(rest);
    const t = Study.loadTimeline(show, season);
    console.log((await promptFor(show, season, episodes[0], answersOf(show, season), t)).prompt);
  } else if (cmd === "reread") await reread(rest);
  else if (cmd === "ask") await ask(["ask", ...rest]);
  else if (cmd === "score") score(["score", ...rest]);
  else if (cmd === "timeline") timeline(["timeline", ...rest]);
  else {
    console.error("usage: format-asks.js plan | prompt <show> <season> <ep> | reread [<show> <season>] | ask [<show> <season> <eps>] [--again] [--max=N] [--pause=75] | score [<show> <season>] [--md] | timeline [<show> <season>] [--md]");
    process.exitCode = 2;
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e && e.stack ? e.stack : e);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (app) await app.pool.end().catch(() => {});
    });
}

module.exports = { STUDY_SET, promptFor, readAnswer, appCode: () => appCode(), truthAtEnd, changesReportedIn, goingInFor, divisionOf, groupScore, matchChanges, scoreAnswer, totals, answersOf, dirOf, timelineOf, apartIn, scoreTimeline };
