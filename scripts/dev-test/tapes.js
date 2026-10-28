// Dev-only: season tapes (docs/PLAN-playtests.md step P1). Records what the app's prompts return for whole seasons of real
// shows, asked of the user's LOCAL ask-AI bot (llm-browser-api, http://127.0.0.1:8765; never production's), and keeps each
// question's exact prompt, its raw answer and what the app's own parser made of it, side by side, so the seasons can be
// played back offline (P3's replays, any check) and a parser that changes can re-read the raw answers without asking again.
//
// Everything goes through the app's own code: db/bot-research.js runJob (quick, full, trivia, bingo: an admin's Run now,
// without `send`, so a full answer is staged for review and the season's next prompts know who's gone), the TypeScript
// server's own functions loaded with jiti as the unit tests do (add-show.ts listedSeason for a season from its TV listing,
// make-game.ts for a show that isn't a game yet, desk-rulebooks.ts for a set-up show's rulebook prompt), and ask-bot.ts
// askBot's request for every question (with a longer wait: botAsk). It keeps what each parser made; it copies no prompt.
//
// The tape: ~\rfl-tapes\<show>\<season>\ (C:\Users\<you>\rfl-tapes; TAPES_DIR to move it; outside every worktree, never in git)
//   season.json             the season: its listing, its episodes, its cast and compiled rulebook, and the ids made here
//   season-<kind>.json      a question about the season (rules, cast, bingo-season, recaps)
//   e<NN>-<kind>.json       one per question about episode NN: { kind, show, season, episode, prompt, answer, parsed, ok,
//                           message, seconds, at, bot, commit } (+ check: the same for a second ask, as trivia and bingo
//                           have; result: everything the app's run returned), with .prompt.md and .answer.md beside it
//   ...<kind>.try<N>.json   a failed try, kept (the queue asks again; the third failure is kept as the tape, ok: false)
// and rfl-tapes\journal.log (a line per question), rfl-tapes\state.json (the backoff), rfl-tapes\words\ (P2's corpus).
//
//   node scripts/dev-test/tapes.js record [--only=<show>:<season>] [--kinds=quick,full] [--pause=60] [--max=N]
//                                         the queue in the plan's order, resuming where it stopped (skips what's on tape)
//   node scripts/dev-test/tapes.js plan [--only=...]       what record would ask next, in order (asks nothing)
//   node scripts/dev-test/tapes.js status                  what's recorded, per show and season, and the last error
//   node scripts/dev-test/tapes.js one <show> <season> <kind> [<episode>]   one question now (the end-to-end check)
//   node scripts/dev-test/tapes.js one words <id>         one request of Start a game's words corpus (tapes-words.js)
//   node scripts/dev-test/tapes.js load <show> <season>    a tape into this lane's database (no bot; the tape untouched):
//                                                          the season from its listing, how it works and its cast from the
//                                                          recorded answers, each episode's full answer through the app's
//                                                          paste import, in episode order
//   node scripts/dev-test/tapes.js unload <show> <season>  takes out what the tapes made for it (a show they added, else the
//                                                          season they made from its listing, with its research)
//   require("./tapes").answerer(show, season)              (prompt, kind) => the recorded answer, for fake-bot.js's
//                                                          `answer`, so a check runs the app's real flows on a tape offline
//
// Needs: the lane's .env.local (AUTH_DATABASE_URL on localhost, LLM_BROWSER_API_URL naming only a local bot and its key),
// migrations run, and for record/one the local bot up. No dev server: the app's code runs in this process. Writes to the
// lane's database the way the app does (shows, seasons, episodes, cast, research, runs); a zt_tapes user owns what needs one.
// Those rows aren't zt- keyed, by design: they're real seasons of real shows, named as the app's prompts name them, on the
// lane's own copy (never production: it refuses a database that isn't local). `unload` takes out what it made; a season that
// was here before (the copy's own Survivor 49) is never touched beyond what the app itself writes when asked about it.
// All night, gently: one question at a time, a pause between them, backing off 5, 15 then 60 minutes on failures, and an hour
// on an answer that reads like a usage limit or a bot check.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const TAPES = process.env.TAPES_DIR || path.join(os.homedir(), "rfl-tapes");
const TVMAZE = "https://api.tvmaze.com";
const MIN = 60_000;

// ---------- what's recorded, and in what order (pure) ----------

// The plan's shows, each one's three most recent complete seasons by TVmaze (checked 2026-10-28), the first one first. Survivor
// 49's episodes are in the database already (researched before the tapes) and go on its tape as stored, not asked.
const SHOWS = [
  { key: "survivor", tvmaze: 114, seasons: [49, 50, 48], stored: [49] },
  { key: "the-traitors-us", tvmaze: 58177, seasons: [4, 3, 2] },
  { key: "the-challenge", tvmaze: 2100, seasons: [41, 40, 39] },
  { key: "dancing-with-the-stars", tvmaze: 71, seasons: [34, 33, 32] },
  { key: "below-deck", tvmaze: 2900, seasons: [12, 11, 10] },
];
// A season's own questions, then each episode's: its core (results), then its game content.
const CORE = ["quick", "full"];
const CONTENT = ["trivia", "bingo"];
const EPISODE_KINDS = [...CORE, ...CONTENT];
// A season's setup: its episodes' questions wait for these (a show that isn't a game yet needs its rules before its cast).
const SETUP = ["season", "rules", "cast"];
// Tries a question gets before the queue moves on (the bot's own runs get three too).
const TRIES = 3;
// Consecutive failures back off: 5, 15, then 60 minutes; a usage limit or a bot check, an hour.
const BACKOFF_MIN = [5, 15, 60];
const LIMITED_MIN = 60;

const pad = (n) => String(n).padStart(2, "0");
/** A question's file name (without .json): season-cast, e03-full; the season itself is season.json; a words request its id. */
const nameOf = (job) => (job.kind === "words" ? job.id : job.kind === "season" ? "season" : job.episode == null ? `season-${job.kind}` : `e${pad(job.episode)}-${job.kind}`);
const dirOf = (show, season) => path.join(TAPES, show, String(season));
const keyOf = (job) => `${job.show}/${job.season}/${nameOf(job)}`;

/**
 * Every question, in the plan's order (breadth first): (1) each show's first season, its core (the season, how it works, who's
 * in it, then each episode's quick and full research); (2) the words corpus (P2: each request, once it exists); (3) those
 * seasons' game content (each episode's trivia and bingo, the season's own bingo bank, its recaps); (4) second seasons, core then content;
 * (5) third. `episodesOf(show, season)`: how many episodes a season's tape knows (null until its season.json is written:
 * nothing after "season" is listed for it yet). `words`: the corpus's request ids. `only`: { show, season } to keep to one;
 * `kinds`: the kinds to keep (the season's setup, SETUP, always stays: its episodes' questions need it). Pure.
 */
function planJobs({ shows = SHOWS, episodesOf, words = [], only = null, kinds = null }) {
  const out = [];
  const keep = (job) => (!only || (job.show === only.show && (only.season == null || job.season === only.season))) && (!kinds || SETUP.includes(job.kind) || kinds.includes(job.kind));
  const push = (job) => keep(job) && out.push(job);
  const core = (show, season) => {
    push({ show: show.key, season, kind: "season", episode: null });
    const n = episodesOf(show.key, season);
    if (n == null) return;
    push({ show: show.key, season, kind: "rules", episode: null });
    push({ show: show.key, season, kind: "cast", episode: null });
    for (let e = 1; e <= n; e++) for (const kind of CORE) push({ show: show.key, season, kind, episode: e });
  };
  const content = (show, season) => {
    const n = episodesOf(show.key, season);
    if (n == null) return;
    for (let e = 1; e <= n; e++) for (const kind of CONTENT) push({ show: show.key, season, kind, episode: e });
    push({ show: show.key, season, kind: "bingo-season", episode: null });
    push({ show: show.key, season, kind: "recaps", episode: null });
  };
  for (const show of shows) core(show, show.seasons[0]);
  if (!only) for (const id of words) push({ show: "words", season: 0, kind: "words", episode: null, id });
  for (const show of shows) content(show, show.seasons[0]);
  for (const round of [1, 2]) {
    for (const show of shows) {
      if (show.seasons[round] == null) continue;
      core(show, show.seasons[round]);
      content(show, show.seasons[round]);
    }
  }
  return out;
}

