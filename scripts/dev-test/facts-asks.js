// Dev-only: A13 part 2's proof (docs/PLAN-start-a-game-gpt.md step A13; what it found is in docs/STUDY-format-changes.md,
// "A13 part 2: episode facts asked again"). Asks recorded episodes again with the research prompt's episode facts section
// (db/episode-research.js episodeFacts: who says the episode's title quote, and how sure), the whole full-research prompt as the
// bot's run sends it (format-asks.js promptFor: the state going in as F2's answers had it), through the LOCAL bot only, keeps each
// answer beside the season's tapes (never over a tape), and scores each answer's facts:
//   - against the truth on file (tests/fixtures/title-quotes.json: who said each title, from a source that says it), each answer
//     right (sure, the right person), wrong (sure, someone else: the one that would settle a game wrongly), or void (research not
//     sure, the title not a line, someone outside the cast: no points either way, the grader's fallback);
//   - and, with or without truth, how often research said it for sure (settled of asked: episode-facts.js measure), the rate the
//     rating is built from (ratingOf: reliable from 90%), per season and overall.
//
//   node scripts/dev-test/facts-asks.js plan                          the proof's set: what `ask` would ask next, in order
//   node scripts/dev-test/facts-asks.js ask [<show> <season> <eps>] [--again] [--max=N] [--pause=60]
//                                                                     asks what isn't answered yet (the set, or episodes "1-10")
//   node scripts/dev-test/facts-asks.js focus <show> <season> <eps>    the experiment: the title quote asked on its own (focus())
//   node scripts/dev-test/facts-asks.js score [--md] [--write] [--focus]        each answer scored, then per season and overall; --write puts
//                                                                     the tapes' measure in src/lib/game/formats/fact-measures.json
//
// The set: Survivor 49 1-10 (its titles are castaways' lines; truth for most), The Challenge 41 2, 6 and 7 and The Traitors 4 2 and 5
// (their titles are often lines too; no truth on file), The Challenge 40 4 and 6 (titles that are puns on its theme).
//
// Where: ~\rfl-tapes\<show>\<season>\facts\e<NN>.json (TAPES_DIR moves it), .answer.md beside it; a new ask of an answered episode
// (--again) is e<NN>.2.json and on, a failed one e<NN>.fail<k>.json; scoring reads the latest. Needs what format-asks.js needs: the
// lane's .env.local (a local database with the seasons loaded: `tapes.js load <show> <season>`; LLM_BROWSER_API_KEY), F1's fixtures
// (the state going in), and for `ask` the local bot at http://127.0.0.1:8765. Never production's bot: this lane's
// LLM_BROWSER_API_URL lists it first, so it isn't read; FACTS_ASKS_BOT may name another local one. The local bot answers one
// question at a time and the tapes recorder uses it too: `ask` waits until it's free and pauses between its own questions. It
// writes nothing to the database. Stop with Ctrl+C (after this question).
"use strict";
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const FA = require("./format-asks.js");
const Study = require("./format-study.js");
const Facts = require("../../src/lib/game/formats/episode-facts.js");
const TRUTH = require("../../tests/fixtures/title-quotes.json");

const TAPES = process.env.TAPES_DIR || path.join(os.homedir(), "rfl-tapes");
const BOT = (process.env.FACTS_ASKS_BOT || "http://127.0.0.1:8765").replace(/\/$/, "");
const BOT_WAIT_S = Number(process.env.BOT_WAIT_S) || 420;

const SET = [
  { show: "survivor", season: 49, episodes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { show: "the-challenge", season: 41, episodes: [2, 6, 7] },
  { show: "the-traitors-us", season: 4, episodes: [2, 5] },
  { show: "the-challenge", season: 40, episodes: [4, 6] },
];

const pad = (n) => String(n).padStart(2, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};
const dirOf = (show, season) => path.join(TAPES, show, String(season), "facts");

/** Each episode's latest kept answer that reads, by number. */
function answersOf(show, season) {
  const dir = dirOf(show, season);
  if (!fs.existsSync(dir)) return {};
  const by = {};
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^e(\d+)(?:\.(\d+))?\.json$/);
    if (!m) continue;
    const n = Number(m[1]);
    const k = Number(m[2] || 1);
    const record = readJson(path.join(dir, f));
    if (record && (!by[n] || by[n].k < k)) by[n] = { k, record };
  }
  return Object.fromEntries(Object.entries(by).map(([n, v]) => [n, v.record]));
}

