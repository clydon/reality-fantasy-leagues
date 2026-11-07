// Dev-only: G1 part 4's measure (docs/PLAN-start-a-game-gpt.md step G1, "Part 4"; the numbers are in docs/STUDY-added-moments.md).
// The user's concern (the Decisions table's "A preset's rule"): what a moment's rating says research can answer may differ from
// what research actually returns each episode. So, on the season tapes (C:\Users\conor\rfl-tapes):
//   - rates: what research returned for every yes-or-no question it was asked, each recorded episode's full research (no bot):
//     how often an episode was settled (someone's answer yes, or everyone's no: what a "did it happen" question needs), how often
//     everyone's was (what "who did it" needs), and the share of people answered unknown;
//   - rate: the feasibility ask (game-words prompt.js momentPrompt, as our check asks it) for each of those questions on one season
//     of each show, the question left out of the moments it lists, and for moments the shows don't have (MORE);
//   - run: the added moments' own short ask (db/moments-research.js buildMomentsPrompt) for MORE on a few recorded episodes of each,
//     as the full run asks it when the checklist left one unknown (the worst case: asked as if the full run said nothing);
//   - score: each moment's rating beside what research returned (the tapes' rate for a question research asks, the run's for MORE).
//
//   node scripts/dev-test/moment-asks.js rates [--md]
//   node scripts/dev-test/moment-asks.js rate [<show>] [--again] [--pause=20]
//   node scripts/dev-test/moment-asks.js run [<show>] [--again] [--pause=30]
//   node scripts/dev-test/moment-asks.js score [--md]
//
// Where: ~\rfl-tapes\<show>\<season>\moments\rate\<id>.json and moments\run\e<NN>.json (TAPES_DIR moves it), never over a tape.
// Asks ONLY the local bot at http://127.0.0.1:8765 (MOMENT_ASKS_BOT may name another local one), never production's (this lane's
// LLM_BROWSER_API_URL lists it first, so it isn't read), with this folder's LLM_BROWSER_API_KEY; one question at a time, only
// while the bot is idle, pausing between its own. Writes nothing to the database. Stop with Ctrl+C (after this question).
"use strict";
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const { momentPrompt } = require("../../src/lib/game/game-words/prompt.js");
const { readMoment } = require("../../src/lib/game/game-words/read.js");
const MR = require("../../db/moments-research.js");

const TAPES = process.env.TAPES_DIR || path.join(os.homedir(), "rfl-tapes");
const BOT = (process.env.MOMENT_ASKS_BOT || "http://127.0.0.1:8765").replace(/\/$/, "");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BOT)) throw new Error("moment-asks asks a local bot only");
const BOT_WAIT_S = Number(process.env.BOT_WAIT_S) || 420;

const NAMES = { survivor: "Survivor", "the-challenge": "The Challenge", "the-traitors-us": "The Traitors", "below-deck": "Below Deck", "dancing-with-the-stars": "Dancing with the Stars" };
/** The season of each show the asks are about, and the episodes the short run asks. */
const ON = {
  survivor: { season: 50, episodes: [2, 5, 8, 11] },
  "the-challenge": { season: 41, episodes: [3, 7, 11, 15] },
  "the-traitors-us": { season: 4, episodes: [2, 5, 8, 10] },
  "below-deck": { season: 12, episodes: [3, 6, 9, 12] },
  "dancing-with-the-stars": { season: 34, episodes: [2, 4, 6, 8] },
};
/** Moments the shows' research doesn't answer, as someone would type them, with the question research would ask. */
const CRIED = { id: "cried", words: "someone cries", question: "This episode, who cried?" };
const MORE = {
  survivor: [
    CRIED,
    { id: "blindsided", words: "a blindside", question: "This episode, who was blindsided when they were voted out (sent home without seeing it coming)?" },
    { id: "hurt", words: "someone gets hurt or needs the medics", question: "This episode, who got hurt or needed medical attention?" },
    { id: "family", words: "someone talks about their family back home", question: "This episode, who talked about their family back home?" },
  ],
  "the-challenge": [
    CRIED,
    { id: "fight", words: "a fight breaks out", question: "This episode, who got into a physical fight or had to be pulled apart?" },
    { id: "hurt", words: "someone gets hurt", question: "This episode, who got hurt or needed medical attention?" },
    { id: "drunk", words: "someone gets drunk at a party", question: "This episode, who got drunk at a party or night out?" },
  ],
  "the-traitors-us": [
    CRIED,
    { id: "accused", words: "someone accuses someone at the round table", question: "This episode, who accused someone by name of being a Traitor at the Round Table?" },
    { id: "lastIn", words: "who walks into breakfast last", question: "This episode, who was the last to walk into breakfast?" },
  ],
  "below-deck": [
    CRIED,
    { id: "hookup", words: "a hookup", question: "This episode, who hooked up with (kissed or slept with) another crew member?" },
    { id: "drunk", words: "someone gets drunk on the crew night out", question: "This episode, who got drunk on a crew night out?" },
    { id: "complaint", words: "the guests complain about someone", question: "This episode, who did the charter guests complain about?" },
  ],
  "dancing-with-the-stars": [
    CRIED,
    { id: "ovation", words: "a standing ovation", question: "This episode, whose dance got a standing ovation?" },
    { id: "hurt", words: "someone gets injured", question: "This episode, who got injured or hurt, in rehearsal or on the night?" },
  ],
};

