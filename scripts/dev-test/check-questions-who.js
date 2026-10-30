// Dev-only check of questions about who and about each (docs/PLAN-start-a-game-gpt.md step A6: game-spec schema.js and
// answers.js, state-logic.js AnswerLogic.facts, src/lib/server/answers.ts), against the dev server, on new-fixture.js's couch
// (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5, three starting tribes dealt in turn, Toka, Savu and
// Dina; Episode 6 three days off; everyone has seen 5 but sam, 3).
//   - A game of questions: jordan starts a Survival Pool for Episode 6 on, riley and sam join it, and it's made a game of
//     questions through RosterLogic.setGame with the show's ctx (answers.ts questionContext: its tribes, no secret roles).
//     Four questions, each episode: Which tribe wins immunity? (a group, by who the moment happened to), Who finds an idol?
//     (name two), Does each one go home? (a yes or no for each castaway still in) and How many idols does each one find? (a
//     number for each). A Traitors question (a secret role) is refused: the show has none.
//   - Answering (GET/POST /api/seasons/[id]/answers?league=): the tribe question's faces are the three tribes, the questions
//     about each one's are the 13 still in; what an answer can't be (a castaway for a tribe, someone gone, a non-answer, a third
//     pick, a negative number); sam, behind, can't answer any of them until he's seen Episode 5.
//   - The lock (Episode 6 airs), then Episode 6's results with a swap, as research stages them (season_decisions): a Toka
//     castaway moves to Savu ('group', research's newGroup) and a Dina one to a new tribe, Belo; Savu wins immunity with the
//     mover, two castaways find idols, a Dina castaway goes home.
//   - Graded on read, at each viewer's mark: jordan, once he's seen 6, has the tribe right (Savu, with the castaway who moved),
//     an idol, both of his yes-or-nos and both counts: 7 points, and the Games tab ranks by them; riley, who named Toka (right
//     only if the swap were missed), has none, and sees nothing settled until she's seen 6, nor the name of the tribe it made;
//     Episode 7's tribe question names all four.
//   - The game-specs flag's check passes on it (with the flag off, as in production, a NOTE for what it skips).
//   In a real browser at --width (390 by default), as jordan before the lock: the sheet's tribe question as the three tribes,
//   the questions about each one saying so (their own screen is the UI track's); nothing wider than the screen; no page errors.
//   Screenshots go to <outDir>.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-questions-who.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a
// non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-questions-who runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-questions-who.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const QUESTIONS = [
  { id: "tribe", ask: "Which tribe wins immunity?", answer: "group", points: 1, asked: "each", settle: { by: "moment", moment: "tribeImmunity", take: "who" } },
  { id: "finds", ask: "Who finds an idol?", answer: "person", points: 2, pick: 2, asked: "each", settle: { by: "moment", moment: "idolFound", take: "who" } },
  { id: "goes", ask: "Does each one go home?", answer: "yesNo", points: 1, asked: "each", each: "person", settle: { by: "results", take: "out" } },
  { id: "idols", ask: "How many idols does each one find?", answer: "number", points: 1, asked: "each", each: "person", settle: { by: "moment", moment: "idolFound", take: "count" } },
];

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    // Results an admin accepted reach every league on the season, as on Survivor 51.
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const q = `?couch=${couch}`;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);

    // ---------- A game of questions about who and about each ----------
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false });
    const QG = r.body.leagueId;
    check(r.status === 200 && !!QG, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    for (const who of ["riley", "sam"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${QG}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${QG}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const ctx = await questionContext(QG, sid);
    const research = (id) => ctx.moments.find((m) => m.id === id)?.answeredBy === "research";
    check(research("tribeImmunity") && research("idolFound") && ctx.grouped === true && G.sameValue(ctx.roles, []), "the show's ctx: research answers tribe immunity and idols, its cast is in tribes, no secret roles", JSON.stringify({ grouped: ctx.grouped, roles: ctx.roles }));
    const make = async (ask) => {
      const state = (await league(QG)).state;
      const problems = S.setGame(state, { spec: 1, span: S.gameOf(state).span, get: { by: "none" }, score: { by: "answers" }, ask }, { ctx });
      if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), QG]);
      return problems;
    };
    let problems = await make([...QUESTIONS, { id: "traitors", ask: "Who are the Traitors?", answer: "person", points: 1, pick: 3, settle: { by: "role", role: "Traitor", take: "who" } }]);
    check(problems.length === 1 && problems[0].at === "ask[4].settle.role", "  a secret role's question is refused: the show has none (the data rule)", JSON.stringify(problems));
    problems = await make(QUESTIONS);
    const made = (await league(QG)).state;
    check(!problems.length && made.settings.leagueTypeId === "questions" && S.AnswerLogic.questions(made).length === 4, "  the four are written: a game of questions", JSON.stringify(problems));

    // Who's on which tribe (the fixture deals them in turn), and who's still in.
    const tribe = new Map(made.tribes.map((t) => [t.name, t.id]));
    const still = made.castaways.filter((c) => c.status !== "eliminated");
    const on = (name) => still.filter((c) => c.tribeId === tribe.get(name));
    // The mover goes from Toka to Savu at 6; tokaStays and finder find idols; goesHome goes home; unfound finds nothing.
    const [mover, tokaStays] = on("Toka");
    const [goesHome, finder, unfound] = on("Dina");
    check(still.length === 13 && on("Toka").length >= 3 && on("Savu").length >= 3 && on("Dina").length >= 3, "the fixture: 13 still in across Toka, Savu and Dina", JSON.stringify([...tribe.keys()].map((n) => [n, on(n).length])));

    // ---------- Answering ----------
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    const byId = (x, id) => x.questions?.find((y) => y.id === id);
    let g = await read("jordan");
    const tribeFaces = byId(g, "tribe")?.faces ?? [];
    check(
      g.episode === 6 && g.questions?.length === 4 && G.sameValue(tribeFaces.map((f) => f.name).sort(), ["Dina", "Savu", "Toka"]) && byId(g, "tribe").pick === 1,
      "jordan reads Episode 6's four: Which tribe? as the three tribes someone still in is on",
      JSON.stringify(byId(g, "tribe"))
    );
    check(byId(g, "goes")?.each === "person" && byId(g, "goes").faces?.length === 13 && byId(g, "idols")?.faces?.length === 13 && byId(g, "goes").pick === null, "  the questions about each one ask about the 13 still in", JSON.stringify(byId(g, "goes")).slice(0, 300));
    check(G.sameValue(g.groups?.map((x) => x.name).sort(), ["Dina", "Savu", "Toka"]), "  and the read names every group, for the answers", JSON.stringify(g.groups));
    r = await ask("jordan", { answers: { tribe: tribe.get("Savu"), finds: [finder.id, unfound.id], goes: { [goesHome.id]: "yes", [mover.id]: "no" }, idols: { [finder.id]: 1, [tokaStays.id]: 0 } } });
    check(r.status === 200 && byId(r.body, "tribe")?.mine === tribe.get("Savu") && G.sameValue(byId(r.body, "goes")?.mine, { [goesHome.id]: "yes", [mover.id]: "no" }), "jordan answers all four: Savu, two idol finders, a yes or no for two, a count for two", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    const gone = made.castaways.find((c) => c.status === "eliminated");
    for (const [body, why] of [
      [{ answers: { tribe: mover.id } }, "a castaway for a tribe"],
      [{ answers: { tribe: [tribe.get("Toka"), tribe.get("Dina")] } }, "two tribes for a question that names one"],
      [{ answers: { goes: { [gone.id]: "yes" } } }, "someone already gone"],
      [{ answers: { goes: { [mover.id]: "maybe" } } }, "not a yes or no"],
      [{ answers: { goes: "yes" } }, "one answer for a question about each one"],
      [{ answers: { finds: [finder.id, unfound.id, mover.id] } }, "a third pick"],
      [{ answers: { idols: { [finder.id]: -1 } } }, "a negative count"],
    ]) {
      r = await ask("riley", body);
      check(r.status === 400, `  refused: ${why} (400)`, `${r.status} ${JSON.stringify(r.body)}`);
    }
    r = await ask("riley", { answers: { tribe: tribe.get("Toka"), goes: { [goesHome.id]: "no" }, idols: { [finder.id]: 0 } } });
    check(r.status === 200, "riley answers three: Toka, a no, a count", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    g = await read("riley");
    check(byId(g, "goes")?.answered === 2 && g.questions.every((x) => x.people.length === 0 && x.verdict === null), "  nobody's answers show before the lock, only how many", JSON.stringify(byId(g, "goes")).slice(0, 300));
    g = await read("sam");
    check(["tribe", "finds", "goes", "idols"].every((id) => byId(g, id)?.status === "behind" && byId(g, id).catchUp === 5 && byId(g, id).faces === null), "sam, at Episode 3: all four wait for him to see 5 (who's still in, and on what tribe)", JSON.stringify(g.questions?.map((x) => [x.id, x.status, x.catchUp])));
    r = await ask("sam", { answers: { tribe: tribe.get("Savu") } });
    check(r.status === 403, "  naming a tribe is refused (403)", `${r.status} ${JSON.stringify(r.body)}`);

    // ---------- In the browser: the sheet before the lock ----------
    if (!apiOnly) {
      const b = await open({ user: "zt_nd_jordan", pass: PASSWORD, width, height: 844 });
      closers.push(b.close);
      const errors = [];
      b.page.on("pageerror", (e) => errors.push(e.message));
      const page = b.page;
      await page.goto(`${BASE}/show/${sid}/games`, { waitUntil: "load" });
      const row = page.locator(`[data-sheet-row="${QG}"]`);
      await row.waitFor({ timeout: 30000 });
      await row.scrollIntoViewIfNeeded();
      await row.click();
      const sheet = page.locator(`[data-sheet="${QG}"]`);
      await sheet.waitFor({ timeout: 20000 });
      await page.waitForTimeout(500);
      const names = await sheet.locator("[data-question=tribe] [data-answer-face]").evaluateAll((els) => els.map((e) => e.getAttribute("data-answer-name")));
      check(G.sameValue([...names].sort(), ["Dina", "Savu", "Toka"]), "the sheet: Which tribe? as the three tribes, Savu chosen", JSON.stringify(names));
      check((await sheet.locator(`[data-question=tribe] [data-answer-face="${tribe.get("Savu")}"]`).getAttribute("aria-pressed")) === "true", "  his Savu is marked");
      check((await sheet.locator("[data-question=goes] [data-question-each]").isVisible()) && (await sheet.locator("[data-question=idols] [data-question-each]").isVisible()), "  the questions about each one say so (their screen is the UI track's)");
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(over <= 0, `  nothing wider than the screen at ${width}`, `${over}px over`);
      await page.screenshot({ path: path.join(out, "01-sheet-who.png") });
      check(errors.length === 0, "  no page errors", errors.join(" | "));
      await b.close();
    }

    // ---------- The lock: Episode 6 airs ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    r = await ask("riley", { answers: { tribe: tribe.get("Savu") } });
    check(r.status === 409 && /closed when Episode 6 started/.test(r.body?.error ?? ""), "Episode 6 has started: an answer is refused (409)", `${r.status} ${JSON.stringify(r.body)}`);
    g = await read("jordan");
    const goesQ = byId(g, "goes");
    check(g.questions.every((x) => x.status === "closed") && goesQ.people.length === 2 && goesQ.people[0].you && goesQ.verdict?.state === "waiting", "  locked: everyone's answers show, jordan first, still to settle", JSON.stringify(goesQ.people));

    // ---------- Episode 6's results, with a swap ----------
    // As research stages them: the mover's new tribe (newGroup), Savu (with the mover) wins immunity, two find idols, a Dina
    // castaway goes home.
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const savu = [...on("Savu"), mover];
    // And one of Dina's onto a tribe nobody's been on: its name alone would say a swap happened.
    const newTribe = on("Dina")[3];
    const rows = [
      ["group", mover.name, "Savu", ""],
      ["group", newTribe.name, "Belo", ""],
      ...savu.map((c) => ["event", c.name, "", "tribeImmunity"]),
      ["event", finder.name, "", "idolFound"],
      ["event", tokaStays.name, "", "idolFound"],
      ["elimination", goesHome.name, "Voted Out", ""],
    ];
    for (const [kind, name, method, eventType] of rows) {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, 6, $2, $3, $4, $5, 'accepted', true, now(), false)`,
        [sid, kind, name, method, eventType]
      );
    }
    await syncSeasonLeagues(sid, null);
    const synced = (await league(QG)).state;
    const e6 = synced.episodes.find((e) => e.number === 6);
    check(!!e6 && S.resultsStage(e6) === "final" && (e6.groups ?? []).some((x) => x.castawayId === mover.id && x.tribeId === tribe.get("Savu")), "Episode 6's results reach it: the swap, Savu's immunity, the idols, who went home", JSON.stringify(e6 && { stage: S.resultsStage(e6), groups: e6.groups }));

    // ---------- Graded on read, as each one has seen it ----------
    g = await read("jordan", 6);
    check(g.points === 0 && byId(g, "tribe").verdict?.state === "waiting", "jordan hasn't seen Episode 6: nothing graded for him yet", JSON.stringify({ points: g.points, v: byId(g, "tribe").verdict }));
    await seen("jordan", 6);
    g = await read("jordan", 6);
    const me = (x) => x.people.find((p) => p.you);
    const tv = byId(g, "tribe").verdict;
    check(tv?.state === "known" && G.sameValue(tv.groups, [tribe.get("Savu")]) && me(byId(g, "tribe")).right === true, "once he's seen it: Which tribe? Savu, the mover with them, right (1)", JSON.stringify(tv));
    check(me(byId(g, "finds")).earned === 2 && me(byId(g, "goes")).earned === 2 && me(byId(g, "idols")).earned === 2, "  an idol finder named (2), both yes-or-nos right (2), both counts closest (2)", JSON.stringify(["finds", "goes", "idols"].map((id) => [id, me(byId(g, id))])));
    const gv = byId(g, "goes").verdict;
    check(gv?.state === "known" && gv.each?.[goesHome.id]?.right?.[0] === "yes" && gv.each?.[mover.id]?.right?.[0] === "no" && Object.keys(gv.each).length === 13, "  Does each one go home? settled for each of the 13: yes for who went, no for the rest", JSON.stringify(gv).slice(0, 300));
    check(g.points === 7, "  7 points in all", String(g.points));
    const riley = byId(g, "tribe").people.find((p) => !p.you);
    check(riley?.right === false && byId(g, "goes").people.find((p) => !p.you)?.right === false, "  riley's Toka was wrong: the mover counts for Savu from the swap's episode", JSON.stringify(riley));
    const rg = await read("riley", 6);
    check(rg.points === 0 && byId(rg, "tribe").verdict?.state === "waiting", "riley, still at 5, sees nothing settled", JSON.stringify({ points: rg.points, v: byId(rg, "tribe").verdict }));
    check(!rg.groups.some((x) => x.name === "Belo") && g.groups.some((x) => x.name === "Belo"), "  and no group Episode 6 made (Belo): jordan, who's seen it, has it", JSON.stringify({ riley: rg.groups.map((x) => x.name), jordan: g.groups.map((x) => x.name) }));
    const g7 = await read("jordan");
    check(g7.episode === 7 && G.sameValue(byId(g7, "tribe").faces.map((x) => x.name).sort(), ["Belo", "Dina", "Savu", "Toka"]), "  Episode 7's tribe question names the four tribes someone's on now", JSON.stringify(byId(g7, "tribe").faces));
    const games = (await as.jordan.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? [];
    const table = games.find((x) => x.leagueId === QG)?.table ?? [];
    check(table[0]?.userId === fx.users.jordan && table[0].total === 7, "the Games tab ranks it by points: jordan first, 7", JSON.stringify(table.map((t) => [t.name, t.total])));

    // ---------- The flag ----------
    const flagged = checkLeague((await league(QG)).state);
    check(flagged.ok, "the game-specs flag's check passes on it", JSON.stringify(flagged));
    if (specsOn) check(GameSpecs.carryGame(JSON.parse(JSON.stringify((await league(QG)).state.settings)), true) === false, "  and its carried spec is in step");
    else console.log("NOTE  the game-specs flag is off: whether its carried spec is in step was skipped");
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
