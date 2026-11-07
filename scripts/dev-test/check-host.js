// Dev-only check of a rotating host's questions (docs/PLAN-start-a-game-gpt.md step A14 part 6: game-spec schema.js card.from 'host',
// cardLines and cardProblems; src/lib/server/host-cards.ts, the filing and the stamp with the air times; the host route; answers.ts's
// refusals; state-logic.js HostLogic and AnswerLogic.grade) against the dev server, through the API (no screens: they're the UI
// track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5, Episode 6 three days off,
// at 8 PM Eastern). In order:
//   - jordan starts a Survival Pool for Episode 6 on, riley and sam join it (its seats in that order), and it's made a game of
//     questions through RosterLogic.setGame with the show's ctx: a card a host chooses, two of immunity, an idol found and a reward,
//     the host's deadline 48 hours before the episode airs, the host sitting out their own card; a point for each line, yes or no.
//   - Before the deadline: the host route as each of the three: Episode 6's host jordan (the first seat), its deadline, then in turn
//     riley, sam, jordan. The card's lines can't be answered yet (409, the host's words). riley choosing refused (it's
//     jordan's turn); jordan choosing the couch's word, a moment twice or three refused; jordan's one line, then two, kept as his, in
//     his order (an idol found, then a reward); riley sees none of it, and the league's state as read has no Episode 6 card.
//   - The deadline passes (the premiere two days earlier: Episode 6 a day or less off, not aired): the next read files jordan's lines
//     and stamps them on the episode; jordan choosing again refused (nothing open: Episode 7's card opens with Episode 6's results,
//     riley next in turn). The answers route asks Episode 6's two
//     lines as jordan chose them; jordan answering his own card refused (he sits it out); riley yes, no; sam yes.
//   - Episode 6's results through the season sync (an idol found, no reward): riley 2, sam 1, jordan nothing; the Games tab ranks them;
//     the route's played list; Episode 7 open with riley its host; the flag's check.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-host.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it; the card's rows go with its league); touches zt rows only; refuses a
// non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or
// how many failed.
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-host runs against a local database only");
const keep = process.argv.includes("--keep");

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const MOMENTS = ["individualImmunity", "idolFound", "rewardWin"];
const CARD = { from: "host", each: 2, of: MOMENTS, closes: 48, hostAnswers: false };
const SHEET = { id: "host", ask: "The host's questions", answer: "yesNo", points: 1, asked: "each", card: true, settle: { by: "moment", take: "happened" } };
const WHO = ["jordan", "riley", "sam"];

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
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
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
    if (specsOn) GameSpecs.carryGame(state0.settings, true);
    const problems = S.setGame(state0, { spec: 1, span: S.gameOf(state0).span, get: { by: "none" }, score: { by: "answers" }, ask: [SHEET], card: CARD }, { ctx: await questionContext(QG, sid) });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state0), QG]);
    const written = (await league(QG)).state.settings;
    const words = G.describeSpec(S.gameOf((await league(QG)).state), { castaway: "castaway" });
    check(!problems.length && written.leagueTypeId === "questions" && G.sameValue(written.gameCard, { ...CARD, fallback: "spec" }) && /one of you hosts and chooses its card: two of/.test(words.sentence) && words.rules.includes("The host sits out the card they chose."),
      "  made a game of questions on a card a host chooses (gameCard; its words)", JSON.stringify({ problems, card: written.gameCard, words }));
    const pids = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [QG])).rows) {
      const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
      if (who) pids[who] = player_id;
    }
    const order = (await league(QG)).state.players.map((p) => Object.keys(pids).find((k) => pids[k] === p.id));
    check(G.sameValue(order, WHO), "  its seats in the order they joined: jordan, riley, sam", JSON.stringify(order));

    // ---------- Before the deadline ----------
    for (const who of WHO) await seen(who, 5);
    const hostAs = async (who) => (await as[who].call("GET", `/api/leagues/${QG}/host`)).body;
    const choose = (who, moments) => as[who].call("POST", `/api/leagues/${QG}/host`, { moments });
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    const rows = async () => (await pool.query("SELECT episode, player_id, moments, filed, how FROM host_cards WHERE league_id = $1 ORDER BY episode", [QG])).rows;
    let st;
    const airs6 = (await hostAs("jordan"))?.next;
    for (const who of WHO) {
      const h = await hostAs(who);
      const n = h?.next;
      const ok = n && n.episode === 6 && n.host?.playerId === pids.jordan && n.youHost === (who === "jordan") && G.sameValue(n.lines, []) && typeof n.closesAt === "string"
        && G.sameValue(h.turn.map((u) => u?.playerId), [pids.riley, pids.sam, pids.jordan])
        && h.card.closes === 48 && h.card.hostAnswers === false && G.sameValue(h.card.of.map((m) => m.id), MOMENTS);
      check(ok, `the host route as ${who}: Episode 6's host jordan${who === "jordan" ? " (you)" : ""}, the deadline, then riley, sam, jordan`, JSON.stringify(h));
    }
    const ep6 = (await as.jordan.call("GET", `/api/leagues/${QG}/state`)).body?.state?.episodes?.find((e) => e.number === 6);
    check(!!ep6?.airsAt && airs6.closesAt === new Date(Date.parse(ep6.airsAt) - 48 * 3600e3).toISOString(), `  the deadline: 48 hours before Episode 6 airs (${airs6?.closesAt})`, JSON.stringify({ airsAt: ep6?.airsAt, closesAt: airs6?.closesAt }));
    r = await ask("riley", { answers: { "host.1": "yes" } });
    check(r.status === 409 && /isn't out yet\. The host has until 48 hours before it airs to choose it/.test(r.body?.error ?? ""), "  the card's lines can't be answered yet (409, the host's words)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await choose("riley", ["idolFound"]);
    check(r.status === 409 && /turn to choose Episode 6's card/.test(r.body?.error ?? ""), `  riley choosing: refused (${r.body?.error})`, JSON.stringify(r));
    for (const [bad, why] of [[["cried"], "the couch's word"], [["idolFound", "idolFound"], "a moment twice"], [MOMENTS, "three on a card of two"], ["idolFound", "not a list"]]) {
      r = await choose("jordan", bad);
      check(r.status === 400, `  jordan choosing ${why}: refused (${r.body?.error})`, JSON.stringify(r));
    }
    const one = await choose("jordan", ["rewardWin"]);
    const two = await choose("jordan", ["idolFound", "rewardWin"]);
    const mine = await hostAs("jordan");
    const theirs = await hostAs("riley");
    check(one.status === 200 && two.status === 200 && G.sameValue(mine.next.lines, ["idolFound", "rewardWin"]) && G.sameValue(theirs.next.lines, []),
      "  jordan's one line, then two (an idol found, a reward): kept as his, riley sees none of it", JSON.stringify({ one: one.body, two: two.body, mine: mine.next, theirs: theirs.next }));
    const asRead = (await as.riley.call("GET", `/api/leagues/${QG}/state`)).body?.state;
    check(asRead && !asRead.episodes.find((e) => e.number === 6).cardChoice, "  the league's state as read: no Episode 6 card (secret until the deadline)", JSON.stringify(asRead?.episodes?.find((e) => e.number === 6)));
    const unfiled = await rows();
    check(G.sameValue(unfiled.map((x) => [x.episode, x.filed, x.player_id, x.moments]), [[6, false, pids.jordan, ["idolFound", "rewardWin"]]]), "  host_cards: jordan's lines, not filed", JSON.stringify(unfiled));

    // ---------- The deadline passes ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 2 WHERE id = $1", [sid]);
    const after = (await as.riley.call("GET", `/api/leagues/${QG}/state`)).body?.state;
    const stamp = after?.episodes.find((e) => e.number === 6).cardChoice;
    const row6 = (await rows()).find((x) => x.episode === 6);
    check(G.sameValue(stamp, { moments: ["idolFound", "rewardWin"], host: pids.jordan, how: "host" }) && row6?.filed === true && row6.how === "host",
      "the deadline passed: the next read files jordan's lines, stamped on Episode 6", JSON.stringify({ stamp, row6 }));
    r = await choose("jordan", ["individualImmunity"]);
    const turn6 = (await hostAs("jordan")).turn;
    check(r.status === 409 && G.sameValue(turn6.map((u) => u?.playerId), [pids.riley, pids.sam, pids.jordan]),
      `  jordan choosing again: refused (${r.body?.error}); next in turn riley (Episode 7's card opens once the league has it)`, JSON.stringify({ r, turn6 }));
    let g = await read("riley");
    const lines = (x) => x.questions?.filter((y) => y.card).map((y) => [y.id, y.card.moment]);
    check(g.episode === 6 && G.sameValue(lines(g), [["host.1", "idolFound"], ["host.2", "rewardWin"]]), "  the answers route asks Episode 6's lines as jordan chose them", JSON.stringify([g.episode, lines(g)]));
    r = await ask("jordan", { answers: { "host.1": "yes" } });
    check(r.status === 409 && /you sit it out/.test(r.body?.error ?? ""), `  jordan answering his own card: refused (${r.body?.error})`, `${r.status} ${JSON.stringify(r.body)}`);
    const his = await read("jordan");
    check(his.questions?.filter((y) => y.card).every((y) => y.card.sitOut === true), "  jordan's read marks his card's lines as his to sit out (no move due)", JSON.stringify(his.questions?.map((y) => y.card)));
    r = await ask("riley", { answers: { "host.1": "yes", "host.2": "no" } });
    const r2 = await ask("sam", { answers: { "host.1": "yes" } });
    check(r.status === 200 && r2.status === 200, "  riley answers yes (an idol), no (a reward); sam yes (an idol)", JSON.stringify([r.body, r2.body]));

    // ---------- Episode 6's results ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 2 WHERE id = $1", [sid]);
    st = (await league(QG)).state;
    const still = st.castaways.filter((c) => c.status !== "eliminated");
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false), ($1, 6, 'event', $3, '', 'idolFound', 'accepted', true, now(), false)`,
      [sid, still[0].name, still[1].name]
    );
    await syncSeasonLeagues(sid, null);
    for (const who of WHO) await seen(who, 6);
    g = await read("riley", 6);
    const table = ((await as.riley.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? []).find((x) => x.leagueId === QG)?.table ?? [];
    const by = Object.fromEntries(table.map((t) => [Object.keys(fx.users).find((k) => fx.users[k] === t.userId), t.total]));
    check(g.points === 2 && by.riley === 2 && by.sam === 1 && (by.jordan ?? 0) === 0 && table[0].userId === fx.users.riley,
      "Episode 6's results (an idol found, no reward): riley 2, sam 1, jordan nothing (he hosted); the Games tab ranks them", JSON.stringify({ points: g.points, table: by }));
    const h = await hostAs("sam");
    check(G.sameValue(h.played.map((p) => [p.episode, p.host?.playerId, p.how, p.lines]), [[6, pids.jordan, "host", ["idolFound", "rewardWin"]]])
      && h.next?.episode === 7 && h.next.host?.playerId === pids.riley && h.next.youHost === false,
      "  the route: Episode 6 played as jordan chose it; Episode 7 open, riley its host", JSON.stringify({ played: h.played, next: h.next }));

    // ---------- The flag ----------
    const flagged = checkLeague((await league(QG)).state);
    check(flagged.ok, "the game-specs flag's check passes on it", JSON.stringify(flagged));
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.log(`down: ${e.message}`));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
