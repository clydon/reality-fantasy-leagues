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
  "leagues", "league_memberships", "league_groups", "league_invites", "league_rulesets", "waiver_claims",
  "blind_draft_picks", "episode_team_notes", "league_applied_decisions", "chat_messages", "chat_reactions",
  "chat_reads", "wiki_proposals", "wiki_proposal_items",
];
const SEASON_TABLES = [
  "shows", "show_formats", "show_seasons", "season_cast", "season_cast_changes", "season_decisions",
  "season_rule_changes", "episode_research", "episode_research_items", "wiki_extractions", "season_episodes",
];
const PEOPLE_TABLES = ["user", "user_settings", "notification_prefs"];
const TABLES = [...LEAGUE_TABLES, ...SEASON_TABLES, ...PEOPLE_TABLES];

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
            array_length(c.conkey, 1) AS n, a.attname AS col, a.attnotnull AS not_null, fa.attname AS ref_col
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       JOIN pg_attribute fa ON fa.attrelid = c.confrelid AND fa.attnum = c.confkey[1]
       JOIN pg_namespace ns ON ns.oid = c.connamespace
      WHERE c.contype = 'f' AND ns.nspname = 'public'`
  );
  const bare = (t) => t.replace(/^public\./, "").replace(/^"(.*)"$/, "$1");
  return rows.map((r) => {
    if (r.n !== 1) throw new Error(`${r.tbl}: a multi-column foreign key; backup-common.js only handles single columns`);
    return { table: bare(r.tbl), column: r.col, refTable: bare(r.ref), refColumn: r.ref_col, onDelete: r.del, notNull: r.not_null };
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

module.exports = { LEAGUE_TABLES, SEASON_TABLES, PEOPLE_TABLES, TABLES, q, describeUrl, columnsOf, primaryKeyOf, foreignKeys, rowLines, hashLines };
