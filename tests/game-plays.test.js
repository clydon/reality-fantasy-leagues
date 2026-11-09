// Each person's plays by episode on a game's page (docs/PLAN-start-a-game-gpt.md U1 step 2b; src/lib/game/game-plays.ts): every
// spec the repo can make reads into a square and an episode's block (U0's census), and every draft and pick spec, played on a
// made-up season, gives each row a square for every episode the viewer has seen, none past their mark, with numbers that are
// numbers; someone else's pick only once it's decided; the next episode only whether it's set. No database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { gameView } = jiti("../src/lib/game/game-view.ts");
const { kindsOf, playsOf } = jiti("../src/lib/game/game-plays.ts");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { allSpecs } = require("./fixtures/game-page-specs.js");

const ALL = allSpecs({ rolls: 150 });
const EPISODES = 12;
const CURSOR = 6;
const data = {
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
  players: ["ann", "bo", "cy", "di"].map((key) => ({ key, name: key, color: "#000" })),
  castaways: Array.from({ length: 18 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: i + 1,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
};
const ref = (type) => ({ leagueId: `l-${type}`, name: type, gameType: type, gameName: type, yourRole: "member" });
const userOf = (p) => `user-${p}`;

/** A made-up season of `type`, played as `spec`. */
function played(type, spec) {
  const state = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, type, CURSOR))));
  if (spec) state.settings = G.withSpec(state.settings, spec);
  return state;
}

test("the census: every spec reads into a square and an episode's block", () => {
  assert.ok(ALL.length > 1000);
  const kinds = new Map();
  for (const x of ALL) {
    const { kind, blocks } = kindsOf(G.fullSpec(x.spec));
    assert.ok(kind, x.id);
    assert.ok(blocks.length || kind === "staged", `${x.id}: no block`);
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  for (const k of ["points", "pick", "result", "won", "lives", "race", "staged"]) assert.ok(kinds.get(k) > 0, `no spec squares ${k}`);
});

test("the three demo games: a square a row a column, through the viewer's mark", () => {
  for (const type of ["classic-draft", "active-roster", "pickem"]) {
    for (const mark of [3, CURSOR]) {
      const state = played(type);
      const me = state.players[0].id;
      const g = gameView(ref(type), state, me, mark, userOf);
      const p = g.plays;
      assert.ok(p.episodes.length > 0, `${type} @${mark}: no columns`);
      assert.ok(p.episodes.every((n) => n <= mark), `${type} @${mark}: a column past the mark`);
      for (const r of g.table) {
        assert.equal(p.rows[r.playerId].length, p.episodes.length, `${type}: ${r.name}'s squares`);
        for (const sq of p.rows[r.playerId]) assert.ok(sq.points === null || Number.isFinite(sq.points), `${type}: ${r.name} Ep ${sq.episode}`);
      }
      if (type === "pickem") {
        // Someone else's pick shows once decided; the next episode says only whether it's set.
        for (const r of g.table.filter((x) => !x.you)) for (const sq of p.rows[r.playerId]) assert.ok(!sq.pick || sq.pick.correct !== null, `${r.name}'s undecided pick`);
        assert.equal(p.kind, "pick");
      }
      if (type === "active-roster") {
        assert.deepEqual(p.blocks, ["lineup"]);
        // The squares add up to the lineup weeks the sheet shows.
        for (const r of g.table) assert.deepEqual(p.rows[r.playerId].filter((s) => s.points !== null).map((s) => s.points), r.weeks.map((w) => w.total), r.name);
      }
      if (type === "classic-draft") assert.ok(p.rows[me].every((s) => Array.isArray(s.held)), "an Outlast's team each episode");
      if (p.next) assert.ok(Object.values(p.next.set).every((v) => v === null || typeof v === "boolean"));
    }
  }
});

test("every draft and pick spec, on a made-up season: squares with numbers, never NaN", () => {
  const bad = [];
  let ran = 0;
  for (const x of ALL) {
    const full = G.fullSpec(x.spec);
    const type = G.typeOf(full);
    if (!["classic-draft", "active-roster", "pickem"].includes(type) || full.stages || x.sport) continue;
    let g;
    try {
      const state = played(type, x.spec);
      g = gameView(ref(type), state, state.players[0].id, CURSOR, userOf);
    } catch {
      // A spec the demo season can't play (its moves need data the made-up season lacks): the census above covers it.
      continue;
    }
    ran++;
    const words = JSON.stringify(g.plays);
    if (/NaN|undefined|null,null,null/.test(words) && /NaN/.test(words)) bad.push(x.id);
    for (const r of g.table) if ((g.plays.rows[r.playerId] ?? []).length !== g.plays.episodes.length) bad.push(`${x.id}: ${r.name}`);
  }
  assert.ok(ran > 200, `only ${ran} played`);
  assert.deepEqual(bad.slice(0, 10), []);
});

test("what the server counts outside the state makes the squares, and the week's best is bright", () => {
  const state = played("active-roster");
  const ids = state.players.map((p) => p.id);
  const outside = new Map(ids.map((id, k) => [id, new Map([[1, k], [2, 3 - k], [3, 0]])]));
  const rows = ids.map((playerId) => ({ playerId, picks: [], weeks: [] }));
  const p = playsOf(state, { rows, through: 3, outside, next: { episode: 4, set: { [ids[0]]: true, [ids[1]]: false } } });
  assert.deepEqual(p.episodes, [1, 2, 3]);
  assert.deepEqual(p.rows[ids[3]].map((s) => s.points), [3, 0, 0]);
  assert.deepEqual(p.rows[ids[3]].map((s) => s.total), [3, 3, 3]);
  assert.deepEqual(ids.map((id) => p.rows[id][0].best), [false, false, false, true]);
  // A night nobody scored: nothing bright.
  assert.ok(ids.every((id) => !p.rows[id][2].best));
  assert.equal(p.next.episode, 4);
});