function writeAnswer(show, season, episode, record, { again = false } = {}) {
  const dir = dirOf(show, season);
  fs.mkdirSync(dir, { recursive: true });
  let stem = `e${pad(episode)}`;
  let k = 1;
  if (!record.ok) {
    while (fs.existsSync(path.join(dir, `${stem}.fail${k}.json`))) k += 1;
    stem = `${stem}.fail${k}`;
  } else {
    while (fs.existsSync(path.join(dir, `${stem}${k === 1 ? "" : `.${k}`}.json`))) k += 1;
    if (k > 1 && !again) throw new Error(`e${pad(episode)} is answered already (--again to ask it anew)`);
    if (k > 1) stem = `${stem}.${k}`;
  }
  fs.writeFileSync(path.join(dir, `${stem}.json`), JSON.stringify(record, null, 2), "utf8");
  fs.writeFileSync(path.join(dir, `${stem}.answer.md`), `# ${show} ${season} episode ${episode}\n\n${record.answer || record.error || ""}\n`, "utf8");
  return path.join(dir, `${stem}.json`);
}

/** The focus experiment's answers, by episode. */
function focusOf(show, season) {
  const dir = path.join(dirOf(show, season), "focus");
  if (!fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => /^e\d+\.json$/.test(f)).map((f) => readJson(path.join(dir, f))).filter(Boolean).map((r) => [r.episode, r]));
}

/** The answer's episode facts, read as the bot's run reads an answer (no database writes). */
function readAnswer(ctx, answer) {
  const { Research } = FA.appCode();
  const parsed = Research.parseJsonAnswer(Research.extractJsonObject(answer), Research.researchSchemaFor(ctx.format, false), "The answer");
  return { episodeTitle: parsed.episodeTitle ?? null, episodeFacts: parsed.episodeFacts ?? null, repairs: parsed.repairs || [] };
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

function setOf(args) {
  const rest = args.filter((a) => !a.startsWith("--"));
  if (!rest.length) return SET;
  const [show, season, eps] = rest;
  const episodes = String(eps || "")
    .split(",")
    .flatMap((x) => {
      const m = x.match(/^(\d+)-(\d+)$/);
      return m ? Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, i) => Number(m[1]) + i) : [Number(x)];
    })
    .filter((x) => Number.isInteger(x) && x > 0);
  if (!show || !Number.isInteger(Number(season)) || !episodes.length) throw new Error("usage: <show> <season> <episodes, e.g. 1-10>");
  return [{ show, season: Number(season), episodes }];
}

async function ask(args) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BOT)) throw new Error("facts-asks.js asks only a local bot (FACTS_ASKS_BOT), never production's");
  const { looksLimited } = require("./tapes.js");
  const again = args.includes("--again");
  const max = Number((args.find((a) => a.startsWith("--max=")) || "").slice(6)) || Infinity;
  const pause = (Number((args.find((a) => a.startsWith("--pause=")) || "").slice(8)) || 60) * 1000;
  let asked = 0;
  let stop = false;
  process.on("SIGINT", () => {
    if (stop) process.exit(1);
    stop = true;
    console.log("Stopping after this question (Ctrl+C again to stop now)");
  });
  for (const { show, season, episodes } of setOf(args.slice(1))) {
    const t = Study.loadTimeline(show, season);
    for (const n of episodes) {
      if (stop || asked >= max) break;
      const have = answersOf(show, season);
      if (!again && have[n] && have[n].ok) continue;
      // One question at a time: wait until the bot's free, and again a little later (the recorder looks every minute).
      for (;;) {
        if (await botFree()) {
          await sleep(10_000 + Math.floor(Math.random() * 10_000));
          if (await botFree()) break;
        }
        await sleep(30_000);
      }
      const { ctx, prompt } = await FA.promptFor(show, season, n, FA.answersOf(show, season), t);
      const t0 = Date.now();
      const record = { show, season, episode: n, at: new Date().toISOString(), bot: { url: BOT, provider: "chatgpt" }, castAsked: ctx.castNames, prompt, answer: null, ok: false, error: null, read: null, seconds: null };
      try {
        const out = await botAsk(prompt);
        record.answer = out.answer;
        record.bot.seconds = out.seconds;
        if (looksLimited(out.answer) && !/^\s*\{/.test(out.answer)) throw Object.assign(new Error("the answer reads like a usage limit or a bot check"), { limited: true });
        record.read = readAnswer(ctx, out.answer);
        record.ok = !!record.read.episodeFacts;
        if (!record.ok) record.error = "no episode facts in the answer";
      } catch (e) {
        record.error = e instanceof Error ? e.message : String(e);
        if ((e && e.limited) || looksLimited(record.error)) stop = true;
      }
      record.seconds = Math.round((Date.now() - t0) / 100) / 10;
      const file = writeAnswer(show, season, n, record, { again });
      asked += 1;
      const tq = record.read && record.read.episodeFacts && record.read.episodeFacts.titleQuote;
      console.log(`${new Date().toISOString()}  ${show} ${season} e${pad(n)}  ${record.ok ? "ok" : "FAILED"}  ${record.seconds}s  ${tq ? `"${record.read.episodeTitle}": ${tq.isQuote}, ${tq.by || "nobody"} (${tq.sure})` : record.error}  -> ${path.relative(TAPES, file)}`);
      if (!stop && asked < max) await sleep(pause);
    }
  }
}

