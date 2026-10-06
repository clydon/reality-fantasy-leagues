// A commissioner's own copy of a show's scoring rules (db/migrations/0052,
// docs/PLAN-scoring-rules-as-data.md "Who owns what"). Masters aren't touched here: a built-in format's
// rules stay code (src/lib/game/formats/), a show_formats row stays the master for an AI-researched show
// (db/show-formats.js). This file only knows about league_rulesets -- the one new concept, a league's
// own fork of either kind of master (or of another league's shared copy), with lineage back to it.
//
// Plain CommonJS, like db/show-formats.js. `db` is a pool or a client inside a transaction.
const Formats = require("../src/lib/game/formats/index.js");

/** Why `data` can't be stored as a league ruleset: [] when it's fine. Same gate every write goes
 *  through (fork, edit) -- formatProblems plus the one extra limit buildDataFormat enforces (no
 *  secret roles yet, the same limit show_formats already lives under). */
function rulesetProblems(data) {
  const problems = Formats.formatProblems(data);
  if (!problems.length && data && data.roles) {
    problems.push("roles: a league ruleset can't carry secret roles yet (same limit as a stored show format)");
  }
  return problems;
}

/** A league's cached ruleset data, for StateLogic.formatOf to read with no database. Mirrors
 *  show-formats.js's setLeagueFormat. */
function setLeagueRuleset(settings, data) {
  if (data) settings.leagueRulesetData = data;
  else delete settings.leagueRulesetData;
}

const rowOut = (r) => ({
  id: r.id, leagueId: r.league_id, name: r.name, data: r.data, version: r.version,
  parentKind: r.parent_kind, parentId: r.parent_id, parentVersion: r.parent_version,
  visibility: r.visibility, reviewStatus: r.review_status, lockedAt: r.locked_at,
  createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
});

async function getRuleset(db, id) {
  const { rows } = await db.query("SELECT * FROM league_rulesets WHERE id=$1", [id]);
  return rows.length ? rowOut(rows[0]) : null;
}

/** The ruleset a league is currently using, or null if it's following its show's format as-is. */
async function getLeagueRuleset(db, leagueId) {
  const { rows } = await db.query(
    "SELECT r.* FROM league_rulesets r JOIN leagues l ON l.ruleset_id = r.id WHERE l.id=$1",
    [leagueId]
  );
  return rows.length ? rowOut(rows[0]) : null;
}

/** Shared rulesets from other leagues, for a future copy-browsing screen -- nothing calls this yet. */
async function listShared(db, { excludeLeagueId } = {}) {
  const { rows } = await db.query(
    `SELECT r.*, l.name AS league_name
       FROM league_rulesets r JOIN leagues l ON l.id = r.league_id
      WHERE r.visibility = 'shared' AND r.league_id <> COALESCE($1, '00000000-0000-0000-0000-000000000000')
      ORDER BY r.updated_at DESC`,
    [excludeLeagueId || null]
  );
  return rows.map((r) => ({ ...rowOut(r), leagueName: r.league_name }));
}

/**
 * Resolves what a fork is forking FROM. Throws a plain Error with a reason on refusal (stays
 * HTTP-agnostic, like show-formats.js) -- never silently falls back, unlike formatFor's own default.
 */
async function sourceDataFor(db, { kind, id }) {
  if (kind === "builtin") {
    if (!Formats.isBuiltInFormat(id)) throw new Error(`"${id}" isn't a built-in format`);
    const data = Formats.FORMATS[id].data;
    if (data.roles) throw new Error(`${data.name} can't be customised yet (secret roles aren't supported in a league ruleset)`);
    return { data, parentVersion: null, defaultName: data.name };
  }
  if (kind === "show_format") {
    const { rows } = await db.query("SELECT name, data, version, status FROM show_formats WHERE id=$1", [id]);
    if (!rows.length || rows[0].status !== "approved" || !rows[0].data) throw new Error(`"${id}" isn't an approved show format`);
    return { data: rows[0].data, parentVersion: rows[0].version, defaultName: rows[0].name };
  }
  if (kind === "league_ruleset") {
    const { rows } = await db.query("SELECT name, data, version, visibility FROM league_rulesets WHERE id=$1", [id]);
    if (!rows.length || rows[0].visibility !== "shared") throw new Error("That ruleset isn't shared");
    return { data: rows[0].data, parentVersion: rows[0].version, defaultName: rows[0].name };
  }
  throw new Error(`"${kind}" isn't something a ruleset can be forked from`);
}

async function insertRuleset(db, { leagueId, name, data, parentKind, parentId, parentVersion, userId }) {
  const { rows } = await db.query(
    `INSERT INTO league_rulesets (league_id, name, data, parent_kind, parent_id, parent_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [leagueId, name, JSON.stringify(data), parentKind, parentId, parentVersion, userId || null]
  );
  return rowOut(rows[0]);
}

async function updateRulesetData(db, id, data, name) {
  const { rows } = await db.query(
    "UPDATE league_rulesets SET data=$2, name=$3, version=version+1, updated_at=now() WHERE id=$1 RETURNING *",
    [id, JSON.stringify(data), name]
  );
  return rows.length ? rowOut(rows[0]) : null;
}

async function setVisibility(db, id, visibility) {
  const { rows } = await db.query("UPDATE league_rulesets SET visibility=$2, updated_at=now() WHERE id=$1 RETURNING *", [id, visibility]);
  return rows.length ? rowOut(rows[0]) : null;
}

/** Deletes a ruleset only if no other row still forks from it (mirrors show-formats.js's deleteFormat
 *  "refuse while in use" check, auto-resolved here instead of surfaced -- see abandonLeagueRuleset). */
async function deleteIfUnreferenced(db, id) {
  const { rows } = await db.query(
    `DELETE FROM league_rulesets WHERE id=$1
       AND NOT EXISTS (SELECT 1 FROM league_rulesets WHERE parent_kind='league_ruleset' AND parent_id=$1::text)
     RETURNING id`,
    [id]
  );
  return rows.length > 0;
}

module.exports = {
  rulesetProblems, setLeagueRuleset, getRuleset, getLeagueRuleset, listShared, sourceDataFor,
  insertRuleset, updateRulesetData, setVisibility, deleteIfUnreferenced,
};
