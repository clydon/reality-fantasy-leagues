// The Start-a-game GPT's bank (docs/PLAN-start-a-game-gpt.md step G1): requests typed on a show's page, page + words -> the bot's
// draft -> our check's game. Two parts, one list of requests: the hand-written cases (./cases.json: the bot's mistakes and the
// paths around a game) and every request of the capability tracker (../engine-capabilities.json), each drafted ideally here
// (idealDraft: its spec as the game, their words quoted for each part, any number they didn't say listed as assumed), so our
// check is proven never to change a good draft. Read by tests/game-words.test.js (on the stand-in: no bot) and
// scripts/dev-test/check-game-words.js (against the real bot, which writes nothing).
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..", "..");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(ROOT, "src") } });
const { pageCtx } = jiti("../../../src/lib/game/capability-rows.ts");
const SP = jiti("../../../src/lib/sports/page.ts");
const { sportOf } = jiti("../../../src/lib/sports/index.ts");
const W = require("../../../src/lib/game/game-words/index.js");
const C = require("../../../src/lib/game/game-spec/capabilities.js");

const CASES = path.join(__dirname, "cases.json");
const TRACKER = path.join(__dirname, "..", "engine-capabilities.json");

/** The hand-written cases. */
const cases = () => JSON.parse(fs.readFileSync(CASES, "utf8")).cases;

/** The tracker's requests (every row with words), each with its part. */
const requests = () => C.rowsOf(JSON.parse(fs.readFileSync(TRACKER, "utf8"))).filter((r) => r.words);

/** What a page can settle (its rulebook's ctx), named for its show, with the couch and who can be drafted when it says. */
function ctxOf(page) {
  const base = pageCtx(page);
  if (!base) return null;
  return {
    ...base,
    show: C.pageName(page),
    ...(Number.isInteger(page && page.couch) ? { couch: page.couch } : {}),
    ...(Number.isInteger(page && page.pool) ? { pool: page.pool } : {}),
  };
}

/** G3: a sport's page's standard games (its ESPN league's: sports/page.ts sportGames), for our check's tables; none for a show's. */
const gamesOf = (page) => (page && page.sport && page.espn ? SP.sportGames(page.espn, { playoffs: page.playoffs === true }) : []);

/** A sport's page's part of the pack (G3): its sport, its stats in their words and its standard game, from its ESPN league (no games
 *  or teams: the bank has no schedule, a case's page can list its own `teams` and `games`). */
function sportInput(page) {
  const sport = page && page.espn ? sportOf(page.espn) : null;
  if (!sport) return {};
  const std = SP.sportStandard(page.espn);
  return {
    sport: { id: sport.id, name: sport.name, league: page.espn },
    stats: SP.statWords(sport),
    ...(std ? { standard: { ...std, games: gamesOf(page).map((g) => ({ id: g.id, about: g.about })) } } : {}),
    ...(Array.isArray(page.teams) ? { teams: page.teams } : {}),
    ...(Array.isArray(page.games) ? { games: page.games } : {}),
  };
}

/** A page's context pack, from its rulebook alone (no cast: the bank has no database); a sport's from its ESPN league. */
const packOf = (page, ctx = ctxOf(page)) =>
  W.packOf({
    label: C.pageName(page),
    ...(page && page.show ? { show: page.show } : {}),
    ...(page && Number.isInteger(page.season) ? { season: page.season } : {}),
    kind: page && page.sport ? "sport" : "show",
    ctx: ctx || {},
    couch: Number.isInteger(page && page.couch) ? { people: page.couch } : null,
    ...(page && page.sport ? sportInput(page) : {}),
  });

/** What our check is given for a page: its ctx, its pack and, a sport's, its standard games. */
const checkOpts = (page, words, ctx = ctxOf(page)) => ({ ctx, pack: packOf(page, ctx), words, games: gamesOf(page) });

/** The draft an ideal bot answers for a tracker row whose spec plays: the spec, each part said in their words, any number they
 *  didn't say assumed. */
function idealDraft(row) {
  const spec = row.spec;
  const said = Object.keys(spec)
    .filter((k) => k !== "spec")
    .map((part) => ({ part, quote: row.words }));
  const inWords = W.numbersIn(row.words);
  const assumed = [];
  const walk = (v, p) => {
    if (typeof v === "number") {
      if (!inWords.has(Math.abs(v))) assumed.push({ part: p, value: v, why: "the stand-in: not in their words" });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
  };
  walk(spec, "");
  return { draft: 1, game: spec, said, assumed, ask: [], cantYet: [], summary: "" };
}

/** A case's answer as the bot sends it: its raw text, or its object as JSON. */
const answerOf = (c) => (typeof c.answer === "string" ? c.answer : JSON.stringify(c.answer));

module.exports = { CASES, TRACKER, cases, requests, ctxOf, packOf, gamesOf, checkOpts, idealDraft, answerOf };