/**
 * The episode whose full research gave up with no answer at all (three tries timed out), or null. Its season's other full
 * research waits behind it: three tries and the backoffs after each, for every episode, would hold the rest of the queue (the
 * words corpus) for a day. Built when Below Deck 12's 47,000-character prompt had no reply in 420 s; that was the bot's
 * ChatGPT profile, capped from 07:43 UTC on 2026-10-28, not the prompt (a fresh profile answered it in 52 s). Delete that
 * episode's e<NN>-full.json to ask again. `files` is readTape's. Pure.
 */
function fullHeld(files) {
  const stuck = files.filter((f) => f.kind === "full" && f.gaveUp && !String(f.answer || "").trim()).sort((a, b) => a.episode - b.episode);
  return stuck.length ? stuck[0].episode : null;
}

/**
 * Whether a season's questions about its people wait for its cast: a series' cast taken from its TV listing (the cast
 * record's `fromListing`, Make it a game asking no cast question, on a season whose rulebook is a series: make-game.ts
 * listingCast) is every season's crew, 40 people for Below Deck 12 with 3 of its own (PLAYTEST-REPORT.md finding 10). Each
 * full research, trivia and bingo prompt would ask about people who aren't on the season, to be asked again once a season
 * cast is staged. The quick checks go on (who left, in the show's own words), and what's on tape stays (Below Deck 12's
 * episodes 1 and 2, as the evidence). To lift it, stage the season's cast by hand (CAST_HELD_HOW). `cast` is season-cast.json's
 * record, `kind` the season's rulebook kind (season.json's rulebook.kind). Pure.
 */
function castHeld(cast, kind) {
  return !!(cast && cast.ok && cast.parsed && cast.parsed.fromListing && kind === "series");
}
const CAST_HELD_KINDS = ["full", "trivia", "bingo", "bingo-season", "recaps"];
const CAST_HELD_HOW =
  "stop the recorder, move season-cast.json to season-cast.listing.json, delete the season's season_cast rows, tapes.js one <show> <season> cast (the cast import), delete its e<NN>-full.json, start the recorder";

/** How long to wait (ms) after `failures` failures in a row: 5, 15, then 60 minutes. Pure. */
function backoffMs(failures) {
  if (failures <= 0) return 0;
  return BACKOFF_MIN[Math.min(failures, BACKOFF_MIN.length) - 1] * MIN;
}

/** Whether an answer or an error reads like ChatGPT's usage limit or a bot check (pause an hour, don't ask again). Pure. */
function looksLimited(text) {
  const t = String(text || "").toLowerCase();
  return [
    /you'?ve (hit|reached) (your|the|our) (usage |message )?limit/,
    /usage (cap|limit)/,
    /too many requests/,
    /\b429\b/,
    /rate.?limit/,
    /unusual activity/,
    /verify (that )?you are (a )?human/,
    /are you a robot/,
    /captcha/,
    /just a moment\.\.\./,
    /please try again (later|in)/,
    /limit (resets|will reset)/,
  ].some((re) => re.test(t));
}

/** What the queue does next, from the state (failures in a row, a pause) and the time: { wait: ms, why } or null. Pure. */
function holdFor(state, now) {
  const until = state.pausedUntil ? new Date(state.pausedUntil).getTime() : 0;
  if (until > now) return { wait: until - now, why: state.pauseWhy || "backing off" };
  return null;
}

/** A journal line: when, the question, how it went, how long, and the message, on one line. Pure. */
function journalLine(at, job, { ok, seconds, message, tries }) {
  const msg = String(message || "").replace(/\s+/g, " ").slice(0, 240);
  const what = job.kind === "words" ? `words ${job.id}` : `${job.show} ${job.season} ${job.episode == null ? "season" : `e${pad(job.episode)}`} ${job.kind}`;
  const how = ok ? "ok" : tries >= TRIES ? "GAVE UP" : `failed (try ${tries})`;
  return `${new Date(at).toISOString()}  ${what.padEnd(42)} ${how.padEnd(16)} ${seconds == null ? "" : `${seconds}s`.padStart(6)}  ${msg}`;
}

// ---------- reading a tape back (pure but for the files) ----------

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const hashOf = (s) => crypto.createHash("sha1").update(norm(s)).digest("hex").slice(0, 16);

/** Every question a tape's files hold that worked, as { kind, episode, prompt, answer, hash } (a second ask's too). A tape
 *  that gave up (ok: false) isn't one: its answer is what the app couldn't use. */
function asksOf(files) {
  const out = [];
  for (const t of files) {
    if (!t || t.answer == null || t.ok === false) continue;
    out.push({ kind: t.kind, episode: t.episode, prompt: t.prompt, answer: t.answer, hash: hashOf(t.prompt) });
    if (t.check && t.check.answer != null) out.push({ kind: `${t.kind}-check`, episode: t.episode, prompt: t.check.prompt, answer: t.check.answer, hash: hashOf(t.check.prompt) });
  }
  return out;
}

// fake-bot.js kindOf's kinds, as the tapes name them (a season's own bingo bank: the same prompt with no episode in it).
const TAPE_KIND = { setup: "rules", rulebook: "rules", bingoCheck: "bingo-check", quick: "quick", full: "full", bingo: "bingo", cast: "cast" };
// How a prompt names its episode: "episode 3", or the show's own word for one ("Week 3", "Race 3", "Game 3").
const EPISODE_IN = /\b(?:episode|week|race|game|night|part|event|leg|round|show)\s+(\d+)\b/i;

/**
 * The recorded answer for a prompt: the same prompt (whitespace aside) first; else, when kindOf names the kind, the same
 * kind of question about the same episode (a prompt the app words a little differently today; a bingo prompt with no
 * episode is the season's own bank); else null. `kind` is fake-bot.js kindOf's ("quick", "full", "bingo", "bingoCheck",
 * "setup", "cast", ...): trivia, its check and recaps are "other" there, so only their exact prompt is found. Pure.
 */
function pickAnswer(asks, prompt, kind) {
  const h = hashOf(prompt);
  const same = asks.find((a) => a.hash === h);
  if (same) return same.answer;
  let ours = TAPE_KIND[kind];
  if (!ours) return null;
  const ep = EPISODE_IN.exec(String(prompt || ""));
  const n = ep && ours !== "rules" && ours !== "cast" ? Number(ep[1]) : null;
  if (n == null && ours === "bingo") ours = "bingo-season";
  if (n == null && ours === "bingo-check") ours = "bingo-season-check";
  const like = asks.filter((a) => a.kind === ours && (n == null ? a.episode == null : a.episode === n));
  return like.length ? like[like.length - 1].answer : null;
}

// ---------- the files ----------

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

/** A tape's season.json and its question files (not the failed tries). */
function readTape(show, season) {
  const dir = dirOf(show, season);
  if (!fs.existsSync(dir)) return { season: null, files: [] };
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^(season-[a-z-]+|e\d+-[a-z-]+)\.json$/.test(f))
    .sort()
    .map((f) => readJson(path.join(dir, f)))
    .filter(Boolean);
  return { season: readJson(path.join(dir, "season.json")), files };
}

