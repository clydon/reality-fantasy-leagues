// Backs up everything the couch has played, before the new design changes anything (docs/PLAN-new-design.md,
// step 0a): the leagues with their state, members, groups, invites, rulesets, waiver claims, blind draft
// picks, team notes, applied results and chat (the couch's own chat about a show too, step 4); their couches (step 0b);
// their seasons' shows, formats, cast,
// results, rule changes, research, wiki reads and who follows them; and the people those rows point at (user,
// settings, notification prefs: never sessions, accounts or passwords). A database from before step 0b's
// migrations has no couches or follows yet, and its backup goes without them.
//
//   node scripts/backup-leagues.js <outDir>                       every league, every season (the default)
//   node scripts/backup-leagues.js <outDir> --group=<group id>    one linked group's leagues and their seasons
//
// Run it from the repo root. It reads BACKUP_DATABASE_URL when set, else AUTH_DATABASE_URL from .env.local,
// and prints the host and database it's reading (never the password). For production, set the variable in
// your own terminal for the one command, never in a file:
//
//   PowerShell:  $env:BACKUP_DATABASE_URL = "<production connection string>"
//                node scripts/backup-leagues.js backups/prod-2026-10-24
//                Remove-Item Env:BACKUP_DATABASE_URL
//
// One read-only, repeatable-read transaction: a consistent snapshot that can't write. Writes one JSON file
// per table (Postgres's own text for each row) and manifest.json (row counts, a hash per table, each
// league's state hash, the migrations applied). restore-leagues.js loads it into a scratch database and
// checks it against the manifest. backups/ is gitignored.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const C = require("./backup-common");

// Season-level rows hang off the leagues' seasons; in --group mode only those. A league names its season by
// show slug and season number in its state (settings.showId, settings.wikiSeason).
const GROUP_SLICES = {
  leagues: "id = ANY($L::uuid[])",
  league_memberships: "league_id = ANY($L::uuid[])",
  league_groups: "id IN (SELECT group_id FROM leagues WHERE id = ANY($L::uuid[]))",
  couches: "id IN (SELECT couch_id FROM leagues WHERE id = ANY($L::uuid[]))",
  couch_members: "couch_id IN (SELECT couch_id FROM leagues WHERE id = ANY($L::uuid[]))",
  couch_invites: "couch_id IN (SELECT couch_id FROM leagues WHERE id = ANY($L::uuid[]))",
  league_invites: "league_id = ANY($L::uuid[])",
  league_rulesets: "league_id = ANY($L::uuid[]) OR id IN (SELECT ruleset_id FROM leagues WHERE id = ANY($L::uuid[]))",
  waiver_claims: "league_id = ANY($L::uuid[])",
  blind_draft_picks: "league_id = ANY($L::uuid[])",
  episode_team_notes: "league_id = ANY($L::uuid[])",
  league_applied_decisions: "league_id = ANY($L::uuid[])",
  // A couch's chat about a show it has no game on (migration 0110: no league, its couch and season) comes with the
  // couch when it's about one of the group's seasons; a database from before 0110 has only league chat.
  chat_messages: (cols) => CHAT_IN(cols),
  chat_reactions: (cols, chatCols) => `message_id IN (SELECT id FROM chat_messages WHERE ${CHAT_IN(chatCols)})`,
  chat_reads: "league_id = ANY($L::uuid[])",
  couch_chat_reads: "couch_id IN (SELECT couch_id FROM leagues WHERE id = ANY($L::uuid[])) AND season_id = ANY($S::uuid[])",
  wiki_proposals: "league_id = ANY($L::uuid[])",
  wiki_proposal_items: "league_id = ANY($L::uuid[])",
  league_changes: "league_id = ANY($L::uuid[])",
  // Results from everyone (0112): a game's house rulings, and its season's sources and flags.
  league_rulings: "league_id = ANY($L::uuid[])",
  fact_sources: "decision_id IN (SELECT id FROM season_decisions WHERE season_id = ANY($S::uuid[]))",
  fact_disputes: "season_id = ANY($S::uuid[])",
  shows: "id IN (SELECT show_id FROM show_seasons WHERE id = ANY($S::uuid[]))",
  show_formats: "id IN (SELECT s.format FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE ss.id = ANY($S::uuid[]))",
  show_seasons: "id = ANY($S::uuid[])",
  season_cast: "season_id = ANY($S::uuid[])",
  season_cast_changes: "season_id = ANY($S::uuid[])",
  season_decisions: "season_id = ANY($S::uuid[])",
  season_rule_changes: "season_id = ANY($S::uuid[])",
  season_episodes: "season_id = ANY($S::uuid[])",
  show_follows: "season_id = ANY($S::uuid[]) AND user_id IN (SELECT user_id FROM league_memberships WHERE league_id = ANY($L::uuid[]))",
  episode_research: "(show_id, season_number) IN (SELECT show_id, season_number FROM show_seasons WHERE id = ANY($S::uuid[]))",
  episode_research_items: `league_id = ANY($L::uuid[]) AND research_id IN (SELECT er.id FROM episode_research er
      JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number WHERE ss.id = ANY($S::uuid[]))`,
  wiki_extractions: "(show_id, season_number) IN (SELECT show_id, season_number FROM show_seasons WHERE id = ANY($S::uuid[]))",
};
function CHAT_IN(chatCols) {
  return chatCols.includes("couch_id")
    ? "(league_id = ANY($L::uuid[]) OR (league_id IS NULL AND couch_id IN (SELECT couch_id FROM leagues WHERE id = ANY($L::uuid[])) AND season_id = ANY($S::uuid[])))"
    : "league_id = ANY($L::uuid[])";
}

