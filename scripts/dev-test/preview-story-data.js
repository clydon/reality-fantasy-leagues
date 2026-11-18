// Dev-only: the data a game preview's visual story is drawn from (docs/PLAN-game-preview.md, decision 3: a quick visual story of how
// the game plays). The P0 game (scripts/dev-test/preview-proof.js: the gallery's Fantasy league with a new draft at the merge, on
// Survivor 51) played headless by the explorer's runtime, read through the production game view, no database:
//   - three sample seasons in full (Shuffle), each also with the fix's merge draft: each draft's teams, every week's starters and bench with their points and why, who went home, the
//     race (each person's running total), each stage's table;
//   - many more seasons (--seasons, default 30, each its own seed): what's typical, so a card flags something only when it happens
//     in most seasons (how alike the merge's teams are, how much a week's lineup choice is worth, how close the finish is);
//   - the same seasons with a smaller draft at the merge (draft 3, start 2), the fix the merge card offers.
// Everyone's moves, yours too, are the engine's: each seat starts the next of its roster in turn, as preview-proof.js plays them.
//
//   node scripts/dev-test/preview-story-data.js [--seasons=30] [--out=.ui-atlas/preview-proof/story-data.json]
//
// Needs `node --env-file=.env.local scripts/dev-test/preview-proof.js record` once (the season's page facts and results' shape) and
// the dress (real-dress.js). The output names real castaways: it stays in the ignored .ui-atlas.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/preview-proof/story-data.json"));
const SEASONS = Number(opt("seasons", 30));

const P = require("./preview-proof.js");
const R = require(path.join(root, "tools/gameplay-bench/explorer/runtime.cjs"));
const { lineups, night, teamsOf } = P._h;
const FROM = 9, LAST = 13;

/** The definition, its merge stage's draft made smaller (`each`, `start`) when asked. */
function defOf(seed, small) {
  const d = P.definition({ seed });
  if (small) for (const g of d.games) if (g.spec.stages) Object.assign(g.spec.stages[1].game, { get: { ...g.spec.stages[1].game.get, each: small.each }, count: { start: small.start } });
  return d;
}

/** Play one season to its end; read it back through the production game view as the first seat (everyone has watched). */
function play(seed, small) {
  const s = R.open(defOf(seed, small));
  try {
    const drafts = [];
    const stageIds = s.export().input.games.filter((g) => g.stageOf !== undefined).map((g) => g.id);
    const draftOf = (g) => { const st = s.snapshot().games[g].state; return teamsOf(st); };
    const stillIn = () => { const gone = new Set(s.snapshot().contexts.show.facts.flatMap((f) => (f.data.events || []).map((o) => o.castawayId))); return s.snapshot().contexts.show.participants.filter((p) => !gone.has(p.id)).map((p) => p.id); };
    drafts.push({ stage: stageIds[0], before: FROM, left: stillIn().length, teams: draftOf(stageIds[0]) });
    let merged = false;
    for (let n = FROM; n <= LAST; n++) {
      lineups(s, n); night(s, n);
      const t = draftOf(stageIds[1]);
      if (!merged && Object.values(t).some((x) => x.length)) { merged = true; drafts.push({ stage: stageIds[1], before: n + 1, left: stillIn().length, teams: t }); }
    }
    const view = (g) => s.project(g, "alex").game;
    const stages = stageIds.map((g) => { const v = view(g); return { id: g, name: v.name, from: v.from, to: v.to, table: v.table.map((r) => ({ id: r.playerId, total: r.total, place: r.place })), weeks: Object.fromEntries(v.table.map((r) => [r.playerId, r.weeks || []])), castWeeks: v.castWeeks }; });
    const overall = view("fantasy");
    const cast = view(stageIds[0]).cast.map((c) => ({ id: c.id, name: c.name, photo: c.photo, out: c.out, place: c.place }));
    const out = {};
    for (const f of s.snapshot().contexts.show.facts) for (const o of f.data.events || []) out[o.castawayId] = { episode: Number(f.eventId.replace("show-event-", "")), method: o.method };
    return { seed, drafts, stages, overall: overall.table.map((r) => ({ id: r.playerId, total: r.total, place: r.place })), cast, out };
  } finally { s.dispose(); }
}

