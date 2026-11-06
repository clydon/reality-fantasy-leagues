// Dev-only check of the players' own mechanics, part 1 (docs/PLAN-start-a-game-gpt.md step A14 part 1) against the dev server,
// through the API (no screens: they're the UI track's), on new-fixture.js's couch (ZT Survivor 51: 13 episodes, results through
// Episode 5, Episode 6 three days off). In order:
//   - Match the majority: the desk's admin (zt_nd_desk, made here, on the couch) starts a game of questions from the engine lab: who
//     goes home (the results), what most of us will say to it (`settle: { by: 'players', take: 'majority', of: 'boot' }`) and "will
//     there be a blindside? say what most of us will" (the players' own answers, a yes or no). alex, riley, jordan and sam join; alex,
//     riley and jordan answer for Episode 6. Before the lock nobody sees anyone else's answer, only how many have answered; sam
//     (seen 3) is behind. Episode 6 airs: closed, everyone's answers shown, still waiting for its results. Its result goes in: what
//     most said is right (the guess graded on the boot question's answers), the blindside question's tie void, the table's points
//     each one's.
//   - The players' vote on a format change: a solo draft and a new draft at each split or pairing, taken by the players' vote
//     (extras.changes.ok 'vote', carrying on if it ties). Its season is played in pairs from Episode 4, as research stores it
//     (check-change-stages.js's rows); Episode 6's research says everyone plays on their own from 7: it waits for the vote until
//     Episode 7 starts, nothing made, the game's Recent changes asking. GET says how many of the five seats have voted and yours,
//     never what anyone else said; sam (behind) can't vote; a bad vote is refused; three of five saying start decides it: the copy is
//     made from 7, said, its votes shown; nobody votes on it after. The maker can still call it off. Episode 7's research: pairs from
//     8; one vote, skip, by the lock (Episode 8 in): the votes cast decide, the copy never made, said.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-players-game.js [--keep]
//
// One fixed scenario on purpose (its episodes, answers and votes are the story above), run again whenever a question the players
// settle or the players' vote changes. Brings new-fixture.js up and takes it down (--keep leaves it); the research rows go with the zt
// show. Touches zt rows only; refuses a non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at
// once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const K = require("./check-kit");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-players-game runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const SHOW = "zt-nd-survivor";
const out = K.checker();
const { check } = out;
const { errorOf, same } = K;

