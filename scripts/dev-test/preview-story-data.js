// Dev-only: the data a game preview's visual story is drawn from (docs/PLAN-game-preview.md, decision 3: a quick visual story of how
// the game plays). The P0 game (scripts/dev-test/preview-proof.js: the gallery's Fantasy league with a new draft at the merge, on
// Survivor 51) played headless by the explorer's runtime, read through the production game view, no database:
//   - three sample seasons in full (Shuffle), each also played whole with the fix (draft 3, start 2 at the merge): the game's and
//     each stage's production view, as the first seat, before the results, when a stage ends and at the end (the cards draw these
//     with the game's own components: src/new/preview/story.tsx);
//   - many more seasons (--seasons, default 30, each its own seed), as set and with the fix: each view's table at the end, so a
//     card flags something only when it happens in most seasons (the page counts it, with the game's own rules: bestOf).
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
const { lineups, night } = P._h;
const FROM = 9, LAST = 13;

/** The definition, its merge stage's draft made smaller (`each`, `start`) when asked. */
function defOf(seed, small) {
  const d = P.definition({ seed });
  if (small) for (const g of d.games) if (g.spec.stages) Object.assign(g.spec.stages[1].game, { get: { ...g.spec.stages[1].game.get, each: small.each }, count: { start: small.start } });
  return d;
}

/** Play one season to its end, keeping the production game views (`project(game, "alex").game`, exactly as the app's routes send
 *  them) of the game and each of its stages at the moments the cards show: before the first results, when a stage ends (its new
 *  draft made), and the end. Nothing is reshaped here: the story's cards draw these views with the game's own components. */
function play(seed, small) {
  const s = R.open(defOf(seed, small));
  try {
    const ids = s.export().input.games.map((g) => g.id);
    const views = () => Object.fromEntries(ids.map((g) => [g, s.project(g, "alex").game]));
    const at = { start: views() };
    let ended = 0;
    for (let n = FROM; n <= LAST; n++) {
      lineups(s, n); night(s, n);
      const v = views(), over = ids.filter((g) => v[g].over).length;
      if (over > ended || n === LAST) { at[n] = v; ended = over; }
    }
    return { seed, game: ids[0], stages: ids.slice(1), at };
  } finally { s.dispose(); }
}
/** A season for what's typical: its end's standings (each view's table rows, unchanged). */
const tablesOf = (season) => { const end = season.at[LAST]; return Object.fromEntries(Object.entries(end).map(([g, v]) => [g, v.table])); };

function main() {
  const t0 = Date.now();
  const SMALL = { each: 3, start: 2 };
  // Three seasons in full (Shuffle moves between them), each played again with the merge's smaller draft (the fix), whole.
  const samples = [51, 52, 53].map((seed) => ({ as: play(seed), fix: play(seed, SMALL) }));
  const seasons = [];
  for (let i = 1; i <= SEASONS; i++) {
    const x = samples[i - 1];
    seasons.push({ seed: 50 + i, as: tablesOf(x ? x.as : play(50 + i)), fix: tablesOf(x ? x.fix : play(50 + i, SMALL)) });
  }
  const data = {
    schemaVersion: 2,
    madeAt: new Date().toISOString(),
    source: "scripts/dev-test/preview-story-data.js: the explorer's runtime, headless, read through the production game view; every result made up; real castaways (stays out of git)",
    show: { name: "Survivor", season: 51, last: LAST },
    fix: SMALL,
    samples,
    seasons,
    ms: Date.now() - t0,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log(`${OUT}: ${SEASONS} seasons in ${(data.ms / 1000).toFixed(1)} s, ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
}

if (require.main === module) main();
module.exports = { play };
