// The classic episode editor's leaving-the-game form (src/components/episodes/episode-editor.tsx): a finalist's exit asks
// for their jury votes wherever the format scores each one, read from the format's own data (its finalist and winner ways
// out, and an implied rule per jury vote) rather than its name (docs/PLAN-start-a-game-gpt.md S2). Opens an episode of a
// results-fixture league as its commissioner, Episode actions › Edit results, and picks each exit method in turn.
//
//   node scripts/dev-test/results-fixture.js up      (a Survivor season and its three leagues, zt_comm runs them)
//   node scripts/dev-test/check-episode-editor.js [outDir] [width=390] [--league=classic|roster|pool] [--episode=3]
//   node scripts/dev-test/results-fixture.js down
//
// Needs the dev server (BASE, from .env.local: this lane's port). Prints PASS/FAIL lines, writes <outDir>/episode-editor-
// <league>.png when an outDir is given, and exits 1 on any failure or page error.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { open } = require("./browser");
const Formats = require("../../src/lib/game/formats/index.js");

(async () => {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => (args.find((a) => a.startsWith(`--${name}=`)) || `--${name}=${fallback}`).split("=")[1];
  const [out, w = "390"] = args.filter((a) => !a.startsWith("--"));
  const width = parseInt(w, 10) || 390;
  const which = flag("league", "classic");
  const episode = parseInt(flag("episode", "3"), 10);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const { rows } = await pool.query("SELECT id FROM leagues WHERE slug = $1", [`zt-res-${which}`]);
  await pool.end();
  if (!rows.length) throw new Error("no fixture league: run results-fixture.js up");
  const format = Formats.FORMATS.survivor;
  let failed = 0;
  const check = (ok, what) => {
    console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
    if (!ok) failed++;
  };

  const { page, errors, BASE, close } = await open({ user: "zt_comm", pass: "zt-pass-12345", width });
  try {
    await page.goto(`${BASE}/episodes/${episode}?league=${rows[0].id}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Episode actions" }).click();
    await page.getByRole("button", { name: "Edit results" }).click();
    const how = page.getByRole("combobox", { name: "How they left" });
    await how.waitFor();
    const jury = page.getByPlaceholder("Jury votes received");
    for (const method of format.exitMethods) {
      await how.selectOption(method);
      const asks = format.endgameExitMethods.includes(method);
      check((await jury.isVisible()) === asks, `${method}: ${asks ? "asks" : "doesn't ask"} for jury votes`);
    }
    await how.selectOption(format.endgameExitMethods[0]);
    const box = await jury.boundingBox();
    check(!!box && box.x >= 0 && box.x + box.width <= width, `the jury votes field fits ${width}px`);
    if (out) await page.screenshot({ path: `${out}/episode-editor-${which}.png`, fullPage: true });
    check(!errors.length, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  } finally {
    await close();
  }
  if (failed) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