const pad = (n) => String(n).padStart(2, "0");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};
const flag = (args, name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split("=")[1]) : dflt;
};
const seasonDir = (show, season) => path.join(TAPES, show, String(season));
const shows = (args) => {
  const rest = args.filter((a) => !a.startsWith("--"));
  return rest.length ? rest : Object.keys(ON);
};

/** A recorded full research's stored answer: its people. */
function castawaysOf(show, season, n) {
  const j = readJson(path.join(seasonDir(show, season), `e${pad(n)}-full.json`));
  const p = j && j.parsed && (Array.isArray(j.parsed.castaways) ? j.parsed : j.parsed.parsed || j.parsed.merged);
  return p && Array.isArray(p.castaways) ? p.castaways : null;
}
/** Each yes-or-no question a season's full research was asked, with its words (from the recorded prompt's schema). */
function questionsOf(show, season) {
  const dir = seasonDir(show, season);
  const f = fs.readdirSync(dir).filter((x) => /^e\d+-full\.prompt\.md$/.test(x)).sort().pop();
  const text = f ? fs.readFileSync(path.join(dir, f), "utf8") : "";
  const out = {};
  const re = /"(\w+)": \{\s*"type": "string",\s*"enum": \[\s*"yes",\s*"no",\s*"unknown"\s*\],\s*"description": "([^"]+)"/g;
  for (let m; (m = re.exec(text)); ) if (!["leftTheGame"].includes(m[1])) out[m[1]] = m[2].replace(/,? this episode: yes, no, or unknown\.?$/i, "").trim();
  return out;
}

// ---------- rates (no bot) ----------

function ratesOf(show) {
  const seasons = fs.readdirSync(path.join(TAPES, show)).filter((s) => /^\d+$/.test(s)).map(Number).sort((a, b) => a - b);
  const by = {};
  for (const season of seasons) {
    for (let n = 1; n <= 40; n++) {
      const people = castawaysOf(show, season, n);
      if (!people) continue;
      const keys = new Set();
      for (const c of people) for (const [k, v] of Object.entries(c)) if (["yes", "no", "unknown"].includes(v)) keys.add(k);
      for (const k of keys) {
        const vals = people.map((c) => c[k]);
        const st = by[k] || (by[k] = { episodes: 0, settled: 0, whole: 0, happened: 0, unknown: 0, people: 0, seasons: new Set() });
        st.seasons.add(season);
        st.episodes++;
        const yes = vals.includes("yes");
        if (yes || vals.every((v) => v === "no")) st.settled++;
        if (vals.every((v) => v === "yes" || v === "no")) st.whole++;
        if (yes) st.happened++;
        st.unknown += vals.filter((v) => v !== "yes" && v !== "no").length;
        st.people += vals.length;
      }
    }
  }
  return by;
}

