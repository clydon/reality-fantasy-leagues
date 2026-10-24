// Dev-only check for step 0a's backup and restore (scripts/backup-leagues.js, scripts/restore-leagues.js):
// a --group backup of backup-fixture.js's zt group restores into a scratch database and matches, every
// backed-up table has rows (so the check covers them all), the one reference outside the group is settled,
// and a backup changed after the fact is caught.
//
//   node scripts/dev-test/check-backup-restore.js     needs the local database only (no dev server)
//
// Brings backup-fixture.js up and down, and restores into restore_zt_check (dropped after). Backups go to a
// temporary folder that's removed at the end. Refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { Pool } = require("pg");
const fixture = require("./backup-fixture");
const { TABLES } = require("../backup-common");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-backup-restore runs against a local database only");
const ROOT = path.join(__dirname, "..", "..");
const run = (script, ...args) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", script), ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

(async () => {
  const pool = new Pool({ connectionString: DB });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zt-backup-"));
  try {
    const { groupId } = await fixture.up(pool);
    const dir = path.join(tmp, "group");
    let r = run("backup-leagues.js", dir, `--group=${groupId}`);
    assert.equal(r.status, 0, r.out);

    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.leagues.length, 3, "the group's three leagues, not zt-outside");
    for (const t of TABLES) assert.ok(manifest.tables[t].rows > 0, `${t} has rows, so the round trip covers it`);
    assert.ok(!JSON.stringify(manifest).includes("zt-pass"), "no passwords");
    for (const t of ["account", "session"]) assert.ok(!fs.existsSync(path.join(dir, `${t}.json`)), `no ${t} table`);

    r = run("restore-leagues.js", dir, "--into=restore_zt_check", "--drop");
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /everything matches/);
    assert.match(r.out, /season_cast_changes +1 +1 +same data \(1 references nulled/, "the cast change made in zt-outside: kept, by_league nulled");

    // Changed after it was taken: one player's name in one league's state.
    const tampered = path.join(tmp, "tampered");
    fs.cpSync(dir, tampered, { recursive: true });
    const file = path.join(tampered, "leagues.json");
    const leagues = JSON.parse(fs.readFileSync(file, "utf8"));
    leagues[0].state.players[0].name = "zt tampered";
    fs.writeFileSync(file, JSON.stringify(leagues));
    r = run("restore-leagues.js", tampered, "--into=restore_zt_check", "--drop");
    assert.equal(r.status, 1, "a changed backup fails the check");
    assert.match(r.out, /leagues .*leagues\.json IS NOT WHAT THE BACKUP WROTE/);
    assert.match(r.out, new RegExp(`${leagues[0].slug} .*DIFFERENT`), "and that league's state hash differs");
    assert.doesNotMatch(r.out, /league_memberships .*NOT WHAT/, "only the changed file is flagged");

    console.log("check-backup-restore: all good");
  } finally {
    await fixture.down(pool);
    await pool.end();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