/**
 * The experiment beside the proof (`focus`): the title quote asked on its own, a short prompt of its own after the full run (as the
 * trivia run is), with the episode's title from the full run's answer and the cast list, to see whether it settles the weeks the
 * section left unsure. Kept in facts\focus\, scored by `score --focus`. Not what research asks: a recommendation's evidence.
 */
function focusPrompt(show, season, n, title, cast) {
  return [
    `${show === "survivor" ? "Survivor" : show === "the-challenge" ? "The Challenge" : show === "the-traitors-us" ? "The Traitors (US)" : show} season ${season}, episode ${n}, titled "${title}".`,
    "",
    "Many shows title each episode with a line someone says in it. Search for who says this episode's title: recaps, episode stats",
    "pages and the episode's own page often say \"the episode title was said by ...\" (search for the title with \"title quote\" or",
    "\"said by\"). Answer from pages you read, not memory.",
    "",
    "The cast:",
    ...cast.map((c, i) => `${i + 1}. ${c}`),
    "",
    "Answer with JSON only: { \"isQuote\": \"yes\" | \"no\" | \"unknown\", \"line\": the line as said or null, \"by\": who says it (a name from the",
    "list exactly as written; for someone not on it, their name as the show gives it) or null, \"sure\": \"high\" only if a source says",
    "plainly who says it, else \"low\" }. 'no' only if a source shows the title isn't a line from the episode.",
  ].join("\n");
}

async function focus(args) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BOT)) throw new Error("facts-asks.js asks only a local bot (FACTS_ASKS_BOT), never production's");
  const [show, season, eps] = args.filter((a) => !a.startsWith("--"));
  const episodes = setOf([show, season, eps])[0].episodes;
  const full = answersOf(show, Number(season));
  for (const n of episodes) {
    const rec = full[n];
    if (!rec || !rec.read || !rec.read.episodeTitle) continue;
    for (;;) {
      if (await botFree()) break;
      await sleep(15_000);
    }
    const prompt = focusPrompt(show, season, n, rec.read.episodeTitle, rec.castAsked || []);
    const record = { show, season: Number(season), episode: n, at: new Date().toISOString(), castAsked: rec.castAsked, prompt, answer: null, ok: false, read: null };
    try {
      const out = await botAsk(prompt);
      record.answer = out.answer;
      const raw = JSON.parse(out.answer.slice(out.answer.indexOf("{"), out.answer.lastIndexOf("}") + 1));
      record.read = { episodeTitle: rec.read.episodeTitle, episodeFacts: Facts.looseEpisodeFacts({ titleQuote: raw }) };
      record.ok = true;
    } catch (e) {
      record.error = e instanceof Error ? e.message : String(e);
    }
    const dir = path.join(dirOf(show, season), "focus");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `e${pad(n)}.json`), JSON.stringify(record, null, 2), "utf8");
    const tq = record.read && record.read.episodeFacts.titleQuote;
    console.log(`${show} ${season} e${pad(n)} focus: ${tq ? `${tq.isQuote}, ${tq.by || "nobody"} (${tq.sure})` : record.error}`);
    await sleep(20_000);
  }
}

/** One answer scored: its outcome as the grader reads it, and against the truth on file. Pure. */
function scoreOne(show, season, record) {
  const cast = (record.castAsked || []).map((name) => ({ id: name, name }));
  const section = record.read && record.read.episodeFacts;
  const o = Facts.outcomeOf(section, "titleQuote", cast);
  const tq = section && section.titleQuote;
  const truthName = ((TRUTH.seasons[`${show}/${season}`] || {}).episodes || {})[record.episode];
  const truth = truthName ? Facts.personIn(cast, truthName, true) || truthName : null;
  // right or wrong: sure of someone in the cast (a game scores it); outside: sure of someone the cast doesn't have by that exact
  // name (a game voids it); void: not sure, or not a line; said: sure, with no truth on file.
  let verdict = "void";
  if (o && o.state === "who") verdict = truth ? (o.who === truth ? "right" : "wrong") : "said";
  else if (o && o.state === "outside") verdict = truth ? "outside" : "said";
  return { episode: record.episode, title: record.read && record.read.episodeTitle, isQuote: tq ? tq.isQuote : null, by: tq ? tq.by : null, sure: tq ? tq.sure : null, line: tq ? tq.line : null, outcome: o ? o.state : "none asked", truth, verdict };
}

