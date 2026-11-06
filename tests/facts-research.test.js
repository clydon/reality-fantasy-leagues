// Episode facts' own short run (docs/PLAN-start-a-game-gpt.md step A13 part 2b: db/facts-research.js, bot research's 'facts' run in
// db/bot-research.js): what it asks (only the facts the episode's stored answer isn't sure of; nothing when research was sure), its
// prompt (the episode and its title, the names research was asked about, the JSON), its answer read loosely, and how it's filed into
// the stored answer as a second pass fills in (a sure answer is never replaced by an unsure one, a full run landing after it keeps
// what it settled); the run itself on a stand-in database and bot (no stored answer yet is a failed try; an answer still unsure is
// filed; one without the facts is a failed try; a dry run files nothing). The run through the app's database is proven by
// scripts/dev-test/check-episode-facts.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
require("./harness/fake-research-db.js").stubEmbeddings();
const FR = require("../db/facts-research.js");
const Bot = require("../db/bot-research.js");
const Research = require("../db/episode-research.js");
const F = require("../src/lib/game/formats/episode-facts.js");

const sure = (by) => ({ titleQuote: { isQuote: "yes", line: "a line", by, sure: "high" } });
const UNSURE = { titleQuote: { isQuote: "unknown", line: null, by: null, sure: "low" } };
const CAST = ["Jawan Pitts", "Nate Moore", "Sage Ahrens-Nichols"];

test("what the run asks: only the facts the stored answer isn't sure of (missing is not sure); nothing when research was sure", () => {
  assert.deepEqual(FR.unsureIn(null), ["titleQuote"], "no section at all (a pass that left it out)");
  assert.deepEqual(FR.unsureIn({ titleQuote: null }), ["titleQuote"]);
  assert.deepEqual(FR.unsureIn(UNSURE), ["titleQuote"]);
  assert.deepEqual(FR.unsureIn({ titleQuote: { ...sure("Nate Moore").titleQuote, sure: "low" } }), ["titleQuote"], "a name, but not sure");
  assert.deepEqual(FR.unsureIn({ titleQuote: { isQuote: "yes", line: null, by: null, sure: "high" } }), ["titleQuote"], "sure it's a line, not who");
  assert.deepEqual(FR.unsureIn(sure("Nate Moore")), []);
  assert.deepEqual(FR.unsureIn({ titleQuote: { isQuote: "no", line: null, by: null, sure: "high" } }), [], "sure the title isn't a line");
  assert.deepEqual(FR.unsureIn(sure("Jeff Probst")), [], "sure of someone outside the cast: nothing more to ask");
});

