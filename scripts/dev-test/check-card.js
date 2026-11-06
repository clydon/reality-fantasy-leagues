// Dev-only check of a new card each week (docs/PLAN-start-a-game-gpt.md track C, C7: game-spec schema.js card, askOf, drawInTurn;
// answers.js's grading of a card's lines; state-logic.js AnswerLogic.questions; src/lib/server/answers.ts's read of a line), against
// the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT
// Survivor 51: results through Episode 5, Episode 6 three days off).
//   - The user's first game (tracker row p10), small: jordan starts a Survival Pool for Episode 6 on, riley and sam join it, and it's
//     made a game of questions through RosterLogic.setGame with the show's ctx: a bank of 100; who goes home (any of your bank, no
//     points of its own); a sheet on the card (two of immunity, an idol found and a reward each episode, in turn: whether each
//     happens, a point and up to 20 of your bank on each); and a ticket built from who goes home and the sheet, up to 10.
//   - Before Episode 6: the read asks the card's two lines as questions of their own (sheet.1, sheet.2), each saying its moment
//     (Episode 6: an idol found, a reward, the list's second and third), and the ticket is built from who goes home and both lines.
//     A ticket naming the sheet itself (not a line) refused. jordan stakes 20 on the boot, 10 on yes (an idol), 5 on no (a reward),
//     and a ticket of the boot and the idol's line for 5; riley 20 on no idol, nothing on yes to a reward, and a ticket of both lines
//     for 10; sam 10 on no reward.
//   - Episode 6's results (the boot out, an idol found, no reward): jordan 100 + 20 + 11 + 6 + 15 (his ticket, 3 x 5) = 152; riley 100
//     - 20 - 10 = 70; sam 100 + 11 = 111. The Games tab ranks them; Episode 7's card is the next two (immunity, an idol found); the
//     flag's check.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-card.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-card runs against a local database only");
const args = process.argv.slice(2);

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const CARD = { from: "moments", each: 2, of: ["individualImmunity", "idolFound", "rewardWin"] };
const SHEET = [
  { id: "boot", ask: "Who goes home?", answer: "person", points: 0, asked: "each", wager: "total", settle: { by: "results", take: "out" } },
  { id: "sheet", ask: "This week's sheet", answer: "yesNo", points: 1, asked: "each", wager: 20, card: true, settle: { by: "moment", take: "happened" } },
  { id: "ticket", ask: "Build a ticket", answer: "ticket", points: 0, asked: "each", wager: 10, settle: { by: "legs", of: ["boot", "sheet"] } },
];
const BANK = { start: 100 };

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const q = `?couch=${couch}`;
    const as = {};
    for (const who of ["riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");

    // ---------- The game ----------
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false });
    const QG = r.body.leagueId;
    check(r.status === 200 && !!QG, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    for (const who of ["riley", "sam"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${QG}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${QG}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const state0 = (await league(QG)).state;
    const problems = S.setGame(state0, { spec: 1, span: S.gameOf(state0).span, get: { by: "none" }, score: { by: "answers", bank: BANK }, ask: SHEET, card: CARD }, { ctx: await questionContext(QG, sid) });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state0), QG]);
    const written = (await league(QG)).state.settings;
    check(!problems.length && written.leagueTypeId === "questions" && G.sameValue(written.gameCard, CARD) && written.questions[1].card === true, "  made the user's first game: a bank of 100, the card in its fields (gameCard), the sheet on it", JSON.stringify(problems));

    // ---------- Before Episode 6 ----------
    for (const who of ["riley", "jordan", "sam"]) await seen(who, 5);
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    const byId = (x, id) => x.questions?.find((y) => y.id === id);
    const lines = (x) => x.questions?.filter((y) => y.card).map((y) => [y.id, y.card.from, y.card.moment]);
    let g = await read("jordan");
    check(g.episode === 6 && G.sameValue(g.questions.map((x) => x.id), ["boot", "sheet.1", "sheet.2", "ticket"]), "jordan reads Episode 6's: who goes home, the card's two lines as questions of their own, the ticket", JSON.stringify([g.episode, g.questions?.map((x) => x.id)]));
    check(G.sameValue(lines(g), [["sheet.1", "sheet", "idolFound"], ["sheet.2", "sheet", "rewardWin"]]) && typeof byId(g, "sheet.1")?.card?.label === "string", "  Episode 6's card: an idol found and a reward (the list's second and third, in turn), each with its words", JSON.stringify(lines(g)));
    check(G.sameValue(byId(g, "ticket")?.ticket, { of: ["boot", "sheet.1", "sheet.2"], min: 2, max: 3, pays: [3, 7] }) && byId(g, "boot").card === null, "  the ticket: built from who goes home and both lines, two or three legs, 3 and 7 times the stake", JSON.stringify(byId(g, "ticket")?.ticket));
    const still = (await league(QG)).state.castaways.filter((c) => c.status !== "eliminated");
    const [gone6, finder, other] = still;
    r = await ask("jordan", { answers: { boot: { answer: gone6.id, stake: 20 }, "sheet.1": { answer: "yes", stake: 10 }, "sheet.2": { answer: "no", stake: 5 } } });
    check(r.status === 200, "jordan stakes 20 on the boot, 10 on an idol found, 5 on no reward", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("jordan", { answers: { ticket: { legs: ["boot", "sheet"], stake: 5 } } });
    check(r.status === 400, "  a ticket naming the sheet itself, not one of its lines, refused (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("jordan", { answers: { ticket: { legs: ["boot", "sheet.1"], stake: 5 } } });
    check(r.status === 200, "  a ticket of the boot and the idol's line for 5", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("riley", { answers: { boot: { answer: other.id, stake: 0 }, "sheet.1": { answer: "no", stake: 20 }, "sheet.2": { answer: "yes", stake: 0 }, ticket: { legs: ["sheet.1", "sheet.2"], stake: 10 } } });
    check(r.status === 200, "riley stakes 20 on no idol, nothing on a reward, and a ticket of both lines for 10, in one go", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("sam", { answers: { "sheet.2": { answer: "no", stake: 10 } } });
    check(r.status === 200, "sam stakes 10 on no reward", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("sam", { answers: { "sheet.3": { answer: "no", stake: 1 } } });
    check(r.status >= 400 && r.status < 500, "  a line the card doesn't have refused", `${r.status} ${JSON.stringify(r.body)}`);

    // ---------- Episode 6's results ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false), ($1, 6, 'event', $3, '', 'idolFound', 'accepted', true, now(), false)`,
      [sid, gone6.name, finder.name]
    );
    await syncSeasonLeagues(sid, null);
    for (const who of ["riley", "jordan", "sam"]) await seen(who, 6);
    // An idol found (yes), no reward (no). jordan: the boot's 20; yes, a point and 10; no, a point and 5; his ticket of the boot and
    // the idol, 3 x 5: 100 + 20 + 11 + 6 + 15 = 152. riley: no idol, 20 lost; yes to a reward, nothing staked; her ticket lost, 10:
    // 70. sam: no reward, a point and 10: 111.
    g = await read("jordan", 6);
    const me = (x) => x?.people.find((p) => p.you);
    const earned = (x) => Object.fromEntries(["boot", "sheet.1", "sheet.2", "ticket"].map((id) => [id, me(byId(x, id))?.earned ?? null]));
    check(G.sameValue(earned(g), { boot: 20, "sheet.1": 11, "sheet.2": 6, ticket: 15 }) && g.points === 152, "jordan at 6: the boot's 20, the idol's line 11, the reward's 6, his ticket 15: 152", JSON.stringify([earned(g), g.points]));
    const theirs = (id, name) => byId(g, id).people.find((p) => !p.you && p.name.includes(name))?.earned;
    check(theirs("sheet.1", "riley") === -20 && theirs("ticket", "riley") === -10 && theirs("sheet.2", "sam") === 11, "  riley's stake on the idol's line lost (-20) and her ticket (-10); sam's on the reward's won (11)", JSON.stringify([byId(g, "sheet.1").people.map((p) => [p.name, p.earned]), byId(g, "ticket").people.map((p) => [p.name, p.earned])]));
    const table = ((await as.jordan.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? []).find((x) => x.leagueId === QG)?.table ?? [];
    check(G.sameValue(table.map((t) => t.total), [152, 111, 70]) && table[0].userId === fx.users.jordan, "the Games tab ranks them: jordan 152, sam 111, riley 70", JSON.stringify(table.map((t) => [t.name, t.total])));
    g = await read("riley");
    check(g.episode === 7 && G.sameValue(lines(g), [["sheet.1", "sheet", "individualImmunity"], ["sheet.2", "sheet", "idolFound"]]), "riley's Episode 7: the card's next two, immunity and an idol found", JSON.stringify([g.episode, lines(g)]));

    // ---------- The flag ----------
    const flagged = checkLeague((await league(QG)).state);
    check(flagged.ok, "the game-specs flag's check passes on it", JSON.stringify(flagged));
    if (specsOn) check(GameSpecs.carryGame(JSON.parse(JSON.stringify((await league(QG)).state.settings)), true) === false, "  and its carried spec is in step");
    else console.log("NOTE  the game-specs flag is off: whether its carried spec is in step was skipped");
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