function score(args) {
  const md = args.includes("--md");
  const read = args.includes("--focus") ? (show, season) => focusOf(show, season) : answersOf;
  const all = [];
  const lines = [];
  const shows = {};
  for (const { show, season } of SET.filter((s, i, a) => a.findIndex((x) => x.show === s.show && x.season === s.season) === i)) {
    const answers = read(show, season);
    const rows = Object.keys(answers)
      .map(Number)
      .sort((a, b) => a - b)
      .filter((n) => answers[n].ok)
      .map((n) => scoreOne(show, season, answers[n]));
    if (!rows.length) continue;
    all.push(...rows);
    // The tapes' measure (--write): the episodes asked, and those research settled a pick on (sure of someone in the cast), less any
    // the truth says it got wrong.
    const m = (shows[show] = shows[show] || { titleQuote: { asked: 0, settled: 0 }, seasons: [] });
    m.titleQuote.asked += rows.length;
    m.titleQuote.settled += rows.filter((r) => r.outcome === "who" && r.verdict !== "wrong").length;
    m.seasons.push(season);
    lines.push(md ? `\n**${show} ${season}**\n\n| Ep | Title | Is a line | Who (sure) | Read as | Truth | Verdict |\n|---|---|---|---|---|---|---|` : `== ${show} ${season}`);
    for (const r of rows) {
      const cells = [r.episode, r.title || "-", r.isQuote, r.by ? `${r.by} (${r.sure})` : `nobody (${r.sure})`, r.outcome, r.truth || "-", r.verdict];
      lines.push(md ? `| ${cells.join(" | ")} |` : `E${pad(r.episode)}  ${cells.slice(1).join("  |  ")}`);
    }
    lines.push(totalsLine(rows, md));
  }
  lines.push(md ? `\n**Overall:** ${totalsLine(all, false)}` : `== overall: ${totalsLine(all, false)}`);
  console.log(lines.join("\n"));
  if (args.includes("--write") && !args.includes("--focus")) {
    const file = path.join(__dirname, "..", "..", "src", "lib", "game", "formats", "fact-measures.json");
    const now = JSON.parse(fs.readFileSync(file, "utf8"));
    fs.writeFileSync(file, `${JSON.stringify({ about: now.about, measured: new Date().toISOString().slice(0, 10), shows }, null, 2)}\n`, "utf8");
    console.log(`wrote ${path.relative(process.cwd(), file)}: ${Object.entries(shows).map(([k, v]) => `${k} ${v.titleQuote.settled} of ${v.titleQuote.asked}`).join(", ")}`);
  }
}

function totalsLine(rows, md) {
  const asked = rows.length;
  const settled = rows.filter((r) => r.outcome === "who" || r.outcome === "outside").length;
  const withTruth = rows.filter((r) => r.truth);
  const right = withTruth.filter((r) => r.verdict === "right").length;
  const wrong = withTruth.filter((r) => r.verdict === "wrong").length;
  const outside = withTruth.filter((r) => r.verdict === "outside").length;
  const rated = asked >= Facts.MEASURED ? `rated ${Facts.ratingOf({ asked, settled }).rating}` : `too few to rate`;
  const line = `asked ${asked}, said for sure ${settled} (${asked ? Math.round((100 * settled) / asked) : 0}%, ${rated}); with truth on file ${withTruth.length}: ${right} right, ${wrong} wrong, ${outside} named outside the cast, ${withTruth.length - right - wrong - outside} void`;
  return md ? `\n${line}` : `   ${line}`;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "plan") {
    for (const { show, season, episodes } of SET) {
      const have = answersOf(show, season);
      console.log(`${show} ${season}: ${episodes.map((n) => `${n}${have[n] && have[n].ok ? " (done)" : ""}`).join(", ")}`);
    }
  } else if (cmd === "ask") await ask([cmd, ...rest]);
  else if (cmd === "focus") await focus(rest);
  else if (cmd === "score") score(rest);
  else console.log("usage: facts-asks.js plan | ask [<show> <season> <eps>] [--again] [--max=N] [--pause=60] | score [--md] [--write]");
  const a = FA.appCode && cmd === "ask" ? FA.appCode() : null;
  if (a && a.pool) await a.pool.end();
}

if (require.main === module) main().catch((e) => {
  console.error(e);
  process.exit(1);
});

module.exports = { SET, answersOf, scoreOne };