const onTape = (job) => (job.kind === "words" ? fs.existsSync(path.join(TAPES, "words", `${job.id}.json`)) : fs.existsSync(path.join(dirOf(job.show, job.season), `${nameOf(job)}.json`)));

/** How many episodes a season's tape has (null: no season.json yet). */
function episodesOnTape(show, season) {
  const s = readJson(path.join(dirOf(show, season), "season.json"));
  return s && Number.isInteger(s.episodeCount) ? s.episodeCount : null;
}

const fence = (text) => {
  const s = String(text ?? "");
  const ticks = s.includes("```") ? "~~~~" : "```";
  return `${ticks}\n${s}\n${ticks}`;
};

/** Writes one question's tape (or a failed try's), with the prompt and the answer as Markdown beside it for reading. */
function writeRecord(job, record, { tryNo = null } = {}) {
  const base = job.kind === "words" ? path.join(TAPES, "words", job.id) : path.join(dirOf(job.show, job.season), nameOf(job));
  const stem = tryNo ? `${base}.try${tryNo}` : base;
  writeJson(`${stem}.json`, record);
  if (tryNo) return;
  const head = `# ${job.kind === "words" ? `words ${job.id}` : `${job.show} ${job.season}${job.episode == null ? "" : ` episode ${job.episode}`}: ${job.kind}`}\n`;
  const part = (title, a) => (a && a.prompt != null ? `\n## ${title}\n\n${fence(a.prompt)}\n` : "");
  const ans = (title, a) => (a && a.answer != null ? `\n## ${title}\n\n${fence(a.answer)}\n` : "");
  fs.writeFileSync(`${base}.prompt.md`, head + part("Prompt", record) + part("Check prompt", record.check), "utf8");
  fs.writeFileSync(`${base}.answer.md`, head + ans("Answer", record) + ans("Check answer", record.check) + `\n## Parsed\n\n${fence(JSON.stringify(record.parsed, null, 2))}\n`, "utf8");
}

const statePath = () => path.join(TAPES, "state.json");
const loadState = () => readJson(statePath()) || { failuresInARow: 0, pausedUntil: null, pauseWhy: null, tries: {}, lastError: null };
const saveState = (s) => writeJson(statePath(), s);
function journal(line) {
  fs.mkdirSync(TAPES, { recursive: true });
  fs.appendFileSync(path.join(TAPES, "journal.log"), line + "\n", "utf8");
  console.log(line);
}

// ---------- the app's own code ----------

let app = null;
/** The app's modules, loaded once: the CommonJS research code directly, the TypeScript server through jiti (as the tests do). */
function appCode() {
  if (app) return app;
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) throw new Error("tapes.js only runs against a local database (AUTH_DATABASE_URL)");
  const bots = String(process.env.LLM_BROWSER_API_URL || "").split(",").map((u) => u.trim()).filter(Boolean);
  if (!bots.length || bots.some((u) => !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(u))) {
    throw new Error("LLM_BROWSER_API_URL must name only the local bot (http://127.0.0.1:8765), never production's");
  }
  // next/server's after() runs its work straight away here (the checks' stub), as there's no request to run it after.
  const jiti = require("jiti")(__filename, { alias: { "@db": path.join(ROOT, "db"), "@": path.join(ROOT, "src"), "next/server": path.join(__dirname, "next-after-stub.js") } });
  const ts = (f) => jiti(path.join(ROOT, "src", "lib", "server", `${f}.ts`));
  const db = ts("db");
  app = {
    pool: db.pool,
    bots,
    Research: require("../../db/episode-research.js"),
    BotResearch: require("../../db/bot-research.js"),
    Trivia: require("../../db/trivia-research.js"),
    Bingo: require("../../db/bingo-research.js"),
    Rulebooks: require("../../db/rulebooks.js"),
    WikiSync: require("../../db/wiki-sync.js"),
    CastPrompt: require("../../src/lib/game/formats/cast-prompt.js"),
    Formats: require("../../src/lib/game/formats/index.js"),
    RulebookResearch: require("../../src/lib/game/formats/rulebook-research.js"),
    addShow: ts("add-show"),
    listings: ts("listings"),
    makeGame: ts("make-game"),
    deskRulebooks: ts("desk-rulebooks"),
    recaps: ts("episode-recaps"),
    follows: ts("follows"),
  };
  return app;
}

let commit = null;
const commitOf = () => {
  if (commit) return commit;
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    commit = "unknown";
  }
  return commit;
};

const TAPES_USER = { username: "zt_tapes", name: "zt_tapes", email: "zt_tapes@example.invalid" };
/** The zt_tapes user (made once): who adds a show and makes it a game, as SessionUser. Never a real account. */
async function tapesUser(pool) {
  const { rows } = await pool.query(`SELECT * FROM "user" WHERE username = $1`, [TAPES_USER.username]);
  if (rows[0]) return rows[0];
  const id = `zt-tapes-${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, $4, $4, now(), now())`,
    [id, TAPES_USER.name, TAPES_USER.email, TAPES_USER.username]
  );
  return (await pool.query(`SELECT * FROM "user" WHERE id = $1`, [id])).rows[0];
}

// How long the bot may take over one question (s). The app's askBot stops at 285 s (Vercel's 300 s route), so a slow answer
// is lost; a tape is worth the wait, so the recorder sends askBot's own request with a longer max_wait (BOT_WAIT_S to change
// it). Not too long: a question can stall (Traitors 4 episode 1's full research had nothing at 270 s, then answered in 42 s
// on its next try), and a stalled try is a failed one, asked again.
const BOT_WAIT_S = Number(process.env.BOT_WAIT_S) || 420;
const UA = { "User-Agent": "GameYourShow/1.0 (+https://gameyourshow.com)" };

/** One question to the local bot: ask-bot.ts askBot's request (ChatGPT, search on unless `search: false`, keepalive) with
 *  BOT_WAIT_S to answer. */
async function botAsk(prompt, o = {}) {
  const { bots } = appCode();
  const url = bots[0].replace(/\/$/, "");
  const wait = Math.max(60, Math.min(BOT_WAIT_S, o.budgetMs ? Math.max(Math.ceil(o.budgetMs / 1000), BOT_WAIT_S / 2) : BOT_WAIT_S));
  const res = await fetch(`${url}/ask`, {
    method: "POST",
    headers: { ...UA, "Content-Type": "application/json", "X-API-Key": process.env.LLM_BROWSER_API_KEY || "" },
    body: JSON.stringify({ provider: "chatgpt", prompt, search: o.search !== false, max_wait: wait, keepalive: true }),
    signal: AbortSignal.timeout((wait + 30) * 1000),
  });
  const text = await res.text();
  let body = {};
  try {
    body = JSON.parse(text.trim());
  } catch {
    body = { detail: `an answer that isn't JSON (HTTP ${res.status}): ${text.trim().slice(0, 200)}` };
  }
  if (res.ok && body.response) return { answer: body.response, seconds: body.seconds ?? 0 };
  throw new Error(`ChatGPT didn't answer. ${new URL(url).host}: ${body.detail || `HTTP ${res.status}`}`);
}

/**
 * The bot, as the app asks it (askBot's request, botAsk), with every question kept: { prompt, answer, seconds, error } in `asks`.
 * And the parsers a job calls through their modules, wrapped while it runs so what each one made is kept in `parses`.
 */