test("its prompt: the episode and its title, the names research was asked about, the facts asked and the JSON to answer in", () => {
  const p = FR.buildFactsPrompt({ showName: "Survivor", season: 49, episode: 3, title: "Lovable Losers", cast: CAST, term: "castaways" });
  assert.match(p, /^Survivor season 49, episode 3, titled "Lovable Losers"\./);
  assert.doesNotMatch(p, /Find the episode's title first/);
  assert.match(p, /who says this episode's title/);
  assert.match(p, /The castaways in this episode \(use their names exactly as written\):\n1\. Jawan Pitts\n2\. Nate Moore\n3\. Sage Ahrens-Nichols/);
  assert.match(p, /\{"episodeTitle": "", "episodeFacts": \{"titleQuote": \{"isQuote": "yes", "line": "", "by": "", "sure": "high"\}\}\}/);
  assert.match(p, /"high" only if a source says plainly who says it/);
  assert.match(p, /for someone who isn't on it \(the host, a family member, someone\n  who already left the game\), their name as the show gives it/);
  // No title known yet: find it first.
  assert.match(FR.buildFactsPrompt({ showName: "The Challenge", season: 41, episode: 2, cast: CAST }), /^The Challenge season 41, episode 2\.\nFind the episode's title first/);
  // Nothing asked: no fact's search or JSON.
  assert.doesNotMatch(FR.buildFactsPrompt({ showName: "Survivor", season: 49, episode: 3, title: "x", cast: CAST, facts: [] }), /titleQuote|who says this episode's title/);
});

test("its answer read loosely: the section's shape, a fact on its own or its fields at the top; only what was asked; no JSON throws", () => {
  const fenced = "Here it is:\n```json\n" + JSON.stringify({ episodeTitle: "Lovable Losers", episodeFacts: sure("Nate Moore") }) + "\n```";
  assert.deepEqual(FR.parseFactsAnswer(fenced), { found: true, episodeFacts: sure("Nate Moore"), episodeTitle: "Lovable Losers", repairs: [] });
  assert.deepEqual(FR.parseFactsAnswer(JSON.stringify(sure("Nate Moore"))).episodeFacts, sure("Nate Moore"), "a fact on its own");
  const top = FR.parseFactsAnswer(JSON.stringify({ isQuote: "Yes", line: "a line", by: "Nate Moore", sure: "certain" }));
  assert.deepEqual(top.episodeFacts, { titleQuote: { isQuote: "yes", line: "a line", by: "Nate Moore", sure: "low" } }, "its fields at the top, a bad value repaired");
  assert.equal(top.repairs.length, 1);
  // Its fields flattened beside the fact (a run's answer once came back so): read as the fact, the repair said.
  const flat = FR.parseFactsAnswer(JSON.stringify({ episodeTitle: "Is He Throwing It?", episodeFacts: { titleQuote: "unknown", line: null, by: null, sure: "low" } }));
  assert.deepEqual(flat.episodeFacts, UNSURE);
  assert.match(flat.repairs[0], /fields were beside it/);
  // ... and flattened at the top.
  assert.deepEqual(FR.parseFactsAnswer(JSON.stringify({ episodeTitle: "x", titleQuote: "yes", line: "a line", by: "Nate Moore", sure: "high" })).episodeFacts, sure("Nate Moore"));
  // Stray fields with no title quote beside them aren't one.
  assert.deepEqual(F.looseEpisodeFacts({ sure: "low" }), { titleQuote: null });
  // An answer's title against the episode's: case, accents and punctuation aside; either unknown, nothing to go on.
  assert.ok(FR.sameTitle("I'm a Wolf, Baby", "i’m a wolf baby"));
  assert.ok(!FR.sameTitle("Lovable Losers", "Cinema"));
  assert.ok(FR.sameTitle(null, "Cinema") && FR.sameTitle("Cinema", null));
  // The cast's word: the show's plural, its word with an s, or cast members.
  assert.equal(FR.termOf({ castaway_term: "Castaway" }), "castaways");
  assert.equal(FR.termOf({ castaway_term: "Person", castaway_plural: "People" }), "people");
  assert.equal(FR.termOf({}), "cast members");
  assert.deepEqual(FR.parseFactsAnswer(JSON.stringify({ episodeFacts: sure("Nate Moore") }), []), { found: false, episodeFacts: null, episodeTitle: null, repairs: [] }, "only what was asked");
  assert.equal(FR.parseFactsAnswer(JSON.stringify({ episodeTitle: "x", note: "couldn't find it" })).found, false);
  assert.throws(() => FR.parseFactsAnswer("I couldn't find anything."), /no JSON/);
  assert.equal(FR.factsLine(sure("Nate Moore")), "Title quote: Nate Moore, sure");
  assert.equal(FR.factsLine({ titleQuote: { ...sure("Nate Moore").titleQuote, sure: "low" } }), "Title quote: still not sure (it said Nate Moore)");
  assert.equal(FR.factsLine({ titleQuote: { isQuote: "no", line: null, by: null, sure: "high" } }), "Title quote: the title isn't a line from it, sure");
});

/** A stand-in database: one season, its stored answer for episode 3 (`facts`: its episodeFacts section; undefined: none stored). */
function fakeDb({ facts = UNSURE, stored = true, title = "Lovable Losers", castaways = CAST } = {}) {
  const db = { research: stored ? { id: "er-1", payload: { episodeTitle: title, castaways: castaways.map((name) => ({ name })), ...(facts === undefined ? {} : { episodeFacts: facts }) }, provenance: { provider: "bot" } } : null, runs: [], writes: [] };
  const query = async (sql, params = []) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(s)) return { rows: [] };
    if (s.startsWith("SELECT pg_advisory_xact_lock")) return { rows: [{}] };
    if (s.startsWith("INSERT INTO bot_research_runs")) {
      db.runs.push({ id: `run-${db.runs.length + 1}`, kind: params[3] });
      return { rows: [{ id: db.runs[db.runs.length - 1].id }] };
    }
    if (s.startsWith("UPDATE bot_research_runs SET finished_at")) {
      Object.assign(db.runs.find((r) => r.id === params[0]), { ok: params[1], message: params[2] });
      return { rows: [] };
    }
    if (s.startsWith("SELECT s.name, s.castaway_term, s.castaway_plural, ss.show_id")) {
      const r = db.research;
      return { rows: [{ name: "Survivor", castaway_term: "Castaway", show_id: "show-1", season_number: 49, research_id: r ? r.id : null, facts: r ? (r.payload.episodeFacts ?? null) : null, title: r ? r.payload.episodeTitle : null, listed: null, asked: r ? r.payload.castaways.map((c) => c.name) : null, cast_names: CAST }] };
    }
    if (s.startsWith("SELECT id, payload->'episodeFacts' AS facts FROM episode_research")) return { rows: db.research ? [{ id: db.research.id, facts: db.research.payload.episodeFacts ?? null }] : [] };
    if (s.startsWith("UPDATE episode_research SET payload = jsonb_set")) {
      db.research.payload.episodeFacts = JSON.parse(params[1]);
      db.research.provenance = { ...db.research.provenance, factsRun: JSON.parse(params[2]) };
      db.writes.push(JSON.parse(params[1]));
      return { rows: [] };
    }
    throw new Error(`the stand-in doesn't know: ${s.slice(0, 80)}`);
  };
  db.pool = { query, connect: async () => ({ query, release() {} }) };
  return db;
}
const SEASON = { id: "season-1", show_id: "show-1", season_number: 49, slug: "survivor" };
const job = { season: SEASON, episode: 3, kind: "facts", slot: "facts@750" };
/** A stand-in bot: answers each prompt with `answer`, keeping what it was asked. */
const botSays = (answer) => {
  const asked = [];
  const ask = async (prompt) => {
    asked.push(prompt);
    return { answer: typeof answer === "string" ? answer : JSON.stringify(answer) };
  };
  return { ask, asked };
};

test("a facts run: no stored answer yet is a failed try; nothing unsure asks nothing; an unsure one is asked and filed", async () => {
  // The full run hasn't landed: a failed try (asked again 20 minutes on), the bot never asked.
  let db = fakeDb({ stored: false });
  let bot = botSays({ episodeFacts: sure("Nate Moore") });
  let out = await Bot.runJob(db.pool, job, { ask: bot.ask });
  assert.equal(out.ok, false);
  assert.match(out.message, /research isn't in yet/);
  assert.equal(bot.asked.length, 0);
  assert.deepEqual(db.runs.map((r) => [r.kind, r.ok]), [["facts", false]]);
  // Research was sure: nothing to ask, done.
  db = fakeDb({ facts: sure("Nate Moore") });
  bot = botSays({ episodeFacts: UNSURE });
  out = await Bot.runJob(db.pool, job, { ask: bot.ask });
  assert.equal(out.ok, true);
  assert.equal(out.message, "Nothing to ask: research was sure of its facts");
  assert.equal(bot.asked.length, 0);
  assert.deepEqual(db.writes, []);
  // Research wasn't sure: asked once, with the episode's title and the names the full run was asked about, and filed.
  db = fakeDb();
  bot = botSays({ episodeTitle: "Lovable Losers", episodeFacts: sure("Nate Moore") });
  out = await Bot.runJob(db.pool, job, { ask: bot.ask });
  assert.equal(out.ok, true);
  assert.equal(out.message, "Title quote: Nate Moore, sure");
  assert.equal(bot.asked.length, 1);
  assert.match(bot.asked[0], /^Survivor season 49, episode 3, titled "Lovable Losers"\./);
  assert.match(bot.asked[0], /The castaways in this episode .*\n1\. Jawan Pitts\n2\. Nate Moore/);
  assert.deepEqual(db.research.payload.episodeFacts, sure("Nate Moore"));
  assert.equal(db.research.provenance.factsRun.runId, "run-1");
  assert.deepEqual(db.research.provenance.factsRun.asked, ["titleQuote"]);
  assert.equal(db.research.provenance.provider, "bot", "the rest of its provenance kept");
  // No section stored at all (a pass that left it out): asked the same.
  db = fakeDb({ facts: undefined });
  out = await Bot.runJob(db.pool, job, { ask: botSays({ episodeFacts: sure("Jawan Pitts") }).ask });
  assert.equal(out.ok, true);
  assert.deepEqual(db.research.payload.episodeFacts, sure("Jawan Pitts"));
});

test("a facts run's other ends: still unsure is filed and done; no facts in the answer is a failed try; a dry run files nothing", async () => {
  let db = fakeDb();
  const still = { titleQuote: { isQuote: "yes", line: null, by: "Nate Moore", sure: "low" } };
  let out = await Bot.runJob(db.pool, job, { ask: botSays({ episodeFacts: still }).ask });
  assert.equal(out.ok, true, "asking again a few minutes on seldom says more");
  assert.equal(out.message, "Title quote: still not sure (it said Nate Moore)");
  assert.deepEqual(db.research.payload.episodeFacts, still, "the later unsure answer in place of the earlier");
  db = fakeDb();
  out = await Bot.runJob(db.pool, job, { ask: botSays({ episodeTitle: "Lovable Losers" }).ask });
  assert.equal(out.ok, false);
  assert.match(out.message, /No episode facts in the answer about Episode 3/);
  assert.deepEqual(db.writes, []);
  db = fakeDb();
  out = await Bot.runJob(db.pool, job, { ask: botSays("Sorry, I can't browse right now.").ask });
  assert.equal(out.ok, false, "no JSON at all: a failed try");
  // An answer about another episode (the bot's chat carried an earlier question over): a failed try, nothing filed.
  db = fakeDb();
  out = await Bot.runJob(db.pool, job, { ask: botSays({ episodeTitle: "Cinema", episodeFacts: sure("Nate Moore") }).ask });
  assert.equal(out.ok, false);
  assert.match(out.message, /was about "Cinema", not Episode 3/);
  assert.deepEqual(db.writes, []);
  db = fakeDb();
  out = await Bot.runJob(db.pool, job, { ask: botSays({ episodeFacts: sure("Nate Moore") }).ask, dry: true });
  assert.equal(out.ok, true);
  assert.match(out.message, /\(dry run: not filed\)$/);
  assert.deepEqual(db.writes, []);
  assert.deepEqual(db.runs, [], "a dry run keeps no run row");
});

test("a sure answer kept over an unsure one: filing never replaces it, and a full run landing after the run keeps what it settled", async () => {
  // A full run that landed sure while the run was asking: the run's unsure answer doesn't replace it.
  const db = fakeDb({ facts: sure("Sage Ahrens-Nichols") });
  const filed = await FR.storeFacts(db.pool, { showId: "show-1", season: 49, episode: 3 }, UNSURE, { runId: "run-9" });
  assert.deepEqual(filed, { changed: false, episodeFacts: sure("Sage Ahrens-Nichols") });
  assert.deepEqual(db.writes, [], "nothing written");
  // A sure correction does.
  assert.deepEqual((await FR.storeFacts(db.pool, { showId: "show-1", season: 49, episode: 3 }, sure("Nate Moore"), {})).episodeFacts, sure("Nate Moore"));
  // No stored answer: nothing filed.
  assert.equal(await FR.storeFacts(fakeDb({ stored: false }).pool, { showId: "show-1", season: 49, episode: 3 }, sure("Nate Moore"), {}), null);
  // The second full run, after the facts run filed a sure answer, merged as it is (filling in): the run's answer stays.
  const stored = { episodeTitle: "Lovable Losers", castaways: [{ name: "Nate Moore", confidence: "high" }], episodeFacts: sure("Nate Moore") };
  const later = { episodeTitle: "Lovable Losers", castaways: [{ name: "Nate Moore", confidence: "high" }], episodeFacts: UNSURE };
  for (const fill of [true, false]) assert.deepEqual(Research.mergeResearchPayload(stored, later, { fill }).payload.episodeFacts, sure("Nate Moore"));
});

test("the facts run on the schedule: a kind of its own, from the episode's end, three tries 20 minutes apart, never past the final results", () => {
  assert.deepEqual(Bot.normalizeSchedule([{ kind: "facts", after: 750 }]), [{ kind: "facts", after: 750, on: true }]);
  assert.throws(() => Bot.normalizeSchedule([{ kind: "fact", after: 750 }]), /kind must be/);
  const AIRED = new Date("2026-10-22T00:05:00Z");
  const due = Bot.dueAt({ kind: "facts", after: 750 }, AIRED.getTime() + 90 * 60 * 1000, null, AIRED.getTime());
  assert.equal(due.toISOString(), "2026-10-22T14:05:00.000Z", "10:05 AM Eastern, before 12:00 PM's final results");
  const t = (m) => new Date(due.getTime() + m * 60 * 1000).toISOString();
  assert.equal(Bot.nextTryAt("facts", due, [{ started_at: due, ok: false }]).toISOString(), t(20));
  assert.equal(Bot.nextTryAt("facts", due, [0, 20, 40].map((m) => ({ started_at: new Date(t(m)), ok: false }))), null, "three tries");
  assert.equal(Bot.nextTryAt("facts", due, [{ started_at: due, ok: true }]), null);
  const runs = (now) => Bot.dueRuns({ schedule: [{ kind: "facts", after: 750, on: true }], since: null, airTimes: [{ episode: 5, at: AIRED }], episodeMinutes: 90, history: [], now }).map((r) => r.slot);
  assert.deepEqual(runs(new Date(due.getTime() - 1)), []);
  assert.deepEqual(runs(due), ["facts@750"]);
  assert.deepEqual(runs(new Date(due.getTime() + 60 * 60 * 1000)), ["facts@750"], "a try an hour late, before noon's final results");
  assert.deepEqual(runs(new Date("2026-10-22T16:00:00Z")), [], "never once the final results are in (12:00 PM Eastern): a game's week is final");
  // An episode that ends late (10 PM, two hours: midnight): 12 hr 30 min on would be after noon's final results, so it comes an hour
  // before them (11:00 AM Eastern), retries and all.
  const late = new Date("2026-10-22T02:00:00Z");
  const plan = { schedule: [{ kind: "facts", after: 750, on: true }], since: null, airTimes: [{ episode: 5, at: late }], episodeMinutes: 120, history: [], tz: "America/New_York" };
  assert.equal(Bot.dueFor({ kind: "facts", after: 750 }, late.getTime() + 120 * 60 * 1000, null, late.getTime(), "America/New_York").toISOString(), "2026-10-22T15:00:00.000Z");
  assert.deepEqual(Bot.dueRuns({ ...plan, now: new Date("2026-10-22T15:00:00Z") }).map((r) => r.slot), ["facts@750"]);
  assert.equal(Bot.nextRunAt({ ...plan, now: late }).toISOString(), "2026-10-22T15:00:00.000Z");
  // A 3 AM drop (its final results that noon, the night before's): an hour before them; one still running then never gets one; any
  // other run is as dueAt has it.
  const drop = Date.parse("2026-10-22T07:00:00Z");
  assert.equal(Bot.dueFor({ kind: "facts", after: 750 }, drop + 60 * 60 * 1000, null, drop, "America/New_York").toISOString(), "2026-10-22T15:00:00.000Z");
  assert.equal(Bot.dueFor({ kind: "facts", after: 750 }, Date.parse("2026-10-22T15:30:00Z"), null, drop, "America/New_York"), null);
  assert.equal(Bot.dueFor({ kind: "full", after: 720 }, late.getTime(), null, late.getTime()).getTime(), late.getTime() + 720 * 60 * 1000);
  // Our usual has it, half an hour after the morning's full run.
  assert.ok(Bot.DEFAULT_SCHEDULE.some((r) => r.kind === "facts" && r.after === 750 && r.on));
  assert.ok(F.FACT_IDS.every((id) => FR.ASKS[id]), "every fact has its words in the run's prompt");
});