const QUESTIONS = {
  get: { by: "none" },
  score: { by: "answers" },
  rank: { by: "total" },
  ask: [
    { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } },
    { id: "most", ask: "Who will most of us say goes home?", answer: "person", points: 2, asked: "each", settle: { by: "players", take: "majority", of: "boot" } },
    { id: "herd", ask: "Will there be a blindside? Say what most of us will", answer: "yesNo", points: 1, asked: "each", settle: { by: "players", take: "majority" } },
  ],
};
const DRAFT = { by: "draft", each: 2, order: "snake", own: "exclusive" };
const STAGES = {
  stages: [
    { id: "solo", name: "Solo", game: { preset: "outlast", get: DRAFT } },
    { id: "re", name: "New draft", on: { change: ["split-into-individuals", "pairs-formed"], again: true }, game: { preset: "outlast", get: DRAFT } },
  ],
  overall: { by: "points" },
  extras: { changes: { ok: "vote", unanswered: "carry-on" } },
};

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    // The desk's admin, on the couch (check-stages.js's).
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [deskId, DESK, `${DESK}@example.invalid`]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), deskId, await hashPassword(fixture.PASSWORD)]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'member', 'couch')", [couch, deskId]);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    as.desk = await api({ user: DESK, pass: fixture.PASSWORD });
    const k = K.kit({ pool, fx, as, specsOn });
    const { decide, seen, stateOf, gameIn } = k;
    const changes = async (id) => (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 ORDER BY created_at", [id])).rows.map((r) => r.text);
    const stageRows = async (G) => (await pool.query("SELECT id, stage_key, deleted_at IS NOT NULL AS gone FROM leagues l WHERE stage_of = $1 ORDER BY created_at", [G])).rows;
    const live = async (G) => (await stageRows(G)).filter((x) => !x.gone);
    let r;

    // ---------- the season in pairs, as research stores it (check-change-stages.js's) ----------
    const showId = (await pool.query("SELECT id FROM shows WHERE slug = $1", [SHOW])).rows[0].id;
    const cast = [...(await stateOf((await pool.query("SELECT id FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL LIMIT 1", [couch])).rows[0].id)).castaways].sort((a, b) => (a.placementOrder ?? 99) - (b.placementOrder ?? 99));
    const N = (i) => cast[i].name;
    const pairs = (from, to) => Array.from({ length: (to - from + 1) / 2 }, (_, j) => ({ name: null, members: [N(from + 2 * j), N(from + 2 * j + 1)] }));
    const section = (groups, extra = {}) => ({ playedAs: "pairs", phase: null, groups, alone: [], newcomers: [], wentHomeAs: "individuals", changes: [], ...extra });
    const store = (n, formatState, outNames) =>
      pool.query(
        `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1, 51, $2, $3::jsonb, '{"provider":"zt-check"}'::jsonb)
         ON CONFLICT (show_id, season_number, episode_number) WHERE source = 'combined' DO UPDATE SET payload = EXCLUDED.payload`,
        [showId, n, JSON.stringify({ summary: `Episode ${n}.`, formatState, castaways: outNames.map((name) => ({ name, leftTheGame: "yes" })) })]
      );
    for (let n = 1; n <= 3; n++) await store(n, null, [N(n - 1)]);
    await store(4, section(pairs(4, 17)), [N(3)]);
    await store(5, section(pairs(6, 17), { alone: [N(5)] }), [N(4)]);
    const changeOf = (kind, from, what) => ({ kind, when: "end", from, what, sure: "high" });

    // ---------- both games from the engine lab; the couch joins ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(QUESTIONS) });
    const Q = r.body?.leagueId;
    check(r.status === 200 && !!Q, "the desk's admin starts a game of questions two of which the players' own answers settle, from the engine lab", `${r.status} ${errorOf(r)}`);
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(STAGES) });
    const G = r.body?.leagueId;
    check(r.status === 200 && !!G, "  and a solo draft with a new draft at each split or pairing, taken by the players' vote", `${r.status} ${errorOf(r)}`);
    const q0 = await stateOf(Q);
    check(S.gameOf(q0).ask[1].settle.of === "boot" && S.gameOf(q0).ask[2].settle.tie === "none" && S.StageLogic.changesOf(await stateOf(G))?.ok === "vote", "  each as its spec says (a tie void by default; the vote the game's way to take a change)", JSON.stringify({ q: S.gameOf(q0).ask.map((x) => x.settle), g: S.StageLogic.changesOf(await stateOf(G)) }));
    for (const g of [Q, G]) {
      for (const who of WHO) {
        r = await as[who].call("POST", `/api/couches/${couch}/games/${g}`, { action: "join" });
        check(r.status === 200, `  ${who} joins ${g === Q ? "the questions" : "the stages"}`, `${r.status} ${errorOf(r)}`);
      }
    }
    const seats = await k.seatsOf(Q);
    const id = (i) => q0.castaways.find((c) => c.name === N(i)).id;

    // ---------- match the majority: the answers, hidden until the lock ----------
    const questions = async (who) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${Q}&episode=6`)).body;
    const qOf = (body, qid) => (body?.questions ?? []).find((x) => x.id === qid) ?? null;
    const answer = (who, answers) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${Q}`, { episode: 6, answers });
    r = await answer("alex", { boot: id(5), most: id(5), herd: "yes" });
    check(r.status === 200, "alex answers for Episode 6: who goes home, who most will say, and yes", `${r.status} ${errorOf(r)}`);
    r = await answer("riley", { boot: id(5), most: id(6), herd: "no" });
    check(r.status === 200, "  riley: the same boot, a different guess, no", `${r.status} ${errorOf(r)}`);
    r = await answer("jordan", { boot: id(6), most: id(5) });
    check(r.status === 200, "  jordan: another boot, the guess alex made, no blindside answer", `${r.status} ${errorOf(r)}`);
    r = await answer("riley", { most: [id(5), id(6)] });
    check(r.status === 400, "  two names for what most will say are refused (one each)", `${r.status} ${errorOf(r)}`);
    r = await answer("sam", { boot: id(5) });
    check(r.status === 403, "  sam (seen 3) is behind and can't answer yet", `${r.status} ${errorOf(r)}`);
    let body = await questions("riley");
    let most = qOf(body, "most");
    check(most?.status === "open" && most.answered === 3 && most.people.length === 0 && most.verdict === null && most.mine === id(6) && same(most.settle, { by: "players", take: "majority", of: "boot", tie: "none" }),
      "  before the lock riley sees only how many have answered and their own guess, nobody else's", JSON.stringify(most && { status: most.status, answered: most.answered, people: most.people, mine: most.mine, settle: most.settle }));
    check(qOf(body, "boot")?.answered === 3 && qOf(body, "boot")?.people.length === 0 && qOf(body, "herd")?.answered === 2, "  nor anyone's answer to the question it's about", JSON.stringify((body?.questions ?? []).map((x) => [x.id, x.answered, x.people.length])));

    // ---------- the lock, then the result ----------
    await k.airs(4);
    r = await answer("jordan", { herd: "yes" });
    check(r.status === 409, "Episode 6 airs: the questions are closed", `${r.status} ${errorOf(r)}`);
    body = await questions("alex");
    most = qOf(body, "most");
    check(most?.status === "closed" && most.people.length === 3 && most.verdict?.state === "waiting" && most.people.every((p) => p.right === null),
      "  everyone's answers shown once it's locked, still waiting for Episode 6's result", JSON.stringify(most && { status: most.status, people: most.people.map((p) => [p.name, p.answer, p.right]), verdict: most.verdict }));
    // Episode 6's research says everyone plays on their own from 7 (the vote's change, below), and its result goes in: N(5) goes home.
    await store(6, section([], { changes: [changeOf("split-into-individuals", 7, "Everyone plays on their own from Episode 7.")] }), [N(5)]);
    await decide(6, "elimination", N(5));
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    body = await questions("alex");
    most = qOf(body, "most");
    const person = (q, who) => q?.people.find((p) => p.playerId === seats[who]);
    check(most?.verdict?.state === "known" && JSON.stringify(most.verdict.right) === JSON.stringify([id(5)]) && most.verdict.tally?.[0]?.answer === id(5) && most.verdict.tally[0].n === 2,
      "Episode 6's result: what most of you said to who goes home (two of three) is the right guess", JSON.stringify(most?.verdict));
    check(person(most, "alex")?.right === true && person(most, "alex")?.earned === 2 && person(most, "riley")?.right === false && person(most, "riley")?.earned === 0 && person(most, "jordan")?.right === true,
      "  alex and jordan guessed it, riley didn't", JSON.stringify(most?.people.map((p) => [p.name, p.right, p.earned])));
    const herd = qOf(body, "herd");
    check(herd?.verdict?.state === "off" && /tie/.test(herd.verdict.why) && herd.people.every((p) => p.right === null && p.earned === 0),
      "  the blindside question tied one to one: it doesn't count either way (neither right nor wrong)", JSON.stringify(herd && { verdict: herd.verdict, people: herd.people.map((p) => [p.name, p.right, p.earned]) }));
    const view = await gameIn("alex", Q);
    const total = (who) => view?.table?.find((x) => x.playerId === seats[who])?.total;
    check(total("alex") === 3 && total("riley") === 1 && total("jordan") === 2 && (total("sam") ?? 0) === 0,
      "  the table: alex 3 (the boot and the guess), riley 1 (the boot), jordan 2 (the guess), sam nothing", JSON.stringify(view?.table?.map((x) => [x.name, x.total])));

    // ---------- the players' vote on a format change ----------
    const KEY = "re@6:split-into-individuals";
    const stages = (who) => as[who].call("GET", `/api/leagues/${G}/stage-changes`);
    let rows = await live(G);
    r = await stages("alex");
    check(rows.length === 1 && r.status === 200 && r.body.pending?.length === 1 && r.body.pending[0].key === KEY && r.body.pending[0].until === 7 && r.body.started?.length === 0,
      "Episode 6's research: everyone on their own from 7: the new draft waits for the players' vote until Episode 7 starts, nothing made", JSON.stringify({ rows, body: r.body }));
    check(same(r.body.pending?.[0]?.vote, { voted: 0, of: 5, mine: null }), "  the five seats can vote; nobody has", JSON.stringify(r.body.pending?.[0]));
    check((await changes(G)).some((t) => /^The format changed \(everyone went on to play on their own, from Episode 7\): start New draft\? Vote before Episode 7 starts \(more than half of you saying the same decides it\), a tie or no votes and the game carries on as it is$/.test(t)),
      "  the game's Recent changes ask the players", JSON.stringify(await changes(G)));
    r = await as.sam.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY, vote: "start" });
    check(r.status === 400, "  sam (seen 3) hasn't reached the change: no vote", `${r.status} ${errorOf(r)}`);
    r = await as.alex.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY, vote: "maybe" });
    check(r.status === 400, "  a vote that isn't start or skip is refused", `${r.status} ${errorOf(r)}`);
    r = await as.alex.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY, vote: "start" });
    check(r.status === 200 && same(r.body.pending?.[0]?.vote, { voted: 1, of: 5, mine: "start" }), "  alex votes start: one of five, his own shown", `${r.status} ${errorOf(r)} ${JSON.stringify(r.body?.pending)}`);
    r = await stages("riley");
    check(same(r.body.pending?.[0]?.vote, { voted: 1, of: 5, mine: null }) && !("votes" in (r.body.pending?.[0] ?? {})), "  riley sees that one has voted, not how", JSON.stringify(r.body.pending));
    r = await as.riley.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY, vote: "skip" });
    const st = await as.riley.call("GET", `/api/leagues/${G}/state`);
    const kept = (await pool.query("SELECT player_id, vote FROM stage_change_votes WHERE league_id = $1 AND change_key = $2 ORDER BY player_id", [G, KEY])).rows;
    check(st.status === 200 && !JSON.stringify(st.body.state?.changeStages ?? {}).includes("skip") && !("votes" in (st.body.state?.changeStages ?? {})) && kept.length === 2,
      "  the game's state (which every route returns whole) carries no vote: they're kept apart (stage_change_votes)", JSON.stringify({ status: st.status, changeStages: st.body.state?.changeStages, kept }));
    r = await as.riley.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY, vote: "start" });
    check(r.status === 200 && r.body.pending?.[0]?.vote?.voted === 2 && (await live(G)).length === 1, "  riley votes skip, then changes it to start: two of five, not yet decided", `${r.status} ${JSON.stringify(r.body?.pending)}`);
    r = await as.jordan.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY, vote: "start" });
    rows = await live(G);
    const copy = rows.find((x) => x.stage_key === KEY)?.id;
    check(r.status === 200 && !!copy && r.body.started?.length === 1 && r.body.started[0].from === 7 && same(r.body.started[0].votes, { start: 3, skip: 0 }),
      "  jordan makes three of five: decided, the copy made from Episode 7, its votes shown now", `${r.status} ${errorOf(r)} ${JSON.stringify({ rows, started: r.body?.started })}`);
    check(!!copy && S.startEpisode(await stateOf(copy)) === 7 && S.endEpisode(await stateOf(rows.find((x) => x.stage_key === "solo").id)) === 6, "  it plays from 7; Solo ends with 6", JSON.stringify(rows));
    check((await changes(G)).some((t) => /^The players voted to start New draft for everyone went on to play on their own at 7$/.test(t)), "  the game says the players voted for it", JSON.stringify(await changes(G)));
    r = await as.jordan.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY, vote: "skip" });
    check(r.status === 400, "  nobody votes on it once it's decided", `${r.status} ${errorOf(r)}`);
    r = await as.desk.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY, do: "skip" });
    check(r.status === 200 && (await stageRows(G)).find((x) => x.id === copy)?.gone === true && r.body.skipped?.length === 1, "  the maker can still call it off: taken away", `${r.status} ${errorOf(r)} ${JSON.stringify(await stageRows(G))}`);

    // ---------- a vote the lock decides ----------
    const K7 = "re@7:pairs-formed";
    await store(7, section(pairs(8, 17), { changes: [changeOf("pairs-formed", 8, "New pairs from Episode 8.")] }), [N(6)]);
    await decide(7, "elimination", N(6));
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 7);
    r = await stages("alex");
    check(r.body.pending?.length === 1 && r.body.pending[0].key === K7 && r.body.pending[0].until === 8, "Episode 7's research: pairs from 8: the vote is open until Episode 8 starts", JSON.stringify(r.body.pending));
    r = await as.riley.call("POST", `/api/leagues/${G}/stage-changes`, { key: K7, vote: "skip" });
    check(r.status === 200 && r.body.pending?.[0]?.vote?.voted === 1, "  riley votes skip: one of five", `${r.status} ${errorOf(r)}`);
    await store(8, section(pairs(8, 17)), [N(7)]);
    await decide(8, "elimination", N(7));
    await seen("alex", 8);
    r = await stages("alex");
    rows = await live(G);
    check(!rows.some((x) => x.stage_key === K7) && r.body.pending?.length === 0 && r.body.skipped?.some((x) => x.key === K7 && same(x.votes, { start: 0, skip: 1 })),
      "  Episode 8 in, the lock passed: the votes cast decide (one skip), the copy never made", JSON.stringify({ rows, body: r.body }));
    check((await changes(G)).some((t) => /^The players voted not to start New draft for pairs formed at Episode 8: the game carries on as it is$/.test(t)), "  and the game says so", JSON.stringify(await changes(G)));
  } catch (e) {
    out.fail();
    console.error(e);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.error("down:", e.message));
    await pool.end();
  }
  console.log(out.failures() ? `${out.failures()} FAILED` : "ALL PASS");
  process.exit(out.failures() ? 1 : 0);
})();