// ---- What a season says, as numbers a card can show ----
const people = P.COUCH.map((p) => p.id);
/** How alike a draft's teams are: the share of each pair's teams in common, on average (0: nobody shared, 1: identical). */
function alike(teams) {
  const ids = Object.keys(teams), pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = new Set(teams[ids[i]]), b = teams[ids[j]], size = Math.max(a.size, b.length) || 1;
    pairs.push(b.filter((x) => a.has(x)).length / size);
  }
  return pairs.reduce((t, x) => t + x, 0) / Math.max(1, pairs.length);
}
/** The most of a team on every other team (the castaway everyone has): how many teams the most-held castaway is on. */
const mostHeld = (teams) => { const c = {}; for (const t of Object.values(teams)) for (const x of t) c[x] = (c[x] || 0) + 1; return Math.max(0, ...Object.values(c)); };
/** A week's lineup choice, in points: the best the seat could have started from its team that week, less the worst. */
function swing(week) {
  const all = [...week.started, ...week.bench].map((x) => x.points).sort((a, b) => b - a), k = week.started.length;
  if (!k) return 0;
  const sum = (xs) => xs.reduce((t, x) => t + x, 0);
  return sum(all.slice(0, k)) - sum(all.slice(-k));
}
function summary(season) {
  const merge = season.drafts[1] || null;
  const weeks = season.stages.flatMap((st) => Object.values(st.weeks).flat());
  const order = [...season.overall].sort((a, b) => b.total - a.total);
  const first = [...season.stages[0].table].sort((a, b) => b.total - a.total);
  return {
    seed: season.seed,
    mergeLeft: merge?.left ?? null,
    mergeAlike: merge ? alike(merge.teams) : null,
    mergeMostHeld: merge ? mostHeld(merge.teams) : null,
    startAlike: alike(season.drafts[0].teams),
    swing: weeks.length ? weeks.reduce((t, w) => t + swing(w), 0) / weeks.length : 0,
    margin: order.length > 1 ? order[0].total - order[1].total : 0,
    winner: order[0].id,
    firstStageLeaderWins: first[0].id === order[0].id,
  };
}
const mean = (xs) => xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length);
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : 0; };
function typical(list) {
  const ok = list.filter((x) => x.mergeAlike != null);
  return {
    seasons: list.length,
    mergeLeft: median(ok.map((x) => x.mergeLeft)),
    mergeAlike: mean(ok.map((x) => x.mergeAlike)),
    mergeAlikeMost: ok.filter((x) => x.mergeAlike >= 0.6).length,
    mergeMostHeldAll: ok.filter((x) => x.mergeMostHeld === people.length).length,
    startAlike: mean(list.map((x) => x.startAlike)),
    swing: mean(list.map((x) => x.swing)),
    margin: median(list.map((x) => x.margin)),
    closeFinish: list.filter((x) => x.margin <= 3).length,
    firstStageLeaderWins: list.filter((x) => x.firstStageLeaderWins).length,
    winners: Object.fromEntries(people.map((p) => [p, list.filter((x) => x.winner === p).length])),
  };
}

function main() {
  const t0 = Date.now();
  const SMALL = { each: 3, start: 2 };
  // Three full seasons to show (Shuffle moves between them), each with its merge drafted the smaller way too (the fix).
  const samples = [51, 52, 53].map((seed) => ({ ...play(seed), small: play(seed, SMALL).drafts }));
  const many = [], small = [];
  for (let i = 1; i <= SEASONS; i++) {
    many.push(summary(samples[i - 1] || play(50 + i)));
    small.push(summary(play(50 + i, SMALL)));
  }
  const { record } = P.galleryFacts();
  const data = {
    schemaVersion: 1,
    madeAt: new Date().toISOString(),
    source: "scripts/dev-test/preview-story-data.js: the explorer's runtime, headless; every result made up; real castaways (stays out of git)",
    game: { name: "Fantasy league", show: "Survivor", season: 51, from: FROM, last: LAST, people: P.COUCH.map((p, i) => ({ ...p, you: i === 0 })), rules: { each: 5, start: 3, small: SMALL } },
    real: { aired: record.aired },
    samples,
    typical: typical(many),
    typicalSmall: typical(small),
    ms: Date.now() - t0,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
  const t = data.typical, u = data.typicalSmall;
  console.log(`${OUT}: ${SEASONS} seasons in ${(data.ms / 1000).toFixed(1)} s`);
  console.log(`merge: ${t.mergeLeft} left; teams ${Math.round(t.mergeAlike * 100)}% alike (draft 3: ${Math.round(u.mergeAlike * 100)}%); one castaway on every team in ${t.mergeMostHeldAll} of ${t.seasons} (draft 3: ${u.mergeMostHeldAll})`);
  console.log(`start: teams ${Math.round(t.startAlike * 100)}% alike; a week's lineup choice is worth ${t.swing.toFixed(1)} pts; winning margin ${t.margin}; close (3 or less) ${t.closeFinish} of ${t.seasons}; first stage's leader wins ${t.firstStageLeaderWins} of ${t.seasons}`);
}

if (require.main === module) main();
module.exports = { play, summary, typical };