function recording() {
  const { Research, Trivia, Bingo } = appCode();
  const asks = [];
  const parses = [];
  const ask = async (prompt, o = {}) => {
    const entry = { prompt, answer: null, seconds: null, error: null };
    asks.push(entry);
    const t0 = Date.now();
    try {
      const out = await botAsk(prompt, o);
      entry.answer = out.answer;
      entry.seconds = Math.round((Date.now() - t0) / 100) / 10;
      return out;
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
      entry.seconds = Math.round((Date.now() - t0) / 100) / 10;
      throw e;
    }
  };
  const wrapped = [];
  const wrap = (mod, name, pick = (r) => r) => {
    const orig = mod[name];
    mod[name] = function (...args) {
      const r = orig.apply(this, args);
      if (r && typeof r.then === "function") return r.then((v) => (parses.push({ by: name, value: pick(v) }), v));
      parses.push({ by: name, value: pick(r) });
      return r;
    };
    wrapped.push(() => (mod[name] = orig));
  };
  // A full answer's own parse (before it's merged into what's stored), what the review found, and what it staged.
  wrap(Research, "researchFromPaste", (r) => ({ parsed: r.submitted, problems: r.problems, fatal: r.fatal, decisions: r.decisions, merged: !!r.merged }));
  wrap(Trivia, "parseTriviaAnswer");
  wrap(Trivia, "parseCheckAnswer");
  wrap(Bingo, "parseBingoAnswer");
  wrap(Bingo, "parseCheckAnswer");
  return { ask, asks, parses, done: () => wrapped.forEach((u) => u()) };
}

// ---------- the season ----------

/** The show's row for a TVmaze id, or null. */
async function showRow(pool, tvmaze) {
  const { rows } = await pool.query("SELECT id, slug, name, format, kind, set_up_at FROM shows WHERE tvmaze_id = $1 AND archived = false ORDER BY created_at LIMIT 1", [tvmaze]);
  return rows[0] || null;
}

async function seasonRow(pool, showId, number) {
  const { rows } = await pool.query("SELECT * FROM show_seasons WHERE show_id = $1 AND season_number = $2", [showId, number]);
  return rows[0] || null;
}

