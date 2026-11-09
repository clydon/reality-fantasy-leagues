// Dev-only check for G5's made-for games (src/lib/server/made-games.ts, game-words/made.js): asks the LOCAL bot (whatever
// .env.local points at, the run kind 'made') for a season's made-for games as a throwaway desk admin, then checks
//   1. the ask kept some (season_game_ideas: every kept idea a name, hook, length and a spec), and printed each;
//   2. the wizard's rail (start-wizard createWizard(...).games) offers them by length: one episode, a few, the season, after the
//      classic and the easy one, each "Made for <show>", each building a game (build(...).r.ok).
// A minute or three of the bot's time: an ask adds to the season's library (the kinds it lacks first); --fresh starts it over;
// --reuse skips the ask when the season already has its games (the rail check only).
//
//   node scripts/dev-test/check-made-games.js <seasonId> [--fresh | --reuse] [--keep]
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
const seasonId = args.find((a) => !a.startsWith("--"));

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

(async () => {
  if (args.includes("--down")) return down();
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
