// Dev-only check for G5's made-for games (src/lib/server/made-games.ts, game-words/made.js): asks the LOCAL bot (whatever
// .env.local points at, the run kind 'made') for a season's made-for games as a throwaway desk admin, then checks
//   1. the ask kept some (season_game_ideas: every kept idea a name, hook, length and a spec), and printed each;
//   2. the wizard's rail (start-wizard createWizard(...).games) offers them by length: one episode, a few, the season, after the
//      classic and the easy one, each "Made for <show>", each building a game (build(...).r.ok).
//   3. --screens <outDir> (no ask): at --width (390 by default) on new-fixture.js's couch, with <seasonId>'s made-for games copied
//      onto its ZT Survivor 51 for the run and zt_nd_alex a site admin for it: the desk's Setup › Made-for games (its rows, a
//      made game's hook), Start a game's rail on Tonight and The season (a made game picked, its hook under the rail); nothing
//      wider than the screen. Takes the fixture down after (--keep leaves it), the copied row and alex's role with it.
// A minute or three of the bot's time: an ask adds to the season's library (the kinds it lacks first); --fresh starts it over;
// --reuse skips the ask when the season already has its games (the rail check only).
//
//   node scripts/dev-test/check-made-games.js <seasonId> [--fresh | --reuse] [--keep]
//   node scripts/dev-test/check-made-games.js <seasonId> --screens <outDir> [--width=390] [--keep]   (the dev server running)
//   node scripts/dev-test/check-made-games.js --down          (takes the zt-mg- admin down, nothing else)
//
// up/down: one zt-mg-desk account (made_by points at it; down sets it null and leaves the season's games, which are real data
// the desk would make anyway: Make them again on Setup replaces them). Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-made-games runs against a local database only");
const ID = "zt-mg-desk";
const args = process.argv.slice(2);
const seasonId = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--screens");

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const pg = new Pool({ connectionString: DB });
const up = () =>
  pg.query(`INSERT INTO "user" (id, name, email, "emailVerified", role) VALUES ($1, 'zt-mg-desk', 'zt-mg-desk@example.test', true, 'admin') ON CONFLICT (id) DO NOTHING`, [ID]);
async function down() {
  await pg.query("UPDATE season_game_ideas SET made_by = NULL WHERE made_by = $1", [ID]);
  await pg.query(`DELETE FROM "user" WHERE id = $1`, [ID]);
}

/** 3: the screens, on new-fixture's couch. */
async function screens(outDir) {
  const fs = require("fs");
  const fixture = require("./new-fixture");
  const { open, BASE } = require("./browser");
  const WIDTH = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
  fs.mkdirSync(outDir, { recursive: true });
  const fx = await fixture.up(pg);
  const alex = fx.users.alex;
  try {
    await pg.query(
      `INSERT INTO season_game_ideas (season_id, ideas, made_at) SELECT $2, ideas, now() FROM season_game_ideas WHERE season_id = $1
       ON CONFLICT (season_id) DO UPDATE SET ideas = EXCLUDED.ideas, made_at = now()`,
      [seasonId, fx.seasonId]
    );
    await pg.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [alex]);
    const { page, close } = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width: WIDTH, height: 844 });
    const wide = async (where) => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      check(w <= WIDTH, `${where}: nothing wider than the screen (${w})`);
    };
    try {
      await page.goto(`${BASE}/desk/season/${fx.seasonId}/setup`);
      await page.getByText("Make more").first().scrollIntoViewIfNeeded({ timeout: 30000 });
      await page.getByText(/on Start a game's rail/).first().waitFor({ timeout: 30000 });
      const line = await page.getByText("Make more").first().locator("xpath=..").innerText();
      check(/on Start a game's rail/.test(line), `Setup's row: ${line.replace(/\n/g, " · ")}`);
      check((await page.getByText("Start over").count()) === 1, "Setup's Start over row");
      await page.screenshot({ path: `${outDir}/made-setup-${WIDTH}.png` });
      // Start over's first tap only asks to be sure (a second would ask the bot: never here).
      await page.getByText("Start over").first().click();
      check((await page.getByText("Tap again to start over").count()) === 1, "Start over's first tap asks for a second");
      await page.screenshot({ path: `${outDir}/made-setup-sure-${WIDTH}.png` });
      await wide("Setup");

      await page.goto(`${BASE}/show/${fx.seasonId}/games`);
      await page.locator("[data-start-row]").first().click();
      await page.locator("[data-start-screen=home]").waitFor({ timeout: 30000 });
      for (const mode of ["tonight", "season"]) {
        await page.locator(`[data-start-mode=${mode}]`).click();
        const made = page.locator('[data-start-game^="made-"]');
        const n = await made.count();
        check(n > 0, `${mode}: the rail has ${n} made-for games`);
        if (!n) continue;
        await made.first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${outDir}/made-rail-${mode}-${WIDTH}.png` });
        await made.first().click();
        await page.waitForTimeout(400);
        const hook = await page.locator("[data-start-hook]").innerText().catch(() => "");
        check(!!hook, `${mode}: a made game picked shows its hook: ${hook}`);
        await page.screenshot({ path: `${outDir}/made-picked-${mode}-${WIDTH}.png` });
        await wide(`the wizard, ${mode}`);
      }
    } finally {
      await close();
    }
  } finally {
    await pg.query(`UPDATE "user" SET role = NULL WHERE id = $1`, [alex]);
    await pg.query("DELETE FROM season_game_ideas WHERE season_id = $1", [fx.seasonId]);
    if (!args.includes("--keep")) await fixture.down(pg);
  }
}