/** The season as the tape keeps it: its row, listing, episodes, cast and compiled rulebook (read from the database). */
async function seasonSnapshot(pool, seasonId) {
  const { rows: s } = await pool.query(
    `SELECT ss.id, ss.season_number, ss.name, ss.status, ss.premiere_date, ss.finale_date, ss.episode_count, ss.air_time, ss.air_tz,
            ss.listing_id, ss.rulebook_id, ss.cast_approved_at, s.id AS show_id, s.slug, s.name AS show_name, s.format, s.kind,
            s.tvmaze_id, s.set_up_at, s.castaway_term, s.tribe_term, s.episode_term
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [seasonId]
  );
  const { rows: episodes } = await pool.query("SELECT number, air_at, runtime_min, title, source FROM season_episodes WHERE season_id = $1 ORDER BY number", [seasonId]);
  const { rows: cast } = await pool.query("SELECT name, tribe_name, photo_url, sort_order FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [seasonId]);
  const { rows: book } = await pool.query("SELECT id, name, kind, status, version, blocks, compiled FROM rulebooks WHERE owner_kind = 'season' AND season_id = $1 AND status <> 'archived'", [seasonId]);
  return { season: s[0], episodes, cast, rulebook: book[0] || null };
}

/** A tape's season.json, written again from the database (after the cast or rules change it). */
async function writeSeason(pool, job, extra = {}) {
  // A load reads a tape; it never writes one.
  if (job.load) return;
  const file = path.join(dirOf(job.show, job.season), "season.json");
  const was = readJson(file) || {};
  const snap = await seasonSnapshot(pool, extra.seasonId || was.seasonId);
  const episodeCount = extra.episodeCount ?? was.episodeCount ?? snap.episodes.length;
  writeJson(file, { ...was, ...extra, show: job.show, number: job.season, seasonId: snap.season.id, episodeCount, at: new Date().toISOString(), commit: commitOf(), ...snap });
}

/**
 * The season onto the lane's database the way the app does it: the show by its TVmaze id (a show not here is added as the
 * desk's New show adds it: add-show.ts addShow, "Not a game yet"), then the season from its listing (add-show.ts listedSeason:
 * its row and every episode's air time) unless it's here already (a season here keeps its schedule, as the app keeps it). A
 * set-up show's season gets its rulebook (db/rulebooks.js ensureSeasonRulebook). No bot.
 */
async function setupSeason(job, entry) {
  const { pool, addShow, listings, Rulebooks } = appCode();
  const user = await tapesUser(pool);
  const found = await listings.showListing(entry.tvmaze, TVMAZE);
  if (!found) throw new Error(`TVmaze has no show ${entry.tvmaze}`);
  const listed = found.seasons.find((s) => s.number === job.season);
  if (!listed) throw new Error(`TVmaze has no season ${job.season} of ${found.show.name}`);
  let show = await showRow(pool, entry.tvmaze);
  let addedShow = false;
  if (!show) {
    await addShow.addShow(user.id, { listing: entry.tvmaze }, TVMAZE, new Date(), { follow: false, cap: false });
    show = await showRow(pool, entry.tvmaze);
    addedShow = true;
  }
  let season = await seasonRow(pool, show.id, job.season);
  const madeSeason = !season;
  if (!season) {
    await addShow.listedSeason(show.id, found.show, listed, TVMAZE, new Date(), null);
    season = await seasonRow(pool, show.id, job.season);
  }
  if (show.set_up_at) await Rulebooks.ensureSeasonRulebook(pool, season.id);
  const stored = (entry.stored || []).includes(job.season);
  const { rows: researched } = await pool.query(
    "SELECT max(episode_number)::int AS n FROM episode_research WHERE show_id = $1 AND season_number = $2 AND source = 'combined'",
    [show.id, job.season]
  );
  const { rows: listedEps } = await pool.query("SELECT count(*)::int AS n FROM season_episodes WHERE season_id = $1", [season.id]);
  // Its episodes: the listing's regular ones (a stored season's researched ones when it has more).
  const episodeCount = Math.max(listedEps[0].n, stored ? researched[0].n || 0 : 0, season.episode_count && !listedEps[0].n ? season.episode_count : 0);
  // What the tapes made (for unload): kept from an earlier run, which made them, when this one finds them here.
  const was = readJson(path.join(dirOf(job.show, job.season), "season.json")) || {};
  const made = { show: (was.made && was.made.show) || (addedShow ? show.id : null), season: (was.made && was.made.season) || (madeSeason ? season.id : null) };
  await writeSeason(pool, job, { seasonId: season.id, episodeCount, listing: { show: found.show, season: listed }, made, stored });
  if (stored && !job.load) await tapeStored(pool, job, show, season.id, episodeCount);
  return { ok: true, message: `${show.name} ${job.season}: ${episodeCount} episode(s)${madeSeason ? ", made from its listing" : ", here already"}${addedShow ? " (the show added)" : ""}`, result: { seasonId: season.id, showId: show.id, episodeCount, addedShow, madeSeason } };
}

/** A season researched before the tapes: each stored episode's answer onto the tape as it was (not asked again). */
async function tapeStored(pool, job, show, seasonId, count) {
  const { rows } = await pool.query(
    "SELECT episode_number, payload, provenance, researched_at FROM episode_research WHERE show_id = $1 AND season_number = $2 AND source = 'combined' ORDER BY episode_number",
    [show.id, job.season]
  );
  for (const r of rows) {
    if (r.episode_number > count) continue;
    const ep = { ...job, kind: "full", episode: r.episode_number };
    if (onTape(ep)) continue;
    const p = r.provenance || {};
    writeRecord(ep, {
      kind: "full",
      show: job.show,
      season: job.season,
      episode: r.episode_number,
      source: "stored",
      note: "Researched before the tapes (the local copy of production): the answer as pasted (cut at 20,000 characters when longer), its parsed payload as stored. Not asked again.",
      prompt: null,
      answer: p.pastedNotes || null,
      parsed: r.payload,
      provenance: { ...p, pastedNotes: undefined },
      ok: true,
      message: `stored (${p.provider || "?"}${p.via ? ` via ${p.via}` : ""})`,
      seconds: null,
      at: r.researched_at,
      bot: null,
      commit: commitOf(),
      seasonId,
    });
  }
}

// ---------- the questions ----------

/** The season's tape (season.json), or a refusal: its questions come after it. */
function seasonOf(job) {
  // A load works on this database's season, whatever the tape's id was.
  if (job.seasonId) return { seasonId: job.seasonId };
  const s = readJson(path.join(dirOf(job.show, job.season), "season.json"));
  if (!s || !s.seasonId) throw Object.assign(new Error(`${job.show} ${job.season} has no season.json yet`), { blocked: true });
  return s;
}

/** Whether the season's cast is on tape and worked (its episodes' questions are about the cast). */
function castReady(job) {
  const t = readJson(path.join(dirOf(job.show, job.season), "season-cast.json"));
  return !!(t && t.ok);
}

/**
 * How the show works. A show that isn't a game yet: Make it a game's question (make-game.ts makePrompt "rules"), its answer
 * pasted as an answer to it (pasteMake), which reads it as the bot's ask would. A set-up show: the desk's Check for changes on
 * the season's rulebook (desk-rulebooks.ts rulebookPrompt), reviewed as the desk reviews it (reviewAnswer: writes nothing).
 */
async function askRules(job, rec) {
  const { pool, makeGame, deskRulebooks, RulebookResearch, Rulebooks } = appCode();
  const s = seasonOf(job);
  const user = await tapesUser(pool);
  const { rows } = await pool.query("SELECT s.set_up_at FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [s.seasonId]);
  if (!rows[0].set_up_at) {
    const { prompt } = await makeGame.makePrompt(user, s.seasonId, "rules");
    const { answer } = await rec.ask(prompt);
    const parsed = RulebookResearch.parseRulebookAnswer(answer);
    const state = await makeGame.pasteMake(user, s.seasonId, null, { part: "rules", answer }, TVMAZE);
    return { ok: true, message: `Make it a game: ${state.review ? `${state.review.kind?.line || state.review.kind?.key || "read"}` : "read"}`, parsed, result: { via: "make-game", needs: state.needs ?? null, review: state.review ?? null } };
  }
  const book = await Rulebooks.ensureSeasonRulebook(pool, s.seasonId);
  if (!book || !book.row) throw new Error("The season has no rulebook to check");
  const { prompt } = await deskRulebooks.rulebookPrompt(book.row.id);
  const { answer } = await rec.ask(prompt);
  const parsed = RulebookResearch.parseRulebookAnswer(answer);
  const review = await deskRulebooks.reviewAnswer(book.row.id, answer);
  return { ok: true, message: `${review.changes} change(s) to the rulebook the desk would see`, parsed, result: { via: "desk-rulebooks", rulebookId: book.row.id, review } };
}

/**
 * Who's in it. A show that isn't a game yet: Make it a game's cast question (makePrompt "cast"; none when its listing has the
 * cast, as for a series), pasted (pasteMake), then Looks right (confirmMake): the season's rulebook and approved cast, and the
 * show set up. A set-up show: the cast prompt the app's cast import sends (cast-prompt.js buildCastPrompt on the season's
 * format), read by its parser (parseCastImport), staged as the season's cast the way the classic admin's pull stages one
 * (wiki-sync.js stageSeasonCast), so the episodes' research asks about these people.
 */
async function askCast(job, rec) {
  const { pool, makeGame, CastPrompt, WikiSync, Research } = appCode();
  const s = seasonOf(job);
  const user = await tapesUser(pool);
  const { rows } = await pool.query("SELECT s.set_up_at, s.slug, s.name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [s.seasonId]);
  if (!rows[0].set_up_at) {
    let state = await makeGame.makeState(user, s.seasonId, null, undefined, TVMAZE);
    let parsed = null;
    if (state.needs === "cast") {
      const { prompt } = await makeGame.makePrompt(user, s.seasonId, "cast");
      const { answer } = await rec.ask(prompt);
      state = await makeGame.pasteMake(user, s.seasonId, null, { part: "cast", answer }, TVMAZE);
      parsed = { review: state.review ? { cast: state.review.cast, approvable: state.review.approvable } : null };
    }
    const done = await makeGame.confirmMake(user, s.seasonId, null, TVMAZE);
    await writeSeason(pool, job);
    const { rows: cast } = await pool.query("SELECT name, tribe_name FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [s.seasonId]);
    // A series' cast comes from its TV listing (make-game.ts listingCast), with no question.
    return { ok: cast.length > 0, message: `Looks right: ${cast.length} in the cast${rec.asks.length ? "" : " (from the listing, no question)"}`, parsed: parsed || { fromListing: true, cast: cast.map((c) => c.name) }, result: { via: "make-game", cast: cast.length, done: done.stage ?? null } };
  }
  const ctx = await Research.resolveSeasonResearchContext(pool, rows[0].slug, job.season, 1).catch(() => null);
  const format = ctx ? ctx.format : (await formatOfSeason(pool, s.seasonId));
  const prompt = CastPrompt.buildCastPrompt(format, { seasonName: `Season ${job.season}`, showName: rows[0].name });
  const { answer } = await rec.ask(prompt);
  const parsed = CastPrompt.parseCastImport(answer, format);
  const good = parsed.castaways.filter((c) => !c.problems.length);
  if (!good.length) return { ok: false, message: "No one in the answer could be read", parsed, result: null };
  // A season whose cast was here already keeps it (its research was asked about those names): the answer is only recorded.
  const { rows: had } = await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [s.seasonId]);
  if (had[0].n) return { ok: true, message: `${good.length} read; the season's cast of ${had[0].n} was here already and is kept`, parsed, result: { via: "cast-import", kept: had[0].n } };
  const groups = [...new Set(good.map((c) => (c.startingGroup || "").trim()).filter(Boolean))];
  const terms = WikiSync.termsFor({ castaway_term: format.terms && format.terms.castaway, tribe_term: format.terms && format.terms.tribe }).terms;
  const staged = await WikiSync.stageSeasonCast(
    pool,
    { terms, season: job.season, showSlug: rows[0].slug },
    { payload: { tribes: groups.map((name) => ({ name })), castaways: good.map((c) => ({ name: c.name, tribeName: (c.startingGroup || "").trim() || null })) } },
    {}
  );
  await writeSeason(pool, job);
  return { ok: true, message: staged.summary, parsed, result: { via: "cast-import", staged } };
}

/** The format a season's research reads (its show's), for a season whose cast isn't in yet. */
async function formatOfSeason(pool, seasonId) {
  const { Formats, Rulebooks } = appCode();
  const { rows } = await pool.query("SELECT s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  const live = await Rulebooks.seasonRulebookFormat(pool, seasonId, { formatId: rows[0].format });
  if (live) return live;
  const ShowFormats = require("../../db/show-formats.js");
  return Formats.formatFor(rows[0].format, await ShowFormats.formatDataFor(pool, rows[0].format));
}

/** An episode's question (or the season's bingo bank) through db/bot-research.js runJob, as an admin's Run now runs it. */
async function askEpisode(job, rec) {
  const { pool, BotResearch } = appCode();
  const s = seasonOf(job);
  if (!job.load && !castReady(job)) throw Object.assign(new Error(`${job.show} ${job.season}'s cast isn't on tape yet`), { blocked: true });
  const season = await BotResearch.loadSeasonForJob(pool, s.seasonId);
  const kind = job.kind === "bingo-season" ? "bingo" : job.kind;
  // The season's own bank is written "in the window of" an episode's run: the first one's.
  const episode = job.kind === "bingo-season" ? 1 : job.episode;
  const outcome = await BotResearch.runJob(pool, { season, episode, kind, slot: "now", ...(job.kind === "bingo-season" ? { forSeason: true } : {}) }, { ask: rec.ask });
  return { ok: outcome.ok, message: outcome.message, result: outcome.result, runId: outcome.runId };
}

/** What a job's parsed output is: the app's run result, and each ask's parse as the app read it. */
function parsedFor(job, rec, out) {
  const byName = (name) => rec.parses.filter((p) => p.by === name).map((p) => p.value);
  if (job.kind === "full") return byName("researchFromPaste")[0] || out.result;
  if (job.kind === "trivia") return { write: byName("parseTriviaAnswer")[0] ?? null, check: byName("parseCheckAnswer")[0] ?? null };
  if (job.kind === "bingo" || job.kind === "bingo-season") return { write: byName("parseBingoAnswer")[0] ?? null, check: byName("parseCheckAnswer")[0] ?? null };
  return out.parsed !== undefined ? out.parsed : out.result;
}

/**
 * What happened in each episode, in a few sentences (episode-recaps.ts: Fill in what happened's recaps, for a show you watch):
 * its question for every aired episode with no recap yet, the answer read and saved as a paste is (pasteRecaps). The zt_tapes
 * user follows the season first, as anyone asking does.
 */
async function askRecaps(job, rec) {
  const { pool, recaps, follows } = appCode();
  const s = seasonOf(job);
  const user = await tapesUser(pool);
  await follows.setFollow(user.id, s.seasonId, { following: true });
  const { prompt } = await recaps.recapPromptFor(user, s.seasonId);
  const { answer } = await rec.ask(prompt);
  const asked = [...prompt.matchAll(/^- \S+ (\d+)/gm)].map((m) => Number(m[1]));
  const parsed = Object.fromEntries(recaps.readRecaps(answer, asked));
  const out = await recaps.pasteRecaps(user, s.seasonId, answer);
  return { ok: out.filled > 0, message: `${out.filled} of ${asked.length} recap(s) saved`, parsed, result: { filled: out.filled, missing: out.missing } };
}

/**
 * A request from Start a game's words corpus (start-a-game-words.json), asked with the draft request prompt (tapes-words.js:
 * no web search, the corpus's own date), read, and judged against its expected reading.
 */
async function askWords(job, rec) {
  const W = require("./tapes-words.js");
  const corpus = wordsCorpus();
  const req = corpus && corpus.requests.find((r) => r.id === job.id);
  if (!req) throw Object.assign(new Error(`No request ${job.id} in start-a-game-words.json`), { blocked: true });
  const { answer } = await rec.ask(W.wordsPrompt(req.words, corpus.today), { search: false });
  const parsed = W.parseRequest(answer);
  const judged = W.judge(req.expect, parsed, req.words);
  // A reading that's off is still what the bot said: it's the tape (asking again until it reads well would flatter the eval).
  return { ok: true, message: `${judged.score} of ${judged.of} as expected${judged.inventedNumbers.length ? `; invented ${judged.inventedNumbers.join(", ")}` : ""}`, parsed, result: { id: req.id, group: req.group, words: req.words, expect: req.expect, judged } };
}

const RUNNERS = { words: askWords, season: null, rules: askRules, cast: askCast, recaps: askRecaps, quick: askEpisode, full: askEpisode, trivia: askEpisode, bingo: askEpisode, "bingo-season": askEpisode };

/**
 * Asks one question and puts it on tape: { ok, limited, blocked, record }. A failure that asked the bot is kept as a try (or,
 * at the last try, as the tape itself, ok: false); one that never reached the bot (`blocked`: what it needs isn't on tape) is
 * neither.
 */
async function runOne(job, tries = 1) {
  const entry = SHOWS.find((s) => s.key === job.show);
  if (!entry && job.kind !== "words") throw new Error(`No show "${job.show}" in the tapes' list`);
  const at = new Date();
  const t0 = Date.now();
  if (job.kind === "season") {
    const out = await setupSeason(job, entry);
    return { ok: true, record: { kind: "season", ...out }, message: out.message, seconds: Math.round((Date.now() - t0) / 1000) };
  }
  const rec = recording();
  let out;
  try {
    out = await RUNNERS[job.kind](job, rec);
  } catch (e) {
    out = { ok: false, message: e instanceof Error ? e.message : String(e), blocked: !!(e && e.blocked), result: null };
  } finally {
    rec.done();
  }
  const seconds = Math.round((Date.now() - t0) / 100) / 10;
  if (out.blocked && !rec.asks.length) return { ok: false, blocked: true, message: out.message, seconds };
  const [first, second] = rec.asks;
  const record = {
    kind: job.kind,
    ...(job.kind === "words" ? { id: job.id } : {}),
    show: job.show,
    season: job.season,
    episode: job.episode,
    prompt: first ? first.prompt : null,
    answer: first ? first.answer : null,
    parsed: parsedFor(job, rec, out),
    ok: !!out.ok,
    message: out.message || null,
    seconds,
    at: at.toISOString(),
    bot: { urls: appCode().bots, provider: "chatgpt", maxWait: BOT_WAIT_S, seconds: first ? first.seconds : null },
    commit: commitOf(),
    ...(second ? { check: { prompt: second.prompt, answer: second.answer, seconds: second.seconds, error: second.error } } : {}),
    ...(rec.asks.some((a) => a.error) ? { errors: rec.asks.filter((a) => a.error).map((a) => a.error) } : {}),
    result: out.result ?? null,
    tries,
  };
  const limited = !out.ok && rec.asks.some((a) => looksLimited(a.error) || (a.answer && a.answer.length < 600 && looksLimited(a.answer)));
  return { ok: !!out.ok, limited, record, seconds, message: out.message, asked: rec.asks.length };
}

// ---------- the queue ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const wordsCorpus = () => readJson(path.join(__dirname, "start-a-game-words.json"));
function wordsIds() {
  const data = wordsCorpus();
  return data && Array.isArray(data.requests) ? data.requests.map((r) => r.id) : [];
}

function argsOf(argv) {
  const flags = {};
  const rest = [];
  for (const a of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (m) flags[m[1]] = m[2] ?? true;
    else rest.push(a);
  }
  return { flags, rest };
}

function onlyOf(flag) {
  if (!flag || flag === true) return null;
  const [show, season] = String(flag).split(":");
  return { show, season: season ? Number(season) : null };
}

/** The next question the queue would ask: the first not on tape and not given up, skipping a season whose cast isn't in. */
function nextJob(opts) {
  const jobs = planJobs({ episodesOf: episodesOnTape, words: wordsIds(), only: opts.only, kinds: opts.kinds });
  const stuck = new Set();
  const held = new Map();
  const byCast = new Map();
  for (const job of jobs) {
    if (onTape(job)) continue;
    const season = `${job.show}/${job.season}`;
    if (stuck.has(season)) continue;
    // A series whose cast is its listing's: its questions about its people wait (castHeld). A season whose full research
    // gave up unanswered: its other episodes' full research waits (fullHeld).
    if (CAST_HELD_KINDS.includes(job.kind)) {
      if (!byCast.has(season)) {
        const dir = dirOf(job.show, job.season);
        byCast.set(season, castHeld(readJson(path.join(dir, "season-cast.json")), (readJson(path.join(dir, "season.json")) || {}).rulebook?.kind));
      }
      if (byCast.get(season)) continue;
    }
    if (job.kind === "full") {
      if (!held.has(season)) held.set(season, fullHeld(readTape(job.show, job.season).files));
      if (held.get(season) !== null) continue;
    }
    // A season's questions wait for its setup; its episodes' for its cast.
    if (job.kind !== "season" && job.show !== "words" && !fs.existsSync(path.join(dirOf(job.show, job.season), "season.json"))) {
      stuck.add(season);
      continue;
    }
    if (EPISODE_KINDS.includes(job.kind) || job.kind === "bingo-season" || job.kind === "recaps") {
      const cast = readJson(path.join(dirOf(job.show, job.season), "season-cast.json"));
      if (!cast) continue;
      if (!cast.ok) {
        stuck.add(season);
        continue;
      }
    }
    return job;
  }
  return null;
}

async function record(opts) {
  const pause = (Number(opts.pause) || 60) * 1000;
  const max = Number(opts.max) || Infinity;
  let asked = 0;
  journal(`${new Date().toISOString()}  -- recorder started (pid ${process.pid}, commit ${commitOf()}, pause ${pause / 1000}s${opts.only ? `, only ${opts.only.show}${opts.only.season ? `:${opts.only.season}` : ""}` : ""})`);
  let stop = false;
  process.on("SIGINT", () => {
    if (stop) process.exit(1);
    stop = true;
    console.log("Stopping after this question (Ctrl+C again to stop now)");
  });
  while (!stop && asked < max) {
    const state = loadState();
    const hold = holdFor(state, Date.now());
    if (hold) {
      console.log(`${new Date().toISOString()}  waiting ${Math.round(hold.wait / 60000)} min: ${hold.why}`);
      await sleep(Math.min(hold.wait, 5 * MIN));
      continue;
    }
    const job = nextJob(opts);
    if (!job) {
      journal(`${new Date().toISOString()}  -- nothing left to ask (the plan's order is on tape)`);
      break;
    }
    // The local bot answers one question at a time: wait while it's busy with someone else's.
    if (job.kind !== "season" && !(await botFree())) {
      await sleep(MIN);
      continue;
    }
    const key = keyOf(job);
    const tries = (state.tries[key] || 0) + 1;
    let out;
    try {
      out = await runOne(job, tries);
    } catch (e) {
      out = { ok: false, message: e instanceof Error ? e.message : String(e), record: null, asked: 0 };
    }
    if (out.blocked) {
      journal(journalLine(Date.now(), job, { ok: false, seconds: out.seconds, message: `waiting: ${out.message}`, tries: 0 }));
      await sleep(5000);
      continue;
    }
    const s = loadState();
    if (out.ok) {
      // The season's own tape (season.json) is written as it's set up.
      if (job.kind !== "season") writeRecord(job, out.record);
      delete s.tries[key];
      s.failuresInARow = 0;
      s.pausedUntil = null;
      s.pauseWhy = null;
    } else if (out.limited) {
      // A usage limit or a bot check isn't the question's fault: it uses up none of its tries, and waits an hour.
      s.lastError = { at: new Date().toISOString(), job: key, message: out.message };
      if (out.record) writeRecord(job, out.record, { tryNo: `${tries}-limited` });
      s.pausedUntil = new Date(Date.now() + LIMITED_MIN * MIN).toISOString();
      s.pauseWhy = "the answer reads like a usage limit or a bot check";
    } else {
      s.tries[key] = tries;
      s.failuresInARow = (s.failuresInARow || 0) + 1;
      s.lastError = { at: new Date().toISOString(), job: key, message: out.message };
      if (out.record) writeRecord(job, out.record, { tryNo: tries });
      // The last try: what it answered is the tape, so the queue moves on.
      if (tries >= TRIES && out.record) {
        writeRecord(job, { ...out.record, gaveUp: true });
        delete s.tries[key];
      } else if (tries >= TRIES && job.kind === "season") {
        // A season that can't be set up: its tape says so (no seasonId), and its questions never come up.
        writeJson(path.join(dirOf(job.show, job.season), "season.json"), { show: job.show, number: job.season, ok: false, gaveUp: true, message: out.message, at: new Date().toISOString() });
        delete s.tries[key];
      }
      s.pausedUntil = new Date(Date.now() + backoffMs(s.failuresInARow)).toISOString();
      s.pauseWhy = `${s.failuresInARow} failure(s) in a row`;
    }
    saveState(s);
    journal(journalLine(Date.now(), job, { ok: out.ok, seconds: out.seconds, message: out.limited ? `LIMITED, waiting an hour: ${out.message}` : out.message, tries: out.ok || out.limited ? 0 : tries }));
    if (out.asked) asked += 1;
    if (!stop && asked < max && out.asked) await sleep(pause);
  }
  journal(`${new Date().toISOString()}  -- recorder stopped (${asked} question(s) this run)`);
}

/** Whether the local bot is up and free (its /health). */
async function botFree() {
  const { bots } = appCode();
  try {
    const res = await fetch(`${bots[0].replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const body = await res.json();
    return !(body.busy && body.busy.length) && !(body.queued && Object.values(body.queued).some((n) => n > 0));
  } catch {
    return false;
  }
}

// ---------- status, load ----------

function status() {
  const lines = [];
  for (const show of SHOWS) {
    for (const season of show.seasons) {
      const tape = readTape(show.key, season);
      if (!tape.season && !tape.files.length) {
        lines.push(`${show.key} ${season}: nothing yet`);
        continue;
      }
      const n = tape.season ? tape.season.episodeCount : null;
      const count = (kind) => tape.files.filter((f) => f.kind === kind && f.ok).length;
      const failed = tape.files.filter((f) => !f.ok).length;
      const own = ["rules", "cast", "bingo-season", "recaps"].filter((k) => tape.files.some((f) => f.kind === k && f.ok));
      lines.push(
        `${show.key} ${season}: ${n == null ? "?" : n} episode(s); ${own.join(", ") || "no season questions"}; quick ${count("quick")}, full ${count("full")}, trivia ${count("trivia")}, bingo ${count("bingo")}` +
          (failed ? `; ${failed} given up` : "") +
          (fullHeld(tape.files) !== null ? `; full research held: episode ${fullHeld(tape.files)}'s gave up unanswered (delete its e${pad(fullHeld(tape.files))}-full.json to ask again)` : "") +
          (castHeld(tape.files.find((f) => f.kind === "cast"), tape.season && tape.season.rulebook && tape.season.rulebook.kind)
            ? `; full research, trivia and bingo held: its cast is the TV listing's, every season's crew (finding 10; to ask them: ${CAST_HELD_HOW})`
            : "")
      );
    }
  }
  const wordsDir = path.join(TAPES, "words");
  const words = fs.existsSync(wordsDir) ? fs.readdirSync(wordsDir).filter((f) => /^[^.]+\.json$/.test(f)).map((f) => readJson(path.join(wordsDir, f))).filter(Boolean) : [];
  // Judged again from what was parsed, as `tapes-words.js report` judges (today's judge, the corpus's words and expected
  // readings): a tape's own `judged` is how it read then.
  lines.push(require("./tapes-words.js").statusLine((wordsCorpus() || {}).requests || [], words));
  const state = loadState();
  if (state.pausedUntil && new Date(state.pausedUntil) > new Date()) lines.push(`paused until ${state.pausedUntil}: ${state.pauseWhy}`);
  if (state.lastError) lines.push(`last error ${state.lastError.at}: ${state.lastError.job}: ${state.lastError.message}`);
  const log = path.join(TAPES, "journal.log");
  if (fs.existsSync(log)) {
    const tail = fs.readFileSync(log, "utf8").trim().split("\n").slice(-5);
    lines.push("journal:", ...tail.map((l) => `  ${l}`));
  }
  console.log(lines.join("\n"));
}

/**
 * A tape into this lane's database, no bot, and the tape itself untouched: the season (from its listing, as record makes it),
 * how it works and who's in it from the recorded answers through the same paths (a show that isn't a game yet: Make it a
 * game, pasted, then Looks right; a set-up show's cast staged), then each episode's full answer through the app's paste
 * import (episode-research.js researchFromPaste, structured), in episode order, so the next one's "who's still in" is the
 * app's own. An episode researched before the tapes (stored) goes in as it was stored (storeResearch).
 */
async function load(show, season) {
  const entry = SHOWS.find((s) => s.key === show);
  if (!entry) throw new Error(`No show "${show}" in the tapes' list`);
  const tape = readTape(show, season);
  if (!tape.season || !tape.season.seasonId) throw new Error(`${show} ${season} has no tape`);
  const { pool, Research } = appCode();
  const base = { show, season, episode: null, load: true };
  const set = await setupSeason({ ...base, kind: "season" }, entry);
  const seasonId = set.result.seasonId;
  const replayOf = (t) => ({
    asks: [],
    parses: [],
    ask: async () => {
      if (!t || t.answer == null) throw new Error(`${show} ${season}: the tape has no answer for that question`);
      return { answer: t.answer, seconds: 0 };
    },
    done() {},
  });
  const { rows: head } = await pool.query("SELECT s.set_up_at, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  const find = (kind) => tape.files.find((f) => f.kind === kind && f.ok);
  if (!head[0].set_up_at && find("rules")) await askRules({ ...base, kind: "rules", seasonId }, replayOf(find("rules")));
  const { rows: here } = await pool.query("SELECT count(*)::int AS n FROM season_cast WHERE season_id = $1", [seasonId]);
  if (!here[0].n && find("cast")) await askCast({ ...base, kind: "cast", seasonId }, replayOf(find("cast")));
  let filed = 0;
  for (const f of tape.files.filter((x) => x.kind === "full" && x.ok).sort((a, b) => a.episode - b.episode)) {
    const { rows } = await pool.query("SELECT 1 FROM episode_research WHERE show_id = $1 AND season_number = $2 AND episode_number = $3 AND source = 'combined'", [set.result.showId, season, f.episode]);
    if (rows.length) continue;
    if (f.source === "stored") {
      const ctx = await Research.resolveSeasonResearchContext(pool, head[0].slug, season, f.episode);
      await Research.storeResearch(pool, ctx, f.parsed, f.provenance || { provider: "tape", via: "stored" }, {});
    } else if (f.answer) {
      await Research.researchFromPaste(pool, head[0].slug, season, f.episode, f.answer, { structured: true, via: "bot" });
    } else continue;
    filed += 1;
  }
  console.log(`${show} ${season}: loaded (season ${seasonId}, ${filed} episode(s) filed)`);
}

/**
 * Takes out of this lane's database what the tapes made for a season: a show they added (and so every season of it), else
 * the season they made from its listing, with its research (keyed by show and season number, not the season's row). A
 * season that was here before the tapes (Survivor 49, the copy's) is left alone. The tape stays.
 */
async function unload(show, season) {
  const entry = SHOWS.find((s) => s.key === show);
  if (!entry) throw new Error(`No show "${show}" in the tapes' list`);
  const s = readJson(path.join(dirOf(show, season), "season.json"));
  const made = (s && s.made) || {};
  if (!made.show && !made.season) throw new Error(`${show} ${season} wasn't made by the tapes: its rows are the database's own, left alone`);
  const { pool } = appCode();
  if (made.show) {
    const { rowCount } = await pool.query("DELETE FROM shows WHERE id = $1 AND tvmaze_id = $2", [made.show, entry.tvmaze]);
    console.log(`${show}: ${rowCount ? "the show the tapes added, and every season of it, taken out" : "the show isn't here"}`);
    return;
  }
  const { rows } = await pool.query("SELECT ss.show_id FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE ss.id = $1 AND sh.tvmaze_id = $2 AND ss.season_number = $3", [made.season, entry.tvmaze, season]);
  if (!rows.length) return console.log(`${show} ${season}: the season isn't here`);
  for (const table of ["episode_research", "episode_text_chunks"]) await pool.query(`DELETE FROM ${table} WHERE show_id = $1 AND season_number = $2`, [rows[0].show_id, season]);
  await pool.query("DELETE FROM show_seasons WHERE id = $1", [made.season]);
  console.log(`${show} ${season}: the season the tapes made, and its research, taken out`);
}

/**
 * For fake-bot.js's `answer`: (prompt, kind) => the answer a tape recorded for that prompt (pickAnswer), or the empty
 * object a stand-in answers with when the tape has none. `show` and `season` as the tape names them.
 */
function answerer(show, season) {
  const asks = asksOf(readTape(show, season).files);
  return (prompt, kind) => {
    const found = pickAnswer(asks, prompt, kind);
    return found != null ? found : "{}";
  };
}

async function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  const { flags, rest } = argsOf(argv);
  const opts = { only: onlyOf(flags.only), kinds: flags.kinds ? String(flags.kinds).split(",") : null, pause: flags.pause, max: flags.max };
  if (cmd === "record") return record(opts);
  if (cmd === "status") return status();
  if (cmd === "plan") {
    const jobs = planJobs({ episodesOf: episodesOnTape, words: wordsIds(), only: opts.only, kinds: opts.kinds }).filter((j) => !onTape(j));
    const next = nextJob(opts);
    console.log(`next: ${next ? keyOf(next) : "nothing"}`);
    for (const j of jobs.slice(0, Number(flags.max) || 40)) console.log(`  ${j.kind === "words" ? `words ${j.id}` : keyOf(j)}`);
    console.log(`(${jobs.length} not on tape)`);
    return;
  }
  if (cmd === "one") {
    const [show, season, kind, episode] = rest;
    const job = show === "words" ? { show: "words", season: 0, kind: "words", episode: null, id: season } : { show, season: Number(season), kind, episode: episode != null ? Number(episode) : null };
    const out = await runOne(job, 1);
    if (out.blocked) throw new Error(out.message);
    if (job.kind !== "season") writeRecord(job, out.record, out.ok ? {} : { tryNo: 1 });
    journal(journalLine(Date.now(), job, { ok: out.ok, seconds: out.seconds, message: out.message, tries: out.ok ? 0 : 1 }));
    if (!out.ok) process.exitCode = 1;
    return;
  }
  if (cmd === "load") return load(rest[0], Number(rest[1]));
  if (cmd === "unload") return unload(rest[0], Number(rest[1]));
  console.log("Usage: node scripts/dev-test/tapes.js record|plan|status|one|load|unload (see the header comment)");
}

module.exports = { SHOWS, TRIES, planJobs, fullHeld, castHeld, backoffMs, looksLimited, holdFor, journalLine, nameOf, keyOf, asksOf, pickAnswer, hashOf, readTape, answerer, TAPES };

if (require.main === module) {
  main()
    .then(async () => {
      if (app) await app.pool.end().catch(() => {});
      process.exit(process.exitCode || 0);
    })
    .catch(async (e) => {
      console.error(e && e.stack ? e.stack : e);
      if (app) await app.pool.end().catch(() => {});
      process.exit(1);
    });
}
