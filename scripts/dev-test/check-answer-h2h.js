// Dev-only check of head to head on a game of questions (docs/PLAN-start-a-game-gpt.md step A11 part 4b: game-spec schema.js
// matchupParts and answerParts' matchups, settings.js questionsRank 'matchups' and rankMatchups; state-logic.js AnswerLogic.walk's
// series and MatchupLogic.series; answer-points.ts walked and asItStands; answers.ts's refusals at the game's end; game-view.ts's
// records and matchups; the couch hub's plaque) against the dev server, through the API (no screens: they're the UI track's), on
// new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51, 13 episodes: results through Episode 5; Episode 6 three days
// off; everyone has seen 5 but sam, 3).
//   - jordan starts a Survival Pool for Episode 6 on, the others join it (alex, riley, sam, in that order), and it's made a game of
//     questions played head to head through RosterLogic.setGame with the show's ctx: Who goes home? each episode (1 point) and Who
//     wins the most immunities in the game? asked once (2 points, settled only at its end), Episodes 6 to 8, the top two in the
//     final at 8. Immunity goes to M at 6, N at 7 and M at 8.
//     The round robin over the four in the order they joined: 6 jordan-sam alex-riley, 7 jordan-riley sam-alex.
//   - Before 6: alex and jordan answer the question about the whole game (accepted: head to head's end, its final at 8, is known
//     from the start, not reached); an answer for Episode 9 refused, the game ends with 8.
//   - Episode 6 through the answers route (alex and jordan right, riley and sam not) and the season sync: who went home alone
//     (early results) leaves its matchups waiting, the table's points as they stand; a scoring moment makes it final: jordan
//     beats sam, alex beats riley. As sam reads it (seen 5): nothing played.
//   - Episode 7: jordan and riley right (a tie), sam right and alex not (sam's): seeded jordan, then alex (level with sam on a win
//     and a point: alex joined first); jordan's next, the final against alex.
//   - Episode 8, the final: jordan right on its boot (1), alex not, but alex's call about the whole game (M) comes good there (2):
//     alex the champion, first whatever the points, the game over; the questions read says it ended with 8, nothing open; an
//     answer for 9 refused; the hub's plaque alex's, no margin in points.
//   - Episode 8's immunity corrected (re-decided) to N, jordan's call about the whole game: jordan 3, alex 0 in the final: jordan
//     the champion.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-answer-h2h.js [--keep]
//
// One fixed scenario on purpose (its answers and boots are the story above), run again whenever a game of questions' head to head
// changes. Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database.
// Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-answer-h2h runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
const WHOLE = { id: "whole", ask: "Who wins the most immunities in the game?", answer: "person", points: 2, asked: "once", settle: { by: "moment", moment: "individualImmunity", take: "most" } };

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const decide = async (n, kind, name, eventType) => {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now(), false)`,
        [sid, n, kind, name, kind === "elimination" ? "Voted Out" : "", eventType || ""]
      );
      await syncSeasonLeagues(sid, null);
    };
    const airs = (days) => pool.query("UPDATE show_seasons SET premiere_date = premiere_date - $2::int WHERE id = $1", [sid, days]);

    // ---------- The game ----------
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start?couch=${couch}`, { game: "survivalPool", tell: false });
    const QG = r.body.leagueId;
    check(r.status === 200 && !!QG, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    for (const who of ["alex", "riley", "sam"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${QG}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${QG}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [QG])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), QG]);
    const pid = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [QG])).rows) {
      const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
      if (who) pid[who] = player_id;
    }
    const whoOf = (playerId) => Object.keys(pid).find((k) => pid[k] === playerId) ?? playerId;
    const whoIs = (userId) => Object.keys(fx.users).find((k) => fx.users[k] === userId);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const ctx = await questionContext(QG, sid);
    let st = await league();
    const from = S.gameOf(st).span.from;
    const problems = S.setGame(st, { spec: 1, span: { from, to: 8 }, get: { by: "none" }, score: { by: "answers" }, ask: [BOOT, WHOLE], rank: { by: "matchups", playoffs: { teams: 2 } } }, { ctx });
    if (!problems.length) await write(st);
    st = await league();
    check(!problems.length && st.settings.leagueTypeId === "questions" && st.settings.questionsRank === "matchups" && same(st.settings.rankMatchups, { playoffs: { teams: 2 } }) && S.MatchupLogic.playoffsFrom(st) === 8,
      "  made a game of questions played head to head (setGame, the show's ctx): Episodes 6 to 8, the top two in the final at 8", JSON.stringify({ problems, rank: S.gameOf(st).rank, span: S.gameOf(st).span, from: S.MatchupLogic.playoffsFrom(st) }));
    check(same(st.players.map((p) => whoOf(p.id)), ["jordan", "alex", "riley", "sam"]), "  its seats in the order they joined: jordan, alex, riley, sam", JSON.stringify(st.players.map((p) => whoOf(p.id))));

    const still = st.castaways.filter((c) => c.status !== "eliminated");
    // X goes home at 6, Q at 7, R2 at 8; Y, Z and P are wrong calls; immunity to M at 6 and 8, N at 7 (N at 8, corrected).
    const [X, Y, Z, P, Q, R2, MM, NN] = still;
    for (const who of WHO) await seen(who, 5);
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}`)).body;
    const gameOf = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games ?? []).find((x) => x.leagueId === QG) ?? null;
    const records = (g) => Object.fromEntries((g?.table ?? []).map((t) => [whoOf(t.playerId), t.record ? `${t.record.wins}-${t.record.losses}-${t.record.ties}` : null]));
    const points = (g) => Object.fromEntries((g?.table ?? []).map((t) => [whoOf(t.playerId), t.total]));

    // ---------- Before Episode 6 ----------
    const whole = [(await ask("alex", { answers: { whole: MM.id } })).status, (await ask("jordan", { answers: { whole: NN.id } })).status];
    check(same(whole, [200, 200]), `before 6: alex (${MM.name}) and jordan (${NN.name}) answer the question about the whole game: head to head's end is known, not reached`, JSON.stringify(whole));
    r = await ask("jordan", { episode: 9, answers: { boot: P.id } });
    check(r.status === 409 && /ends with Episode 8/.test(r.body?.error ?? ""), "  an answer for Episode 9 refused: the game ends with 8", `${r.status} ${JSON.stringify(r.body)}`);

    // ---------- Episode 6 ----------
    const six = [];
    for (const [who, c] of [["alex", X], ["jordan", X], ["riley", Y], ["sam", Z]]) six.push((await ask(who, { answers: { boot: c.id } })).status);
    check(six.every((s) => s === 200), `Episode 6's answers: alex and jordan ${X.name}, riley ${Y.name}, sam ${Z.name}`, JSON.stringify(six));
    await airs(4);
    await decide(6, "elimination", X.name);
    st = await league();
    check(S.EpisodeLogic.resultsStage(st.episodes.find((e) => e.number === 6)) === "early", `Episode 6's result through the season sync: ${X.name} home (early results)`);
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    let g = await gameOf("jordan");
    check(same(records(g), { jordan: "0-0-0", alex: "0-0-0", riley: "0-0-0", sam: "0-0-0" }) && points(g).alex === 1 && points(g).jordan === 1 && g?.matchups?.last === null,
      "  its matchups wait for the full results; the table's points as they stand (alex and jordan 1)", JSON.stringify({ records: records(g), points: points(g), last: g?.matchups?.last }));
    await decide(6, "event", MM.name, "individualImmunity");
    st = await league();
    check(S.EpisodeLogic.resultsStage(st.episodes.find((e) => e.number === 6)) === "final", `  a scoring moment (${MM.name}'s immunity) makes them final`);
    g = await gameOf("jordan");
    check(same(records(g), { jordan: "1-0-0", alex: "1-0-0", riley: "0-1-0", sam: "0-1-0" }) || same(records(g), { alex: "1-0-0", jordan: "1-0-0", riley: "0-1-0", sam: "0-1-0" }) || same(records(g), { jordan: "1-0-0", alex: "1-0-0", sam: "0-1-0", riley: "0-1-0" }) || same(records(g), { alex: "1-0-0", jordan: "1-0-0", sam: "0-1-0", riley: "0-1-0" }),
      "  the Games tab as jordan reads it: jordan beat sam, alex beat riley", JSON.stringify(records(g)));
    check(same(g?.matchups?.last, { episode: 6, round: null, opponent: pid.sam, stand: null, points: 1, against: 0, result: "win" }) && same(g?.matchups?.next, { episode: 7, round: null, opponent: pid.riley, stand: null }),
      "  jordan's last matchup (sam, 1-0) and next (riley, Episode 7)", JSON.stringify({ last: g?.matchups?.last, next: g?.matchups?.next }));
    g = await gameOf("sam");
    check(Object.values(records(g)).every((x) => x === "0-0-0") && Object.values(points(g)).every((x) => x === 0), "  as sam reads it (seen 5): nothing played", JSON.stringify({ records: records(g), points: points(g) }));
    await seen("sam", 6);

    // ---------- Episode 7 ----------
    const seven = [];
    for (const [who, c] of [["jordan", Q], ["riley", Q], ["sam", Q], ["alex", P]]) seven.push((await ask(who, { answers: { boot: c.id } })).status);
    check(seven.every((s) => s === 200), `Episode 7's answers: jordan, riley and sam ${Q.name}, alex ${P.name}`, JSON.stringify(seven));
    await airs(7);
    await decide(7, "elimination", Q.name);
    await decide(7, "event", NN.name, "individualImmunity");
    for (const who of WHO) await seen(who, 7);
    g = await gameOf("jordan");
    check(records(g).jordan === "1-0-1" && records(g).alex === "1-1-0" && records(g).sam === "1-1-0" && records(g).riley === "0-1-1",
      `Episode 7: ${Q.name} home; jordan and riley tie, sam beats alex`, JSON.stringify(records(g)));
    check(same((g?.matchups?.playoffs?.seeds ?? []).map(whoOf), ["jordan", "alex"]) && g?.matchups?.playoffs?.from === 8,
      "  seeded jordan, then alex (level with sam on a win and a point: alex joined first); the final at 8", JSON.stringify(g?.matchups?.playoffs));
    check(same(g?.matchups?.next, { episode: 8, round: 1, opponent: pid.alex, stand: null }) && g?.over === false, "  jordan's next: the final, against alex", JSON.stringify(g?.matchups?.next));
    r = await ask("sam", { episode: 9, answers: { boot: P.id } });
    check(r.status === 409 && /ends with Episode 8/.test(r.body?.error ?? ""), "  an answer for 9 still refused: the game ends with 8", `${r.status} ${JSON.stringify(r.body)}`);

    // ---------- Episode 8, the final ----------
    const eight = [(await ask("jordan", { answers: { boot: R2.id } })).status, (await ask("alex", { answers: { boot: P.id } })).status];
    check(same(eight, [200, 200]), `Episode 8's answers: jordan ${R2.name}, alex ${P.name}`, JSON.stringify(eight));
    await airs(7);
    await decide(8, "elimination", R2.name);
    await decide(8, "event", MM.name, "individualImmunity");
    for (const who of WHO) await seen(who, 8);
    st = await league();
    g = await gameOf("alex");
    const champion = whoOf(g?.matchups?.playoffs?.champion);
    check(champion === "alex" && whoOf(g?.table?.[0]?.playerId) === "alex" && g?.table?.[0]?.record?.champion === true && g?.over === true,
      `Episode 8, the final: ${R2.name} home, jordan right (1), alex not, but alex's ${MM.name} for the whole game (two immunities) comes good there (2): alex the champion, first; over`,
      JSON.stringify({ champion, first: g?.table?.[0], over: g?.over, points: points(g) }));
    check(g?.matchups?.next === null && same(g?.matchups?.last, { episode: 8, round: 1, opponent: pid.jordan, stand: null, points: 2, against: 1, result: "win" }),
      "  alex's last matchup the final, won 2-1; nothing next", JSON.stringify({ last: g?.matchups?.last, next: g?.matchups?.next }));
    const aq = await read("alex");
    check(aq.ended === 8 && (aq.questions ?? []).every((q) => q.status === "closed"), "  alex's questions read: it ended with 8, nothing open", JSON.stringify({ ended: aq.ended, episode: aq.episode, status: (aq.questions ?? []).map((q) => [q.id, q.status]) }));
    r = await ask("jordan", { episode: 9, answers: { boot: P.id } });
    check(r.status === 409 && /ended with Episode 8/.test(r.body?.error ?? ""), "  an answer for 9 refused: the game ended with 8", `${r.status} ${JSON.stringify(r.body)}`);
    const hub = (await as.jordan.call("GET", `/api/couches/${couch}/hub`)).body;
    const mine = (hub.games ?? []).find((x) => x.leagueId === QG);
    const plaque = (hub.trophies?.plaques ?? []).find((x) => x.leagueId === QG);
    check(mine?.ended === true && mine?.rank === "2" && !!plaque && same(plaque.winners.map((x) => whoIs(x.userId)), ["alex"]) && plaque.by === null,
      "the hub as jordan reads it: second, the game over; the plaque alex's, the final's winner, with no margin in points", JSON.stringify({ mine, plaque }));

    // ---------- A corrected result ----------
    await pool.query("UPDATE season_decisions SET castaway_name = $3, decided_at = now() WHERE season_id = $1 AND episode_number = 8 AND kind = 'event' AND castaway_name = $2", [sid, MM.name, NN.name]);
    await syncSeasonLeagues(sid, null);
    st = await league();
    const moments8 = st.episodes.find((e) => e.number === 8).scoringEvents.map((ev) => ev.castawayId);
    check(moments8.includes(NN.id) && !moments8.includes(MM.id), `the desk corrects Episode 8's immunity: ${NN.name}'s, not ${MM.name}'s (the season sync)`, JSON.stringify(moments8));
    g = await gameOf("alex");
    const final = (g?.matchups?.playoffs?.bracket?.[0]?.games ?? [])[0] ?? {};
    check(whoOf(g?.matchups?.playoffs?.champion) === "jordan" && whoOf(g?.table?.[0]?.playerId) === "jordan" && g?.over === true && same([whoOf(final.a), final.aPoints, whoOf(final.b), final.bPoints], ["jordan", 3, "alex", 0]),
      "  worked out again: jordan's call about the whole game comes good, 3-0 in the final: jordan the champion", JSON.stringify({ champion: g?.matchups?.playoffs?.champion, points: points(g), final }));
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
