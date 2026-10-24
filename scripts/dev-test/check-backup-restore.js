// Dev-only check for step 0a's backup and restore (scripts/backup-leagues.js, scripts/restore-leagues.js):
// a --group backup of backup-fixture.js's zt group restores into a scratch database and matches, every
// backed-up table has rows (so the check covers them all), the one reference outside the group is settled,
// and a backup changed after the fact is caught. A backup from before step 0b (no couches or follows) restores
// with them filled in from its leagues.
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
const { TABLES, LATER_TABLES, hashLines } = require("../backup-common");

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

    // A backup from before step 0b's migrations (as production's is until they ship): no couch or follow files,
    // no couch_id on the leagues. The restore fills them in from the leagues, as the migrations did.
    const before0b = path.join(tmp, "before-0b");
    fs.cpSync(dir, before0b, { recursive: true });
    const m0 = JSON.parse(fs.readFileSync(path.join(before0b, "manifest.json"), "utf8"));
    for (const t of Object.keys(LATER_TABLES)) {
      fs.rmSync(path.join(before0b, `${t}.json`));
      delete m0.tables[t];
    }
    const leagueLines = JSON.parse(fs.readFileSync(path.join(before0b, "leagues.json"), "utf8")).map((row) => {
      delete row.couch_id;
      return JSON.stringify(row);
    });
    fs.writeFileSync(path.join(before0b, "leagues.json"), `[\n${leagueLines.join(",\n")}\n]\n`, "utf8");
    m0.tables.leagues.columns = m0.tables.leagues.columns.filter((c) => c !== "couch_id");
    m0.tables.leagues.hash = hashLines(leagueLines);
    m0.migrations = m0.migrations.filter((v) => v < "0100");
    fs.writeFileSync(path.join(before0b, "manifest.json"), JSON.stringify(m0, null, 2));
    r = run("restore-leagues.js", before0b, "--into=restore_zt_check", "--drop");
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /couches +- +1 +not in the backup \(made before 0100\): filled in from the leagues/, "the group's one couch");
    assert.match(r.out, /couch_members +- +2 +not in the backup/, "with both its people");
    assert.match(r.out, /show_follows +- +2 +not in the backup \(made before 0102\)/, "each following the season");
    assert.match(r.out, /everything matches/);

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
