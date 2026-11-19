// Dev-only: the first slice's previews (docs/PLAN-game-preview.md, "The first slice"): three of the gallery's games that look nothing
// alike (the Fantasy league with a new draft at the merge, the Prediction sheet, the Survival pool) on Survivor 51 with its real
// results through Episode 8 (decision 7), each made by the bench's preview maker (tools/gameplay-bench/preview/preview.cjs) with no
// one driving it: every seat's moves the computer players', the real screens as Alex at 390, the truth check at every moment.
// Results after Episode 8 are made up with the real season's rates (preview-proof.js resultsFor); the bench's own CLI makes the same
// preview with its plain publish (`node scripts/gameplay-bench.js preview --file=<definition> --out=<folder>`).
//
//   node --env-file=.env.local scripts/dev-test/preview-games.js [--games=fantasy,sheet,pool] [--seed=51] [--seasons=10]
//
// Needs this lane's dev server (BASE, default http://localhost:3014), its database, and preview-proof.js's record and dress. Writes
// .ui-atlas/previews/<game>-<seed>/ (preview.json and its shots; real castaways, so out of git). Rows are removed after each game.
const path = require("path");
process.env.BASE = process.env.BASE || "http://localhost:3014";
const P = require("./preview-proof.js");
const { make } = require("../../tools/gameplay-bench/preview/preview.cjs");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SEED = Number(opt("seed", 51)), SEASONS = Number(opt("seasons", 10));
const GAMES = {
  fantasy: {},
  sheet: { base: "sheet", gameId: "sheet" },
  pool: { base: "pool", gameId: "pool" },
};

(async () => {
  for (const id of opt("games", "fantasy,sheet,pool").split(",")) {
    if (!GAMES[id]) throw Error("No game " + id + ": " + Object.keys(GAMES).join(", "));
    const t0 = Date.now();
    console.log(`\n${id}:`);
    const p = await make({
      input: P.definition({ seed: SEED, ...GAMES[id] }),
      out: path.resolve(".ui-atlas/previews", `${id}-${SEED}`),
      id: `${id}-${SEED}`,
      app: process.env.BASE,
      seasons: SEASONS,
      resultsFor: P._h.resultsFor,
      log: console.log,
    });
    const bugs = p.moments.flatMap((m) => m.screens.flatMap((x) => x.bugs.map((y) => `${m.id}/${x.id}: ${y.text}`)));
    const disagree = p.checks.filter((c) => c.agree === false).map((c) => `${c.moment}/${c.check}`);
    console.log(`${id}: ${p.moments.length} moments (${p.moments.map((m) => m.id).join(", ")}), ${p.moments.reduce((t, m) => t + m.screens.length, 0)} screens in ${Math.round((Date.now() - t0) / 1000)} s`);
    console.log(`  steps: ${p.steps.map((x) => `${x.step} ${Math.round(x.ms / 100) / 10}s`).join(" · ")}`);
    console.log(`  checks: ${p.checks.length - disagree.length} of ${p.checks.length} agree${disagree.length ? " (" + disagree.join(", ") + ")" : ""}; route problems: ${p.problems.length ? [...new Set(p.problems)].join(", ") : "none"}`);
    for (const b of bugs) console.log("  " + b);
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
