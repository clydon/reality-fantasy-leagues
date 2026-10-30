// Dev-only check of where the engine first reads the format's state over time (docs/PLAN-start-a-game-gpt.md, "Formats nobody
// announced", F3 part 2: db/format-timeline.js, format-timeline.js groupFacts, answer-points.ts formatGroupsFor, answers.ts),
// against the dev server, on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results through Episode 5,
// three starting tribes, Episode 6 three days off; everyone has seen 5 but sam, 3).
//   - The season turns into pairs: its stored research (episode_research, combined, as research stores it) says who went home in
//     1 to 5, and from 4 who is paired with whom (unnamed pairs: never staged as tribe moves, so only the timeline has them).
//   - A game of questions: jordan starts a Survival Pool for Episode 6 on, riley and sam join, and it's made a game of questions
//     with two group questions asked each episode: Which pair wins immunity? (void when the pairs aren't sure, the default) and
//     the same following the people (fallback carry-on).
//   - Answering (GET/POST /api/seasons/[id]/answers?league=): the faces are the six pairs going into 6 ("Ann & Bea"), not the
//     league's tribes; a tribe is refused; sam, behind, waits. jordan names a pair that will hold, riley one that Episode 6
//     re-draws at its start.
//   - The lock, then Episode 6: its research re-draws two pairs at the start (a swap, sure) and brings in a newcomer, Zed Newman,
//     for the one left on their own, who goes home; its accepted results (season_decisions) give the held pair immunity.
//   - Graded on read: jordan's pair right (2), riley's void (neither right nor wrong, 0) on the first question and wrong on the
//     second (followed by the people); the Games tab ranks by it; Episode 7 offers the pairs after the swap.
//   - The newcomer: Episode 7's research context asks about Zed (the season's cast doesn't have him), a paste of its answer (the
//     engine's module API, as the bot's run pastes) stages his exit for the season, and the desk's cue names him: in at 6, for
//     whom, out at 7.
//   API only: the screens are the UI track's (U1). One fixed scenario on purpose (its episodes, pairs and questions are the
//   story above), run again whenever the readers change; a game type or an episode isn't a parameter. Its pieces (the research
//   rows a season in pairs stores, `store` and `section`) are the ones to lift for a check on another scenario.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-format-groups.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); the research rows go with the zt show. Touches zt rows only;
// refuses a non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
// No embedding model for a paste here (episode_text_chunks): stubbed before the research module binds it.
require("../../tests/harness/fake-research-db.js").stubEmbeddings();
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const Research = require("../../db/episode-research.js");
const FormatTimelines = require("../../db/format-timeline.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-format-groups runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const SHOW = "zt-nd-survivor";

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const PAIR = { id: "pair", ask: "Which pair wins immunity?", answer: "group", points: 2, asked: "each", settle: { by: "moment", moment: "tribeImmunity", take: "who" } };
const FOLLOW = { ...PAIR, id: "follow", ask: "Which pair wins immunity? (following the people)", fallback: "carry-on" };
const ZED = "Zed Newman";

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const q = `?couch=${couch}`;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const showId = (await pool.query("SELECT id FROM shows WHERE slug = $1", [SHOW])).rows[0].id;

    // ---------- A game of questions about pairs ----------
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
    const state0 = (await league(QG)).state;
    const problems = S.setGame(state0, { spec: 1, span: S.gameOf(state0).span, get: { by: "none" }, score: { by: "answers" }, ask: [PAIR, FOLLOW] }, { ctx });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state0), QG]);
    const made = (await league(QG)).state;
    check(!problems.length && S.AnswerLogic.questions(made).length === 2 && S.AnswerLogic.questions(made)[1].fallback === "carry-on", "  made a game of questions: Which pair wins immunity?, void by default and following the people", JSON.stringify(problems));

    // The cast in the fixture's order: the i-th goes home in episode i + 1, so 5 to 17 are still in going into 6.
    const cast = [...made.castaways].sort((a, b) => (a.placementOrder ?? 99) - (b.placementOrder ?? 99));
    const N = (i) => cast[i].name;
    const still = made.castaways.filter((c) => c.status !== "eliminated");
    check(still.length === 13 && cast.slice(0, 5).every((c) => c.status === "eliminated"), "the fixture: 13 still in, the first five gone in 1 to 5", JSON.stringify(cast.map((c) => [c.name, c.status])));

    // ---------- The season in pairs, as research stores it ----------
    const pairs = (from, to) => Array.from({ length: (to - from + 1) / 2 }, (_, k) => ({ name: null, members: [N(from + 2 * k), N(from + 2 * k + 1)] }));
    const section = (groups, extra = {}) => ({ playedAs: "pairs", phase: null, groups, alone: [], newcomers: [], wentHomeAs: "individuals", changes: [], ...extra });
    const store = (n, formatState, out, more = []) =>
      pool.query(
        `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1, 51, $2, $3::jsonb, '{"provider":"zt-check"}'::jsonb)
         ON CONFLICT (show_id, season_number, episode_number) WHERE source = 'combined' DO UPDATE SET payload = EXCLUDED.payload`,
        [showId, n, JSON.stringify({ summary: `Episode ${n}.`, formatState, castaways: [...out.map((name) => ({ name, leftTheGame: "yes" })), ...more] })]
      );
    for (let n = 1; n <= 3; n++) await store(n, null, [N(n - 1)]);
    await store(4, section(pairs(4, 17)), [N(3)]);
    await store(5, section(pairs(6, 17), { alone: [N(5)] }), [N(4)]);

    // ---------- Answering: the pairs going into 6 ----------
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    const byId = (x, id) => x.questions?.find((y) => y.id === id);
    let g = await read("jordan");
    const faces = byId(g, "pair")?.faces ?? [];
    const named = (a, b) => faces.find((f) => f.name === `${N(a)} & ${N(b)}`);
    check(
      g.episode === 6 && faces.length === 6 && !!named(6, 7) && !!named(8, 9) && !faces.some((f) => ["Toka", "Savu", "Dina"].includes(f.name)) && byId(g, "pair").offWhy === null,
      "jordan reads Episode 6's: Which pair? as the six pairs going in, named for their two, never the league's tribes",
      JSON.stringify(byId(g, "pair"))
    );
    check(g.groups?.some((x) => x.id === named(6, 7)?.id) && g.groups.some((x) => x.name === "Toka"), "  and the read names them for the answers, beside the tribes", JSON.stringify(g.groups?.map((x) => x.name)));
    const tribe = new Map(made.tribes.map((t) => [t.name, t.id]));
    r = await ask("jordan", { answers: { pair: tribe.get("Toka") } });
    check(r.status === 400 && /group someone still in is on/.test(r.body?.error ?? ""), "  a tribe is refused (400): the pairs are what this season plays in", `${r.status} ${JSON.stringify(r.body)}`);
    r = await ask("jordan", { answers: { pair: named(6, 7).id, follow: named(6, 7).id } });
    check(r.status === 200 && byId(r.body, "pair")?.mine === named(6, 7).id, `jordan names ${N(6)} & ${N(7)} for both`, `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await ask("riley", { answers: { pair: named(8, 9).id, follow: named(8, 9).id } });
    check(r.status === 200, `riley names ${N(8)} & ${N(9)} for both`, `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    g = await read("sam");
    check(byId(g, "pair")?.status === "behind" && byId(g, "pair").faces === null, "sam, at Episode 3, waits to see 5 (who's still in, and with whom)", JSON.stringify(byId(g, "pair")));

    // ---------- The lock, then Episode 6: two pairs re-drawn at its start, a newcomer, immunity to a pair that held ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    r = await ask("riley", { answers: { pair: named(6, 7).id } });
    check(r.status === 409, "Episode 6 has started: an answer is refused (409)", `${r.status} ${JSON.stringify(r.body)}`);
    const after6 = [{ name: null, members: [N(6), N(7)] }, { name: null, members: [N(8), N(10)] }, { name: null, members: [N(9), N(11)] }, ...pairs(12, 17)];
    await store(
      6,
      section(after6, {
        alone: [ZED],
        newcomers: [{ name: ZED, replaces: N(5), group: null }],
        changes: [
          { kind: "swap", when: "start", from: 6, what: "Two pairs were re-drawn before the challenge.", sure: "high" },
          { kind: "newcomer", when: "mid", from: 6, what: `${ZED} came in for ${N(5)}.`, sure: "high" },
        ],
      }),
      [N(5)]
    );
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    for (const [kind, name, method, eventType] of [["event", N(6), "", "tribeImmunity"], ["event", N(7), "", "tribeImmunity"], ["elimination", N(5), "Voted Out", ""]]) {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, 6, $2, $3, $4, $5, 'accepted', true, now(), false)`,
        [sid, kind, name, method, eventType]
      );
    }
    await syncSeasonLeagues(sid, null);
    const e6 = (await league(QG)).state.episodes.find((e) => e.number === 6);
    check(!!e6 && S.resultsStage(e6) === "final", "Episode 6's results reach the game", JSON.stringify(e6 && S.resultsStage(e6)));

    // ---------- Graded on read, as each one has seen it ----------
    g = await read("jordan", 6);
    check(g.points === 0 && byId(g, "pair").verdict?.state === "waiting", "jordan hasn't seen Episode 6: nothing graded for him yet", JSON.stringify({ points: g.points, v: byId(g, "pair").verdict }));
    await seen("jordan", 6);
    g = await read("jordan", 6);
    const pv = byId(g, "pair").verdict;
    const me = (x) => x.people.find((p) => p.you);
    const them = (x) => x.people.find((p) => !p.you);
    check(pv?.state === "known" && G.sameValue(pv.groups, [named(6, 7).id]) && pv.held?.includes(named(6, 7).id) && !pv.held.includes(named(8, 9).id), "once he's seen it: Which pair? the pair that held and won, the re-drawn ones not held", JSON.stringify(pv));
    check(me(byId(g, "pair")).right === true && me(byId(g, "pair")).earned === 2 && them(byId(g, "pair")).right === null && them(byId(g, "pair")).earned === 0, "  jordan right (2); riley's re-drawn pair void: neither right nor wrong", JSON.stringify(byId(g, "pair").people));
    check(them(byId(g, "follow")).right === false && me(byId(g, "follow")).earned === 2, "  following the people, riley's pair is graded by who was in it: wrong", JSON.stringify(byId(g, "follow").people));
    check(g.points === 4, "  4 points in all for jordan", String(g.points));
    const games = (await as.jordan.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? [];
    const table = games.find((x) => x.leagueId === QG)?.table ?? [];
    check(table[0]?.userId === fx.users.jordan && table[0].total === 4, "the Games tab ranks it by the same grading: jordan first, 4", JSON.stringify(table.map((t) => [t.name, t.total])));
    const g7 = await read("jordan");
    const f7 = (byId(g7, "pair")?.faces ?? []).map((f) => f.name);
    check(g7.episode === 7 && f7.length === 6 && f7.includes(`${N(8)} & ${N(10)}`) && !f7.includes(`${N(8)} & ${N(9)}`), "  Episode 7 offers the pairs after the swap", JSON.stringify(f7));

    // ---------- The newcomer: asked about, staged, cued ----------
    const ctx7 = await Research.resolveSeasonResearchContext(pool, SHOW, 51, 7);
    check(ctx7.castNames.includes(ZED) && G.sameValue(ctx7.newcomers, [ZED]) && !ctx7.castNames.includes(N(5)), "Episode 7's research asks about Zed Newman, whom the season's cast doesn't have", JSON.stringify(ctx7.castNames));
    check(ctx7.formatGoingIn?.sure === true && ctx7.formatGoingIn.state.alone.includes(ZED) && ctx7.groupWord === null, "  the groups going in are the timeline's (Zed on his own); pairs going in: the show's own word stands", JSON.stringify(ctx7.formatGoingIn));
    const prompt = Research.buildPastePrompt(ctx7, [], { structured: true });
    check(new RegExp(`\\d+\\. ${ZED}\\n`).test(prompt) && /which may be only a label/.test(prompt), "  the prompt lists him like anyone, and calls the tribes beside the pairs a label", prompt.slice(0, 200));
    const skel = Research.pasteSkeleton(ctx7, []);
    skel.summary = "Episode 7.";
    for (const c of skel.castaways) Object.assign(c, { leftTheGame: c.name === ZED ? "yes" : "no", exitMethod: c.name === ZED ? "Voted Out" : null, confidence: "high", sources: ["https://example.com"] });
    skel.formatState = section(after6, { alone: [] });
    const run = await Research.researchFromPaste(pool, SHOW, 51, 7, JSON.stringify(skel), { structured: true });
    const staged = (await pool.query("SELECT castaway_name, method, status FROM season_decisions WHERE season_id = $1 AND episode_number = 7 AND kind = 'elimination'", [sid])).rows;
    check(staged.length === 1 && staged[0].castaway_name === ZED && staged[0].status === "pending", "  his exit is staged for the season (pending, for whoever accepts results)", JSON.stringify({ staged, problems: run.problems }));
    const cues = await FormatTimelines.seasonNewcomerCues(pool, sid);
    check(G.sameValue(cues, [{ name: ZED, episode: 6, replaces: N(5), group: null, leftIn: 7 }]), "  the desk's cue: Zed Newman, in at 6 for the one left alone, out at 7, not on the cast", JSON.stringify(cues));
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