// Rows another table points at that a slice can miss (a result read from a wiki extraction of another
// season, say) are added; people are only ever added this way.
const PULLED = ["wiki_extractions", "user"];
const PEOPLE_SLICES = { user: "id = ANY($X::text[])", user_settings: "user_id = ANY($X::text[])", notification_prefs: "user_id = ANY($X::text[])" };

// A slice names its lists ($L the leagues, $S the seasons, $X ids pointed at); each query gets them numbered
// in the order it uses them, since Postgres refuses a parameter the query doesn't use.
function bind(where, lists) {
  const used = [];
  const sql = where.replace(/\$([LSX])/g, (_, n) => {
    if (!used.includes(n)) used.push(n);
    return `$${used.indexOf(n) + 1}`;
  });
  return [sql, used.map((n) => lists[n])];
}

async function main() {
  const outDir = process.argv[2];
  const groupArg = process.argv.find((a) => a.startsWith("--group="));
  const groupId = groupArg ? groupArg.slice(8) : null;
  if (!outDir || outDir.startsWith("--")) throw new Error("usage: node scripts/backup-leagues.js <outDir> [--group=<league_groups id>]");
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) throw new Error(`${outDir} isn't empty: a backup never overwrites another`);

  const env = process.env.BACKUP_DATABASE_URL ? "BACKUP_DATABASE_URL" : "AUTH_DATABASE_URL";
  const url = process.env[env];
  if (!url) throw new Error("set BACKUP_DATABASE_URL, or AUTH_DATABASE_URL in .env.local");
  console.log(`[backup] reading ${C.describeUrl(url)} (from ${env})${groupId ? `, group ${groupId}` : ", every league"}`);

  const pool = new Pool({ connectionString: url });
  const db = await pool.connect();
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await db.query("SET LOCAL TIME ZONE 'UTC'");

    const { rows: leagues } = await db.query(
      `SELECT id, slug, name, md5(state::text) AS state_hash, state->'settings'->>'showId' AS show_slug, state->'settings'->>'wikiSeason' AS season
         FROM leagues ${groupId ? "WHERE group_id = $1" : ""} ORDER BY slug`,
      groupId ? [groupId] : []
    );
    if (groupId && !leagues.length) throw new Error(`no leagues in group ${groupId}`);
    const leagueIds = leagues.map((l) => l.id);
    const { rows: seasons } = groupId
      ? await db.query(
          `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
            WHERE (s.slug, ss.season_number::text) IN (SELECT * FROM unnest($1::text[], $2::text[]))`,
          [leagues.map((l) => l.show_slug), leagues.map((l) => l.season)]
        )
      : await db.query("SELECT id FROM show_seasons");
    const seasonIds = seasons.map((s) => s.id);

    const fks = await C.foreignKeys(db);
    const meta = {};
    const lines = {};
    const parsed = {};
    const take = async (table, where, extra = []) => {
      const cols = await C.columnsOf(db, table);
      const pk = await C.primaryKeyOf(db, table);
      meta[table] = { columns: cols, primaryKey: pk };
      lines[table] = await C.rowLines(db, table, cols, pk, ...bind(where, { L: leagueIds, S: seasonIds, X: extra }));
      parsed[table] = lines[table].map((l) => JSON.parse(l));
    };
    // A database from before a later table's migration (C.LATER_TABLES) hasn't got it: the backup goes without.
    const present = [];
    for (const table of C.TABLES) if (await C.hasTable(db, table)) present.push(table);
    for (const table of C.TABLES.filter((t) => !present.includes(t))) {
      if (!C.LATER_TABLES[table]) throw new Error(`the database has no ${table} table`);
      console.log(`[backup] no ${table} table (it comes with migration ${C.LATER_TABLES[table].since}): left out`);
    }
    // A slice can depend on the table's columns (chat_messages before and after 0110).
    const chatCols = await C.columnsOf(db, "chat_messages");
    const sliceOf = async (table) => {
      const slice = GROUP_SLICES[table];
      return typeof slice === "function" ? slice(await C.columnsOf(db, table), chatCols) : slice;
    };
    for (const table of [...C.LEAGUE_TABLES, ...C.SEASON_TABLES].filter((t) => present.includes(t))) await take(table, groupId ? await sliceOf(table) : "TRUE");

    // Rows pointed at from outside their slice, then the people every row so far points at.
    for (const table of PULLED) {
      const have = new Set((parsed[table] || []).map((r) => r.id));
      const want = new Set();
      for (const fk of fks.filter((f) => f.refTable === table && parsed[f.table])) {
        for (const r of parsed[fk.table]) if (r[fk.column] != null && !have.has(r[fk.column])) want.add(r[fk.column]);
      }
      if (table === "user") {
        await take("user", PEOPLE_SLICES.user, [...want]);
        for (const t of ["user_settings", "notification_prefs"]) await take(t, PEOPLE_SLICES[t], [...want]);
      } else if (want.size) {
        // Only in --group mode (every row is already in otherwise). Read again whole, so it stays in key order.
        const before = lines[table].length;
        await take(table, `(${await sliceOf(table)}) OR id = ANY($X::uuid[])`, [...want]);
        console.log(`[backup] ${table}: +${lines[table].length - before} rows pointed at from outside their seasons`);
      }
    }

    const { rows: migrations } = await db.query("SELECT version FROM schema_migrations ORDER BY version");
    await db.query("COMMIT");

    fs.mkdirSync(outDir, { recursive: true });
    const tables = {};
    for (const table of present) {
      fs.writeFileSync(path.join(outDir, `${table}.json`), `[\n${lines[table].join(",\n")}\n]\n`, "utf8");
      tables[table] = { rows: lines[table].length, hash: C.hashLines(lines[table]), ...meta[table] };
    }
    const manifest = {
      format: 1,
      createdAt: new Date().toISOString(),
      source: { env, at: C.describeUrl(url) },
      scope: groupId ? { group: groupId } : "all",
      migrations: migrations.map((m) => m.version),
      leagues: leagues.map((l) => ({ id: l.id, slug: l.slug, name: l.name, stateHash: l.state_hash })),
      tables,
    };
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

    const width = Math.max(...present.map((t) => t.length));
    for (const t of present) console.log(`  ${t.padEnd(width)}  ${String(tables[t].rows).padStart(6)}`);
    console.log(`[backup] ${leagues.length} leagues, ${seasonIds.length} seasons, ${tables.user.rows} people -> ${outDir}`);
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`[backup] ${e.message}`);
  process.exitCode = 1;
});
