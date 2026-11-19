// Dev-only: make a live preview (tools/gameplay-bench/preview/live.cjs) from the command line, with no browser: the moments, each
// screen's copy and address, and how long it took. The copies are removed at the end unless --keep (then this prints how to remove
// them). The same maker the app's on-demand preview calls (src/lib/server/preview-live.ts).
//
//   node --env-file=.env.local scripts/dev-test/preview-live.js [--game=fantasy|sheet|pool] [--seed=51] [--seasons=5] [--keep]
//
// Needs this lane's dev server (BASE, default http://localhost:3014) and its database.
process.env.BASE = process.env.BASE || "http://localhost:3014";
const P = require("./preview-proof.js");
const Live = require("../../tools/gameplay-bench/preview/live.cjs");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const GAMES = { fantasy: {}, sheet: { base: "sheet", gameId: "sheet" }, pool: { base: "pool", gameId: "pool" } };

(async () => {
  const game = opt("game", "pool");
  if (!GAMES[game]) throw Error("No game " + game);
  const t0 = Date.now();
  const p = await Live.make({ input: P.definition({ seed: Number(opt("seed", 51)), ...GAMES[game] }), app: process.env.BASE, seasons: Number(opt("seasons", 5)), resultsFor: P._h.resultsFor, log: console.log });
  console.log(`${game}: ${p.moments.length} moments in ${Math.round((Date.now() - t0) / 100) / 10} s · steps: ${p.steps.map((x) => `${x.step} ${Math.round(x.ms / 100) / 10}s`).join(" · ")}`);
  for (const m of p.moments) console.log(`  ${m.id.padEnd(8)} ${m.screens.map((sc) => `${sc.name} [${sc.state}] ${sc.path}`).join("  |  ")}`);
  console.log(`  viewer: ${p.viewerUser} · copies: ${p.copies.join(", ")}`);
  if (args.includes("--keep")) console.log(`  kept: node -e "require('./tools/gameplay-bench/preview/live.cjs').down({copies:${JSON.stringify(p.copies)}}).then(()=>process.exit())"`);
  else await Live.down(p);
  await require("../../tools/gameplay-bench/live-db.cjs").close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