(async () => {
  if (args.includes("--down")) return down();
  const at = args.indexOf("--screens");
  if (at >= 0) {
    if (!seasonId || !args[at + 1]) throw new Error("--screens needs <seasonId> and <outDir>");
    return screens(args[at + 1]);
  }
  if (!seasonId) throw new Error("Which season? node scripts/dev-test/check-made-games.js <seasonId>");
  await up();
  const user = { id: ID, name: "zt-mg-desk", role: "admin" };
  const Made = jiti("../../src/lib/server/made-games.ts");
  const { packFor } = jiti("../../src/lib/server/game-words.ts");
  const W = require("../../src/lib/game/start-wizard/index.js");

  // 1. The ask.
  let games = await Made.madeGames(seasonId);
  if (!args.includes("--reuse") || !games.length) {
    const t0 = Date.now();
    const out = await Made.makeGames(user, seasonId, { fresh: args.includes("--fresh") });
    console.log(`asked: ${out.text}, ${Math.round((Date.now() - t0) / 1000)} s`);
    games = await Made.madeGames(seasonId);
  }
  check(games.length > 0, `the season keeps made-for games (${games.length})`);
  check(games.every((g) => g.name && g.hook && ["one", "few", "season"].includes(g.length) && g.spec), "each has a name, hook, length and spec");
  const W0 = require("../../src/lib/game/start-wizard/index.js");
  for (const g of games) console.log(`      [${g.length}, ${W0.kindOfSpec(g.spec)}, ${W0.winOfSpec(g.spec)}${g.bet ? ", bet" : ""}] ${g.name}: ${g.hook}`);
  console.log(`      none yet: ${(await Made.madeRow(seasonId)).missing.join(", ") || "nothing"}`);

  // 2. The rail, on the season's page as the throwaway admin sees it (no couch).
  const { pack, ctx } = await packFor(user, seasonId, null);
  const first = pack.episodes.next?.number ?? pack.episodes.aired + 1;
  const input = {
    page: { ctx, pack },
    first,
    last: pack.episodes.total ?? null,
    phases: (ctx.phases ?? []).map((p) => ({ id: p.id, name: p.name ?? p.id, starts: null })),
    part: { singular: "episode", plural: "episodes" },
    label: pack.label ?? "the season",
    made: games,
  };
  const wizard = W.createWizard(input);
  const spans = { one: { from: first, to: first }, few: { from: first, to: first + 2 }, season: W.timing(input).season };
  for (const [length, span] of Object.entries(spans)) {
    const want = games.filter((g) => g.length === length).length;
    const g = wizard.games(span);
    const made = g.list.filter((x) => x.kind === "made");
    const firstMade = g.list.findIndex((x) => x.kind === "made");
    const builds = made.filter((x) => wizard.build(span, { ...W.fresh?.(), sel: x.id })?.r?.ok).length;
    check(!want || made.length > 0, `${length}: the rail offers ${made.length} of the ${want} made for it`, made.length ? "" : "none fit these episodes");
    if (made.length) {
      check(g.list.slice(0, firstMade).every((x) => x.id === g.classic || x.id === g.easy), `${length}: after the classic and the easy one`);
      check(made.every((x) => /^Made for /.test(x.role)), `${length}: each says "${made[0].role}"`);
      check(builds === made.length, `${length}: each builds a game (${builds} of ${made.length})`);
    }
  }
  if (!args.includes("--keep")) await down();
})()
  .catch((e) => {
    failures++;
    console.error("FAIL ", e.message);
  })
  .finally(async () => {
    await pg.end();
    console.log(failures ? `${failures} failed` : "ALL PASS");
    process.exit(failures ? 1 : 0);
  });
