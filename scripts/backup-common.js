// Shared by backup-leagues.js and restore-leagues.js (docs/PLAN-new-design.md, step 0a): which tables a
// league backup holds, how to look up their columns, keys and foreign keys, and the one way both scripts
// read rows back, so a backup and a restore can be compared hash for hash.
//
// A row is read as Postgres prints it (row_to_json, in UTC, over a fixed column list), and a table as its
// rows ordered by primary key, byte order rather than collation (production and the local copy needn't
// sort text alike). Same data, same text, same hash.
const crypto = require("crypto");

// Every table a backup holds, in three groups. People are only those the other rows point at.
const LEAGUE_TABLES = [
  "leagues", "league_memberships", "league_groups", "couches", "couch_members", "couch_invites", "league_invites", "league_rulesets", "waiver_claims",
  "blind_draft_picks", "episode_team_notes", "league_applied_decisions", "chat_messages", "chat_reactions",
  "chat_reads", "couch_chat_reads", "wiki_proposals", "wiki_proposal_items", "league_changes", "league_rulings", "couch_answers",
  "results_plans", "draft_queues", "game_join_requests", "watch_plans", "watch_plan_people", "couch_polls", "couch_poll_votes",
  "game_answers",
];
const SEASON_TABLES = [
  "shows", "show_formats", "show_seasons", "season_cast", "season_cast_changes", "season_decisions",
  "season_rule_changes", "episode_research", "episode_research_items", "wiki_extractions", "season_episodes", "show_follows",
  "fact_sources", "fact_disputes", "rulebooks", "rulebook_edits", "rulebook_suggestions", "admin_changes", "rulebook_checks",
  "guide_hidden", "episode_ratings", "episode_calls", "episode_call_says", "bingo_cards", "bingo_marks", "trivia_plays",
  "watch_reactions",
];
const PEOPLE_TABLES = ["user", "user_settings", "notification_prefs"];
const TABLES = [...LEAGUE_TABLES, ...SEASON_TABLES, ...PEOPLE_TABLES];

// Tables a database has only from a migration on (docs/PLAN-new-design.md step 0b), and the files that fill them
// in from the leagues. A backup of a database from before it simply hasn't got them; restoring that backup runs
// the fill-in files, so the restore has them as the migration would have made them.
const LATER_TABLES = {
  couches: { since: "0100", fill: "0101_couches_backfill.sql" },
  couch_members: { since: "0100", fill: "0101_couches_backfill.sql" },
  couch_invites: { since: "0100", fill: null },
  show_follows: { since: "0102", fill: "0103_show_follows_backfill.sql" },
  couch_chat_reads: { since: "0110", fill: null },
  league_changes: { since: "0111", fill: null },
  fact_sources: { since: "0112", fill: null },
  fact_disputes: { since: "0112", fill: null },
  league_rulings: { since: "0112", fill: null },
  // Rulebooks were left out until one could be edited (step 6b part 2): a database from before has its backfill's
  // legacy copies, which ensureSeasonRulebook makes again when a season is next read.
  rulebooks: { since: "0107", fill: null },
  rulebook_edits: { since: "0107", fill: null },
  rulebook_suggestions: { since: "0113", fill: null },
  admin_changes: { since: "0113", fill: null },
  couch_answers: { since: "0114", fill: null },
  results_plans: { since: "0115", fill: null },
  draft_queues: { since: "0117", fill: null },
  game_join_requests: { since: "0119", fill: null },
  rulebook_checks: { since: "0124", fill: null },
  guide_hidden: { since: "0125", fill: null },
  watch_plans: { since: "0127", fill: null },
  watch_plan_people: { since: "0127", fill: null },
  episode_ratings: { since: "0128", fill: null },
  episode_calls: { since: "0129", fill: null },
  episode_call_says: { since: "0129", fill: null },
  couch_polls: { since: "0129", fill: null },
  couch_poll_votes: { since: "0129", fill: null },
  bingo_cards: { since: "0130", fill: null },
  bingo_marks: { since: "0130", fill: null },
  trivia_plays: { since: "0130", fill: null },
  watch_reactions: { since: "0131", fill: null },
  game_answers: { since: "0200", fill: null },
};

/** Whether the database has this table. */
async function hasTable(db, table) {
  const { rows } = await db.query("SELECT to_regclass($1) IS NOT NULL AS ok", [`public.${q(table)}`]);
  return rows[0].ok;
}

const q = (ident) => `"${ident.replace(/"/g, '""')}"`;

/** A connection string described without its password: "host/database". */
function describeUrl(url) {
  const u = new URL(url);
  return `${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname}`;
}

async function columnsOf(db, table) {
  const { rows } = await db.query(
    `SELECT attname FROM pg_attribute WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attnum`,
    [`public.${q(table)}`]
  );
  return rows.map((r) => r.attname);
}

async function primaryKeyOf(db, table) {
  const { rows } = await db.query(
    `SELECT a.attname FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
      ORDER BY array_position(i.indkey::int2[], a.attnum)`,
    [`public.${q(table)}`]
  );
  return rows.map((r) => r.attname);
}

/** Every single-column foreign key in the public schema: { table, column, refTable, refColumn, onDelete, notNull }. */
async function foreignKeys(db) {
  const { rows } = await db.query(
    `SELECT c.conrelid::regclass::text AS tbl, c.confrelid::regclass::text AS ref, c.confdeltype AS del,
            array_length(c.conkey, 1) AS n, a.attname AS col, a.attnotnull AS not_null, fa.attname AS ref_col,
            EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.conrelid AND k.contype = 'c' AND a.attnum = ANY(k.conkey)) AS checked
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
       JOIN pg_namespace ns ON ns.oid = c.connamespace
      WHERE c.contype = 'f' AND ns.nspname = 'public'`
  );
  const bare = (t) => t.replace(/^public\./, "").replace(/^"(.*)"$/, "$1");
  // A multi-column key on a table the backup doesn't take (season_events, 0148: a sport's games) is no concern of it.
  const ours = rows.filter((r) => r.n === 1 || TABLES.includes(bare(r.tbl)));
  return ours.map((r) => {
    if (r.n !== 1) throw new Error(`${r.tbl}: a multi-column foreign key; backup-common.js only handles single columns`);
    // checked: a CHECK constraint reads the column (rulebooks_owner_shape needs a season's season_id), so a restore
    // can't leave it empty for a moment.
    return { table: bare(r.tbl), column: r.col, refTable: bare(r.ref), refColumn: r.ref_col, onDelete: r.del, notNull: r.not_null, checked: r.checked };
  });
}

/** A table's rows as text lines (row_to_json over `cols`), in primary-key byte order. Needs TIME ZONE 'UTC'. */
async function rowLines(db, table, cols, pk, where = "TRUE", params = []) {
  const order = (pk.length ? pk : cols).map((c) => `convert_to(x.${q(c)}::text, 'UTF8')`).join(", ");
  const { rows } = await db.query(
    `SELECT row_to_json(x)::text AS j FROM (SELECT ${cols.map(q).join(", ")} FROM ${q(table)} WHERE ${where}) x ORDER BY ${order}`,
    params
  );
  return rows.map((r) => r.j);
}

const hashLines = (lines) => crypto.createHash("sha256").update(lines.join("\n")).digest("hex");

module.exports = { LEAGUE_TABLES, SEASON_TABLES, PEOPLE_TABLES, TABLES, LATER_TABLES, q, hasTable, describeUrl, columnsOf, primaryKeyOf, foreignKeys, rowLines, hashLines };