function rates(args) {
  const md = args.includes("--md");
  for (const show of Object.keys(ON)) {
    const by = ratesOf(show);
    console.log(md ? `\n**${NAMES[show]}**\n\n| Question | Episodes | Settled | Everyone | Unknown |\n|---|---|---|---|---|` : `\n${NAMES[show]}`);
    for (const [k, st] of Object.entries(by).sort()) {
      if (k === "leftTheGame") continue;
      const pc = (a, b) => `${Math.round((100 * a) / Math.max(1, b))}%`;
      console.log(md ? `| ${k} | ${st.episodes} | ${pc(st.settled, st.episodes)} | ${pc(st.whole, st.episodes)} | ${pc(st.unknown, st.people)} |` : `  ${k.padEnd(26)} ${String(st.episodes).padStart(3)} eps  settled ${pc(st.settled, st.episodes).padStart(4)}  everyone ${pc(st.whole, st.episodes).padStart(4)}  unknown ${pc(st.unknown, st.people).padStart(4)}`);
    }
  }
}

// ---------- the bot ----------

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
async function waitFree() {
  for (let i = 0; !(await botFree()); i++) {
    if (i % 10 === 0) console.log("  (the bot is busy: waiting)");
    await sleep(30000);
  }
}
async function botAsk(prompt, search) {
  await waitFree();
  const res = await fetch(`${BOT}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": process.env.LLM_BROWSER_API_KEY || "", "User-Agent": "GameYourShow/1.0 (+https://gameyourshow.com)" },
    body: JSON.stringify({ provider: "chatgpt", prompt, search, max_wait: BOT_WAIT_S, keepalive: true }),
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

// ---------- rate: the feasibility ask ----------

/** What a rating asks about each moment of a show: its questions research asks, then MORE. */
function toRate(show) {
  const { season } = ON[show];
  const qs = questionsOf(show, season);
  return [
    ...Object.entries(qs).map(([id, says]) => ({ id, words: says, kind: "asked", others: Object.entries(qs).filter(([k]) => k !== id).map(([k, s]) => ({ id: k, says: s })) })),
    ...MORE[show].map((m) => ({ ...m, kind: "more", others: Object.entries(qs).map(([k, s]) => ({ id: k, says: s })) })),
  ];
}

async function rate(args) {
  const again = args.includes("--again");
  const pause = flag(args, "pause", 20) * 1000;
  for (const show of shows(args)) {
    const { season } = ON[show];
    const dir = path.join(seasonDir(show, season), "moments", "rate");
    fs.mkdirSync(dir, { recursive: true });
    for (const m of toRate(show)) {
      const file = path.join(dir, `${m.id}.json`);
      if (!again && readJson(file)) continue;
      const pack = { page: `${NAMES[show]} season ${season}`, moments: m.others };
      const prompt = momentPrompt({ pack, moment: m.words });
      process.stdout.write(`${show} ${season} ${m.id}: `);
      try {
        const out = await botAsk(prompt, false);
        const read = readMoment(out.answer);
        fs.writeFileSync(file, JSON.stringify({ show, season, id: m.id, kind: m.kind, words: m.words, prompt, answer: out.answer, read, seconds: out.seconds, at: new Date().toISOString() }, null, 2));
        console.log(`${read && read.reliable} (${out.seconds}s)`);
      } catch (e) {
        console.log(`failed: ${e.message}`);
      }
      await sleep(pause);
    }
  }
}

// ---------- run: the short ask for MORE ----------

async function run(args) {
  const again = args.includes("--again");
  const pause = flag(args, "pause", 30) * 1000;
  for (const show of shows(args)) {
    const { season, episodes } = ON[show];
    const dir = path.join(seasonDir(show, season), "moments", "run");
    fs.mkdirSync(dir, { recursive: true });
    const meta = readJson(path.join(seasonDir(show, season), "season.json")) || {};
    for (const n of episodes) {
      const file = path.join(dir, `e${pad(n)}.json`);
      if (!again && readJson(file)) continue;
      const people = castawaysOf(show, season, n) || [];
      const cast = people.map((c) => c.name).filter(Boolean);
      const listed = (meta.episodes || []).find((e) => e && (e.number === n || e.episode_number === n));
      const moments = MORE[show].map((m) => ({ id: m.id, label: m.words, question: m.question, from: 1 }));
      const prompt = MR.buildMomentsPrompt({ showName: NAMES[show], season, episode: n, title: (listed && listed.title) || null, cast, moments });
      process.stdout.write(`${show} ${season} e${pad(n)}: `);
      try {
        const out = await botAsk(prompt, true);
        let read = null;
        try {
          read = MR.parseMomentsAnswer(out.answer, moments.map((m) => m.id), cast);
        } catch (e) {
          read = { error: e.message };
        }
        fs.writeFileSync(file, JSON.stringify({ show, season, episode: n, prompt, answer: out.answer, read, seconds: out.seconds, at: new Date().toISOString() }, null, 2));
        console.log(read && read.moments ? MR.momentsLine(read.moments) : `unread (${read && read.error})`);
      } catch (e) {
        console.log(`failed: ${e.message}`);
      }
      await sleep(pause);
    }
  }
}

// ---------- score ----------

function score(args) {
  const md = args.includes("--md");
  const rows = [];
  for (const show of Object.keys(ON)) {
    const { season, episodes } = ON[show];
    const by = ratesOf(show);
    const dir = path.join(seasonDir(show, season), "moments");
    // Each kept answer read again by today's parse (the cast from its own prompt), so a fix to the reading counts.
    const ids = MORE[show].map((m) => m.id);
    const runs = episodes
      .map((n) => readJson(path.join(dir, "run", `e${pad(n)}.json`)))
      .filter(Boolean)
      .map((r) => {
        const cast = (r.prompt.split("use their names exactly as written):")[1] || "").split("\n").map((l) => (l.match(/^\d+\. (.+)$/) || [])[1]).filter(Boolean);
        try {
          return { ...r, read: MR.parseMomentsAnswer(r.answer, ids, cast) };
        } catch {
          return null;
        }
      })
      .filter((r) => r && r.read && r.read.moments);
    for (const m of toRate(show)) {
      const r = readJson(path.join(dir, "rate", `${m.id}.json`));
      const rating = r && r.read ? r.read.reliable : "-";
      let settled = null;
      let n = 0;
      let happened = 0;
      if (m.kind === "asked" && by[m.id]) {
        n = by[m.id].episodes;
        settled = by[m.id].settled;
        happened = by[m.id].happened;
      } else if (m.kind === "more") {
        for (const run of runs) {
          const a = run.read.moments[m.id];
          n++;
          if (a && a.sure === "high" && (a.happened === "no" || (a.happened === "yes" && a.who.length))) settled++;
          if (a && a.happened === "yes") happened++;
        }
      }
      rows.push({ show: NAMES[show], id: m.id, kind: m.kind, rating, n, settled: settled || 0, happened, why: r && r.read ? r.read.why : "" });
    }
  }
  const pc = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "-");
  if (md) console.log("| Show | Moment | Research asks it | Rated | Episodes | Settled | Happened |\n|---|---|---|---|---|---|---|");
  for (const r of rows) {
    if (md) console.log(`| ${r.show} | ${r.id} | ${r.kind === "asked" ? "yes" : "no"} | ${r.rating} | ${r.n} | ${pc(r.settled, r.n)} | ${r.happened} |`);
    else console.log(`${r.show.padEnd(22)} ${r.id.padEnd(26)} ${r.kind.padEnd(6)} ${String(r.rating).padEnd(7)} ${String(r.n).padStart(3)} eps  settled ${pc(r.settled, r.n).padStart(4)}  happened ${r.happened}`);
  }
  // The rating against the rate: each rating's moments, and how many of them research settled at 90% or more, and under 70%.
  console.log("");
  for (const level of ["high", "medium", "low"]) {
    const of = rows.filter((r) => r.rating === level && r.n);
    const ok = of.filter((r) => r.settled / r.n >= 0.9).length;
    const poor = of.filter((r) => r.settled / r.n < 0.7).length;
    const avg = of.length ? of.reduce((s, r) => s + r.settled / r.n, 0) / of.length : 0;
    console.log(`${level}: ${of.length} moment(s), settled on average ${Math.round(avg * 100)}%; ${ok} at 90% or more, ${poor} under 70%`);
  }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "rates") return rates(args);
  if (cmd === "rate") return rate(args);
  if (cmd === "run") return run(args);
  if (cmd === "score") return score(args);
  if (cmd === "plan") {
    for (const show of shows(args)) console.log(`${show} ${ON[show].season}: rate ${toRate(show).map((m) => m.id).join(", ")}; run episodes ${ON[show].episodes.join(", ")}`);
    return;
  }
  console.log("usage: moment-asks.js rates|rate|run|score (see the header)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
