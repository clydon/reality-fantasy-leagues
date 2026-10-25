// Rulebooks (db/migrations/0107, docs/PLAN-rulebooks-implementation.md 5.3-5.4, docs/PLAN-new-design.md step R3):
// the library's templates and researched rulebooks, each season's rulebook, and a league's own copy, with what
// they compile to. Nothing here changes how anything scores while the rulebooks flag is off (the default).
//
// THE FLAG (app_settings 'rulebooks', true or false; decision 9). On, the server writes each league's rules into
// its state as settings.rulebook = { id, version, data, reader } (syncLeagueRulebook), which StateLogic.formatOf
// reads ahead of everything else, and a season's research reads its rulebook (seasonRulebookFormat). Off, it
// takes settings.rulebook out again, and every league is back on showFormat / leagueRulesetData, which are
// never removed. scripts/rulebooks-flag.js flips it and walks every league.
//
// KEPT IN STEP WITH TODAY'S RULES. Until the editors (step 6b) make rulebooks the source, an unedited rulebook
// (compiled_source 'legacy') is a mirror of what it was made from: a template of a built-in's or a stored
// format's data, a season's of its show's format, a league's own of its league_rulesets copy. ensureTemplate,
// ensureSeasonRulebook and ensureLeagueRulebook make one if it's missing and bring a legacy one up to date when
// its source moved (a stored format re-approved, a show switched format, a commissioner's copy edited), with a
// version bump; one saved from blocks is never touched. The backfill (db/backfill-rulebooks.js) is these, run
// over everything; with the flag on, every write path that changes a league's rules runs them again.
//
// AND CHECKED, NOT TRUSTED. syncLeagueRulebook writes a legacy rulebook into a league only when its data and
// reader are exactly what the league plays by today (legacyBase: the same choice formatOf makes without one),
// so with the flag on a league can't score differently until someone edits its rules; anything else is
// reported as a mismatch and the league stays on the old path. Season rule changes are untouched: formatOf
// still layers a league's adopted ones on top, and season_rule_changes stays what research applies until
// phase 5's rulebook-patch.js applies rulebook_edits.
//
// Plain CommonJS (bare-node scripts and the Next routes both use it). `db` is a pool or a client.
const Formats = require("../src/lib/game/formats/index.js");
const { rulebookFor } = require("../src/lib/game/formats/blocks/index.js");
const { blocksFromFormat } = require("../src/lib/game/formats/rulebook-from-format.js");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { applyOps, mergeAtEpisode } = require("../src/lib/game/formats/rulebook-patch.js");
const { blocksProblems, kindOf } = require("../src/lib/game/formats/rulebook-schema.js");
const { formatProblems } = require("../src/lib/game/formats/define.js");
const ShowFormats = require("./show-formats.js");

// ---------- the flag ----------

const FLAG = "rulebooks";

/** Whether the rulebooks flag is on. Read every time (one small row), so a flip is seen at once everywhere. */
async function rulebooksOn(db) {
  const { rows } = await db.query("SELECT value FROM app_settings WHERE key=$1", [FLAG]);
  return rows.length > 0 && rows[0].value === true;
}

/**
 * Whether a season's leagues play by its rulebook: the flag (every season), or the season's own switch (0113's
 * show_seasons.rulebook_live: a season can go first, step 6b part 2's desk).
 */
async function seasonLive(db, seasonId) {
  if (await rulebooksOn(db)) return true;
  if (!seasonId) return false;
  const { rows } = await db.query("SELECT rulebook_live FROM show_seasons WHERE id=$1", [seasonId]);
  return !!(rows[0] && rows[0].rulebook_live);
}

async function setRulebooksOn(db, on) {
  await db.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()`,
    [FLAG, JSON.stringify(!!on)]
  );
}

// ---------- comparing format data ----------

// jsonb keeps an object's keys in its own order, so two copies of the same data compare by content.
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (!v || typeof v !== "object") return v;
  const out = {};
  for (const k of Object.keys(v).sort()) if (v[k] !== undefined) out[k] = canonical(v[k]);
  return out;
}
/** Whether two FormatData (or any JSON) say the same thing, whatever their key order. */
function sameData(a, b) {
  return JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
}

const builtInIdOf = (format) => Object.keys(Formats.FORMATS).find((id) => Formats.FORMATS[id] === format) || null;
/** The reader a runtime format stands for: a built-in family's code half, or a data-only one. */
const readerOf = (format) => (Formats.BUILT_IN_READERS.includes(builtInIdOf(format)) ? builtInIdOf(format) : "research");

/**
 * What a league plays by with no rulebook, as { data, reader }: its own ruleset copy, else its show's format
 * (formatFor, Survivor when it has none) -- formatOf's own choice, without settings.rulebook or adopted changes.
 */
function legacyBase(settings) {
  const s = settings || {};
  if (s.leagueRulesetData) return { data: s.leagueRulesetData, reader: "league" };
  const format = Formats.formatFor(s.showFormat || null, s.showFormatData || null);
  return { data: format.data, reader: readerOf(format) };
}

// ---------- rows ----------

const rowOut = (r) =>
  r && {
    id: r.id, name: r.name, kind: r.kind, ownerKind: r.owner_kind, seasonId: r.season_id, leagueId: r.league_id,
    isTemplate: r.is_template, status: r.status, parentKind: r.parent_kind, parentId: r.parent_id, parentVersion: r.parent_version,
    reader: r.reader, blocks: r.blocks, compiled: r.compiled, compiledSource: r.compiled_source, base: r.base,
    aliases: r.aliases, phaseStarts: r.phase_starts, provenance: r.provenance, version: r.version,
    visibility: r.visibility, reviewStatus: r.review_status, createdBy: r.created_by, approvedBy: r.approved_by,
    approvedAt: r.approved_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };

const one = async (db, sql, params) => (await db.query(sql, params)).rows[0] || null;
const json = (v) => (v == null ? null : JSON.stringify(v));

// Every column a caller may set, and how it's stored.
const COLUMNS = {
  name: "name", kind: "kind", ownerKind: "owner_kind", seasonId: "season_id", leagueId: "league_id", isTemplate: "is_template",
  status: "status", parentKind: "parent_kind", parentId: "parent_id", parentVersion: "parent_version", reader: "reader",
  blocks: "blocks", compiled: "compiled", compiledSource: "compiled_source", base: "base", aliases: "aliases",
  phaseStarts: "phase_starts", provenance: "provenance", visibility: "visibility", reviewStatus: "review_status",
  createdBy: "created_by", approvedBy: "approved_by", approvedAt: "approved_at",
};
const JSON_COLUMNS = new Set(["blocks", "compiled", "base", "aliases", "phase_starts", "provenance"]);
const valueFor = (column, v) => (JSON_COLUMNS.has(column) ? json(v) : v ?? null);

function insertParts(fields) {
  const cols = Object.keys(fields).filter((k) => fields[k] !== undefined).map((k) => COLUMNS[k]);
  const values = Object.keys(fields).filter((k) => fields[k] !== undefined).map((k) => valueFor(COLUMNS[k], fields[k]));
  return { cols: cols.join(", "), marks: values.map((_, i) => `$${i + 1}`).join(", "), values };
}

/** Inserts a rulebook; with `onConflict` (an index's conflict target) a row that already exists is left alone and null comes back. */
async function insertRulebook(db, fields, { onConflict } = {}) {
  const { cols, marks, values } = insertParts(fields);
  const tail = onConflict ? `ON CONFLICT ${onConflict} DO NOTHING` : "";
  return rowOut(await one(db, `INSERT INTO rulebooks (${cols}) VALUES (${marks}) ${tail} RETURNING *`, values));
}

/** Updates the given fields; `bump` moves the version on (what leagues compare to know they're behind). */
async function updateRulebook(db, id, fields, { bump = false } = {}) {
  const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);
  const sets = keys.map((k, i) => `${COLUMNS[k]}=$${i + 2}`);
  if (bump) sets.push("version=version+1");
  sets.push("updated_at=now()");
  const values = keys.map((k) => valueFor(COLUMNS[k], fields[k]));
  return rowOut(await one(db, `UPDATE rulebooks SET ${sets.join(", ")} WHERE id=$1 RETURNING *`, [id, ...values]));
}

async function getRulebook(db, id) {
  return rowOut(await one(db, "SELECT * FROM rulebooks WHERE id=$1", [id]));
}

/** The library: templates, research drafts and anything copied there, without their (large) blocks and data. */
async function listLibrary(db, { templatesOnly = false } = {}) {
  const { rows } = await db.query(
    `SELECT id, name, kind, is_template, status, parent_kind, parent_id, reader, version, review_status, compiled_source, updated_at
       FROM rulebooks WHERE owner_kind='library' AND status <> 'archived' AND ($1::boolean IS FALSE OR is_template)
      ORDER BY is_template DESC, name`,
    [templatesOnly]
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, kind: r.kind, isTemplate: r.is_template, status: r.status, parentKind: r.parent_kind, parentId: r.parent_id,
    reader: r.reader, version: r.version, reviewStatus: r.review_status, compiledSource: r.compiled_source, updatedAt: r.updated_at,
  }));
}

/** The season's live rulebook, or null. */
async function seasonRulebook(db, seasonId) {
  return rowOut(await one(db, "SELECT * FROM rulebooks WHERE owner_kind='season' AND season_id=$1 AND status <> 'archived'", [seasonId]));
}

/** show_seasons.id for a league's show and season (settings.showId, settings.wikiSeason), or null. */
async function seasonIdOf(db, settings) {
  const s = settings || {};
  if (!s.showId || s.wikiSeason == null || s.wikiSeason === "") return null;
  const r = await one(
    db,
    "SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug=$1 AND ss.season_number::text=$2",
    [s.showId, String(s.wikiSeason)]
  );
  return r ? r.id : null;
}

/** The rulebook a league plays by, as stored: its own copy, else its season's, else null. Reads only. */
async function rulebookForLeague(db, { leagueId, settings }) {
  if (leagueId) {
    const own = await one(db, "SELECT r.* FROM rulebooks r JOIN leagues l ON l.rulebook_id = r.id WHERE l.id=$1 AND r.status <> 'archived'", [leagueId]);
    if (own) return rowOut(own);
  }
  const seasonId = await seasonIdOf(db, settings);
  return seasonId ? seasonRulebook(db, seasonId) : null;
}

// ---------- making and editing ----------

/** A new rulebook from `fields` (see COLUMNS); a draft from blocks unless it says otherwise. */
async function createRulebook(db, fields) {
  return insertRulebook(db, { status: "draft", compiledSource: "blocks", aliases: {}, phaseStarts: {}, provenance: {}, ...fields });
}

/** A copy of rulebook `fromId` for a season, a league or the library, its parent the original at its version now. */
async function copyRulebook(db, fromId, { ownerKind, seasonId = null, leagueId = null, userId = null, name, status } = {}) {
  const from = await getRulebook(db, fromId);
  if (!from) return null;
  const copy = await insertRulebook(db, {
    name: name || from.name, kind: from.kind, ownerKind, seasonId: ownerKind === "season" ? seasonId : null,
    leagueId: ownerKind === "league" ? leagueId : null, isTemplate: false, status: status || (ownerKind === "library" ? "draft" : "in_force"),
    parentKind: "rulebook", parentId: from.id, parentVersion: from.version, reader: from.reader, blocks: from.blocks,
    compiled: from.compiled, compiledSource: from.compiledSource, base: from.base, aliases: from.aliases, phaseStarts: from.phaseStarts,
    provenance: { from: "rulebook", id: from.id, version: from.version }, reviewStatus: from.reviewStatus, createdBy: userId,
  });
  if (ownerKind === "season") await db.query("UPDATE show_seasons SET rulebook_id=$1 WHERE id=$2", [copy.id, seasonId]);
  if (ownerKind === "league") await db.query("UPDATE leagues SET rulebook_id=$1 WHERE id=$2", [copy.id, leagueId]);
  return copy;
}

// What a rulebook compiles to from its blocks: on its base (the legacy freeze), with its own aliases, reader and phase starts.
function compileRow(row, blocks, phaseStarts) {
  return compileRulebook(blocks, {
    aliases: row.aliases || {}, reader: row.reader, base: row.base || null, phaseStarts: phaseStarts || {},
    ...(row.base ? {} : row.compiled && row.compiled.id ? { id: row.compiled.id } : {}),
  });
}

/**
 * Saves edited blocks: refused (with located problems) unless they're a usable rulebook that compiles clean.
 * Compiles on the rulebook's base, never on its previous compile, switches it to 'blocks' and moves the version
 * on. The caller pushes the new version to the leagues using it (phase 5's push; today nothing edits).
 */
async function saveBlocks(db, id, blocks, userId) {
  const row = await getRulebook(db, id);
  if (!row) return null;
  const problems = blocksProblems(blocks);
  if (problems.length) return { refused: problems };
  const { data, problems: compileProblems, warnings } = compileRow(row, blocks, row.phaseStarts);
  if (compileProblems.length) return { refused: compileProblems.map((message) => ({ at: "compiled", message })) };
  const rulebook = await updateRulebook(
    db,
    id,
    { blocks, compiled: data, compiledSource: "blocks", kind: kindOf(blocks), provenance: { ...row.provenance, editedAt: new Date().toISOString(), editedBy: userId || null } },
    { bump: true }
  );
  return { rulebook, warnings };
}

/**
 * Records when a phase began (decision 5: season data a person confirms), or clears it with `episode` null. A
 * rulebook compiled from blocks is recompiled, since its phase-limited segments start scoring from there; a
 * legacy one keeps its frozen data, and the start is kept for its first compile.
 */
async function setPhaseStart(db, id, phaseId, episode) {
  const row = await getRulebook(db, id);
  if (!row) return null;
  const phases = (row.blocks && row.blocks.season && row.blocks.season.phases) || [];
  if (!phases.some((p) => p.id === phaseId)) return { refused: [{ at: "season.phases", message: `There's no phase "${phaseId}"` }] };
  if (episode != null && !(Number.isInteger(episode) && episode >= 1)) return { refused: [{ at: `season.phases[${phaseId}]`, message: "The episode is a whole number from 1" }] };
  const phaseStarts = { ...row.phaseStarts };
  if (episode == null) delete phaseStarts[phaseId];
  else phaseStarts[phaseId] = episode;
  if (row.compiledSource !== "blocks") return { rulebook: await updateRulebook(db, id, { phaseStarts }) };
  const { data, problems } = compileRow(row, row.blocks, phaseStarts);
  if (problems.length) return { refused: problems.map((message) => ({ at: "compiled", message })) };
  return { rulebook: await updateRulebook(db, id, { phaseStarts, compiled: data }, { bump: true }) };
}

// ---------- edits (step 6b part 2: rulebook-patch.js) ----------

/** A rulebook's in-force "show changed" edits, in the order they start: [{ id, fromEpisode, ops, ... }]. Ones migrated
 *  from season_rule_changes aren't in it: leagues still layer those as adopted changes (formatOf). */
async function inForceEdits(db, id) {
  const { rows } = await db.query(
    `SELECT id, kind, from_episode, ops, summary, source, created_by, approved_at, created_at FROM rulebook_edits
      WHERE rulebook_id=$1 AND status='in_force' AND kind='show_changed' AND source <> 'migration'
      ORDER BY from_episode, approved_at NULLS LAST, created_at`,
    [id]
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind, fromEpisode: r.from_episode, ops: r.ops || [], summary: r.summary, source: r.source, createdBy: r.created_by, at: r.approved_at || r.created_at }));
}

/**
 * What a rulebook compiles to with its edits: its base blocks on its base (the legacy freeze), then each edit's ops on
 * the blocks, compiled, and merged in from its episode (mergeAtEpisode), so episodes before it keep their rules.
 * -> { data, problems, warnings }; problems name the edit they came from.
 */
function compileChain(row, blocks, edits, phaseStarts) {
  const first = compileRow(row, blocks, phaseStarts);
  if (first.problems.length) return first;
  const warnings = [...first.warnings];
  let data = first.data;
  let b = blocks;
  for (const e of edits) {
    b = applyOps(b, e.ops);
    const next = compileRow(row, b, phaseStarts);
    if (next.problems.length) return { data: null, problems: next.problems.map((p) => `From episode ${e.fromEpisode}: ${p}`), warnings };
    warnings.push(...next.warnings.map((w) => `From episode ${e.fromEpisode}: ${w}`));
    data = mergeAtEpisode(data, next.data, e.fromEpisode);
  }
  const p = formatProblems(data);
  return p.length ? { data: null, problems: p, warnings } : { data, problems: [], warnings };
}

/**
 * Saves a rulebook's base blocks (a fix: it was always like this) and/or its edits, compiling the chain. Refused with
 * located problems unless the base is a usable rulebook and every version compiles clean. Switches it to 'blocks', moves
 * the version on. `phaseStarts` too when given. -> { rulebook, warnings } | { refused } | null.
 */
async function saveChain(db, id, { blocks, phaseStarts, userId } = {}) {
  const row = await getRulebook(db, id);
  if (!row) return null;
  const base = blocks || row.blocks;
  const problems = blocksProblems(base);
  if (problems.length) return { refused: problems };
  const edits = await inForceEdits(db, id);
  for (const e of edits) {
    const p = blocksProblems(applyOps(base, edits.filter((x) => x.fromEpisode <= e.fromEpisode).reduce((acc, x) => acc.concat(x.ops), [])));
    if (p.length) return { refused: p.map((x) => ({ ...x, message: `From episode ${e.fromEpisode}: ${x.message}` })) };
  }
  const starts = phaseStarts || row.phaseStarts || {};
  const { data, problems: compileProblems, warnings } = compileChain(row, base, edits, starts);
  if (compileProblems.length) return { refused: compileProblems.map((message) => ({ at: "compiled", message })) };
  const rulebook = await updateRulebook(
    db,
    id,
    {
      blocks: base, compiled: data, compiledSource: "blocks", kind: kindOf(base), phaseStarts: starts,
      provenance: { ...row.provenance, editedAt: new Date().toISOString(), editedBy: userId || null },
    },
    { bump: true }
  );
  return { rulebook, warnings };
}

// ---------- who uses it ----------

/**
 * The leagues playing by rulebook `id`: for a season's, the leagues on that season that follow it (no own copy)
 * and the own copies made from it; for a league's own, that league. [{ id, name, slug }] each.
 */
async function leaguesUsing(db, id) {
  const row = await one(db, "SELECT id, owner_kind, season_id, league_id FROM rulebooks WHERE id=$1", [id]);
  if (!row) return null;
  const pick = "SELECT l.id, l.name, l.slug FROM leagues l";
  if (row.owner_kind === "league") {
    // Its own league, and any other game of the couch that shares it (Make it ours).
    const { rows } = await db.query(`${pick} WHERE l.id=$1 OR l.rulebook_id=$2 ORDER BY l.name`, [row.league_id, id]);
    return { following: [], ownCopies: rows };
  }
  let following = [];
  if (row.owner_kind === "season") {
    ({ rows: following } = await db.query(
      `${pick} JOIN show_seasons ss ON ss.id=$1 JOIN shows s ON s.id = ss.show_id
        WHERE l.state->'settings'->>'showId' = s.slug AND l.state->'settings'->>'wikiSeason' = ss.season_number::text
          AND l.rulebook_id IS NULL ORDER BY l.name`,
      [row.season_id]
    ));
  }
  const { rows: ownCopies } = await db.query(
    `${pick} JOIN rulebooks r ON r.id = l.rulebook_id
      WHERE r.owner_kind='league' AND r.parent_kind='rulebook' AND r.parent_id=$1 AND r.status <> 'archived' ORDER BY l.name`,
    [String(id)]
  );
  return { following, ownCopies };
}

/**
 * Where a rulebook comes from and what's made from it: `parents` from the nearest up (each { id, name, ownerKind,
 * version }), `origin` the first one's own source (a built-in, a stored format, a library entry), and counts of the
 * seasons and own copies made from it and the leagues following it.
 */
async function lineage(db, id) {
  const row = await getRulebook(db, id);
  if (!row) return null;
  const parents = [];
  let at = row;
  for (let i = 0; i < 10 && at.parentKind === "rulebook" && at.parentId; i++) {
    at = await getRulebook(db, at.parentId);
    if (!at) break;
    parents.push({ id: at.id, name: at.name, ownerKind: at.ownerKind, version: at.version });
  }
  const origin = at && at.parentKind !== "rulebook" && at.parentKind !== "none" ? { kind: at.parentKind, id: at.parentId } : null;
  const { rows } = await db.query(
    `SELECT owner_kind, count(*)::int AS n FROM rulebooks WHERE parent_kind='rulebook' AND parent_id=$1 AND status <> 'archived' GROUP BY owner_kind`,
    [String(id)]
  );
  const made = Object.fromEntries(rows.map((r) => [r.owner_kind, r.n]));
  const using = await leaguesUsing(db, id);
  return { parents, origin, seasons: made.season || 0, ownCopies: made.league || 0, following: using.following.length };
}

// ---------- what it compiles to ----------

// Compiled data by rulebook id and version: a version is never rewritten, so a hit is never stale.
const compiledCache = new Map();
const MAX_COMPILED = 50;

/**
 * Rulebook `id`'s compiled rules as { id, version, data, reader }, or null. Asks the database for the version
 * first and fetches the data only on a miss. The stored compile: phase 5 adds the plan's `throughEpisode`, when
 * a rulebook's in-force edits fold in (rulebook-patch.js).
 */
async function compiledFor(db, id) {
  const head = await one(db, "SELECT version, reader FROM rulebooks WHERE id=$1 AND compiled IS NOT NULL", [id]);
  if (!head) return null;
  const key = `${id}@${head.version}`;
  if (!compiledCache.has(key)) {
    const r = await one(db, "SELECT version, reader, compiled FROM rulebooks WHERE id=$1", [id]);
    compiledCache.set(key, { id, version: r.version, data: r.compiled, reader: r.reader });
    if (compiledCache.size > MAX_COMPILED) compiledCache.delete(compiledCache.keys().next().value);
  }
  return compiledCache.get(key);
}

/**
 * The runtime format a season's research reads from its rulebook, or null for today's path (db/season-rule-changes.js
 * seasonFormat): null with the flag off, with no season rulebook, and for an unedited one asked about a different
 * format than it was frozen from (answers asked under another format follow that one, as they always did). `on`
 * overrides the flag (a check).
 */
async function seasonRulebookFormat(db, seasonId, { formatId, on } = {}) {
  if (!seasonId || !(on === undefined ? await seasonLive(db, seasonId) : on)) return null;
  const head = await one(
    db,
    `SELECT r.id, r.compiled_source, r.compiled->>'id' AS data_id FROM rulebooks r JOIN show_seasons ss ON ss.rulebook_id = r.id
      WHERE ss.id=$1 AND r.compiled IS NOT NULL AND r.status <> 'archived'`,
    [seasonId]
  );
  if (!head || (head.compiled_source === "legacy" && head.data_id !== (formatId || null))) return null;
  const c = await compiledFor(db, head.id);
  return c ? Formats.formatForRulebook(c.data, c.reader) : null;
}

// ---------- kept in step with today's rules ----------

/**
 * The format show format id `formatId` plays by, as a legacy rulebook's source: { kind: 'builtin' | 'show_format',
 * id, data, version, fellBack }. Resolved exactly as leagues resolve it (a draft or missing stored format is
 * Survivor's, `fellBack` true).
 */
async function sourceFor(db, formatId) {
  const stored = await ShowFormats.formatDataFor(db, formatId);
  const format = Formats.formatFor(formatId, stored);
  const builtIn = builtInIdOf(format);
  if (builtIn) return { kind: "builtin", id: builtIn, data: format.data, version: null, fellBack: !!formatId && formatId !== builtIn };
  const r = await one(db, "SELECT version FROM show_formats WHERE id=$1", [formatId]);
  return { kind: "show_format", id: formatId, data: stored, version: r ? r.version : null, fellBack: false };
}

// A source's rulebook as columns: its blocks and aliases (a built-in's own, else read back from the data), its data
// as both compile and base.
function legacyFields(source) {
  const r = source.kind === "builtin" ? rulebookFor(source.id) : rulebookFor(source.id, source.data);
  return {
    name: source.data.name, kind: kindOf(r.blocks), reader: r.reader, blocks: r.blocks, aliases: r.aliases || {},
    compiled: source.data, base: source.data, compiledSource: "legacy",
    provenance: { from: source.kind, id: source.id, ...(source.version != null ? { version: source.version } : {}) },
  };
}

// A legacy row whose source said something else, or whose reader moved: refreshed, its version on. Anything saved
// from blocks is never touched.
const behind = (row, want) =>
  row.compiledSource === "legacy" && (!sameData(row.compiled, want.compiled) || row.reader !== want.reader || !sameData(row.provenance, want.provenance));

const LIBRARY_CONFLICT = "(parent_kind, parent_id) WHERE owner_kind = 'library' AND parent_kind IN ('builtin', 'show_format', 'library')";

/** The library's template for a source (sourceFor), made if missing and refreshed if its data moved: { row, change }. */
async function ensureTemplate(db, source) {
  const want = legacyFields(source);
  const find = () => one(db, "SELECT * FROM rulebooks WHERE owner_kind='library' AND parent_kind=$1 AND parent_id=$2", [source.kind, source.id]);
  let found = rowOut(await find());
  if (!found) {
    const made = await insertRulebook(
      db,
      { ...want, ownerKind: "library", isTemplate: true, status: "in_force", parentKind: source.kind, parentId: source.id, reviewStatus: "approved" },
      { onConflict: LIBRARY_CONFLICT }
    );
    if (made) return { row: made, change: "created" };
    found = rowOut(await find());
  }
  if (behind(found, want)) return { row: await updateRulebook(db, found.id, want, { bump: true }), change: "updated" };
  return { row: found, change: "unchanged" };
}

/**
 * A researched rulebook from src/lib/game/formats/library/ as a library draft, made if missing and refreshed from the
 * file (save-rulebook-library.js --recompile) until someone saves it from the editor (provenance.editedAt).
 */
async function ensureLibraryEntry(db, entry) {
  const want = {
    name: entry.show, kind: kindOf(entry.blocks), reader: "research", blocks: entry.blocks, aliases: {}, compiled: entry.compiled,
    compiledSource: "blocks", base: null, provenance: { from: "library", id: entry.id, researched: entry.researched, leftOut: entry.leftOut || [] },
  };
  const find = () => one(db, "SELECT * FROM rulebooks WHERE owner_kind='library' AND parent_kind='library' AND parent_id=$1", [entry.id]);
  let found = rowOut(await find());
  if (!found) {
    const made = await insertRulebook(
      db,
      { ...want, ownerKind: "library", isTemplate: false, status: "draft", parentKind: "library", parentId: entry.id, reviewStatus: "unreviewed" },
      { onConflict: LIBRARY_CONFLICT }
    );
    if (made) return { row: made, change: "created" };
    found = rowOut(await find());
  }
  const edited = found.provenance && found.provenance.editedAt;
  if (!edited && (!sameData(found.blocks, want.blocks) || !sameData(found.compiled, want.compiled) || !sameData(found.provenance, want.provenance))) {
    return { row: await updateRulebook(db, found.id, want, { bump: true }), change: "updated" };
  }
  return { row: found, change: "unchanged" };
}

/**
 * Phase starts the season's own data already confirms (decision 5): the phase the groups end in (Survivor's merge),
 * from its accepted results, but only on a clean switch -- every result from that episode on marked post-merge and
 * none before it. Real seasons mix the flag (a tribe immunity marked post-merge), and a wrong start would silently
 * rescore once the rulebook is compiled from blocks, so anything less stays unknown for a person to confirm. A
 * phase that starts at a set episode needs nothing.
 */
async function knownPhaseStarts(db, seasonId, blocks) {
  const phases = (blocks && blocks.season && blocks.season.phases) || [];
  const merge = phases.find((p) => !(p.starts && p.starts.type === "episode") && (p.changes || []).includes("groupsEnd"));
  if (!merge) return {};
  const { rows } = await db.query(
    `SELECT episode_number AS n, bool_and(post_merge) AS every, bool_or(post_merge) AS some FROM season_decisions
      WHERE season_id=$1 AND status='accepted' GROUP BY episode_number ORDER BY episode_number`,
    [seasonId]
  );
  const first = rows.findIndex((r) => r.some);
  if (first < 0 || !rows.slice(first).every((r) => r.every) || rows.slice(0, first).some((r) => r.some)) return {};
  return { [merge.id]: rows[first].n };
}

/**
 * The season's rulebook: made from its show's format's template if it has none, and while unedited kept equal to
 * that format (a show switched format, a stored format re-approved). Phase starts its results confirm are filled in
 * (without a version bump: a legacy compile doesn't read them). { row, change, source } or null for no such season.
 */
async function ensureSeasonRulebook(db, seasonId) {
  const info = await one(
    db,
    `SELECT ss.id, ss.season_number, ss.name, ss.rulebook_id, s.name AS show_name, s.format
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [seasonId]
  );
  if (!info) return null;
  const source = await sourceFor(db, info.format);
  const { row: template } = await ensureTemplate(db, source);
  const want = {
    ...legacyFields(source), name: info.name || `${info.show_name} ${info.season_number}`,
    parentKind: "rulebook", parentId: template.id, parentVersion: template.version,
  };
  const find = () => one(db, "SELECT * FROM rulebooks WHERE owner_kind='season' AND season_id=$1 AND status <> 'archived'", [seasonId]);
  let found = rowOut(await find());
  let row;
  let change = "unchanged";
  if (!found) {
    row = await insertRulebook(
      db,
      { ...want, ownerKind: "season", seasonId, status: "in_force", reviewStatus: "approved", phaseStarts: await knownPhaseStarts(db, seasonId, want.blocks) },
      { onConflict: "(season_id) WHERE owner_kind = 'season' AND status <> 'archived'" }
    );
    if (row) change = "created";
    else found = rowOut(await find());
  }
  if (!row && behind(found, want)) {
    row = await updateRulebook(db, found.id, want, { bump: true });
    change = "updated";
  }
  row = row || found;
  const starts = await knownPhaseStarts(db, seasonId, row.blocks);
  const missing = Object.keys(starts).filter((k) => row.phaseStarts[k] == null);
  if (missing.length) row = await updateRulebook(db, row.id, { phaseStarts: { ...row.phaseStarts, ...Object.fromEntries(missing.map((k) => [k, starts[k]])) } });
  if (info.rulebook_id !== row.id) await db.query("UPDATE show_seasons SET rulebook_id=$1 WHERE id=$2", [row.id, seasonId]);
  return { row, change, source };
}

/**
 * A league's own rulebook, mirroring its league_rulesets copy (settings.leagueRulesetData) while unedited: made when it
 * has a copy, refreshed when the copy changed, archived when it went back to its show's rules. Its parent is its
 * season's rulebook (`parent`) when it has one, else the ruleset it came from. One made from blocks (step 6b's Make it
 * ours) is left alone. { row, change }; row null when the league follows its season.
 */
async function ensureLeagueRulebook(db, leagueId, settings, { parent = null } = {}) {
  const data = settings && settings.leagueRulesetData;
  const league = await one(db, "SELECT ruleset_id, rulebook_id FROM leagues WHERE id=$1", [leagueId]);
  if (!league) return { row: null, change: "unchanged" };
  // A couch's own copy (Make it ours, step 6b part 3) is shared by its games: whichever one owns the row.
  const ours = await oursOf(db, leagueId);
  if (ours) return { row: ours, change: "unchanged" };
  const found = rowOut(await one(db, "SELECT * FROM rulebooks WHERE owner_kind='league' AND league_id=$1 AND status <> 'archived'", [leagueId]));
  const mirrored = found && found.compiledSource === "legacy" && found.provenance && found.provenance.from === "league_rulesets";
  if (!data) {
    if (!mirrored) return { row: found, change: "unchanged" };
    await updateRulebook(db, found.id, { status: "archived" });
    await db.query("UPDATE leagues SET rulebook_id=NULL WHERE id=$1 AND rulebook_id=$2", [leagueId, found.id]);
    return { row: null, change: "archived" };
  }
  if (found && !mirrored) return { row: found, change: "unchanged" };
  const ruleset = league.ruleset_id ? await one(db, "SELECT id, name, version FROM league_rulesets WHERE id=$1", [league.ruleset_id]) : null;
  const { blocks, aliases } = blocksFromFormat(data);
  const want = {
    name: (ruleset && ruleset.name) || data.name || "Our rules", kind: kindOf(blocks), reader: "league", blocks, aliases,
    compiled: data, base: data, compiledSource: "legacy",
    provenance: { from: "league_rulesets", id: ruleset ? ruleset.id : null, ...(ruleset ? { version: ruleset.version } : {}) },
    ...(parent
      ? { parentKind: "rulebook", parentId: parent.id, parentVersion: parent.version }
      : ruleset
        ? { parentKind: "league_ruleset", parentId: ruleset.id, parentVersion: ruleset.version }
        : { parentKind: "none", parentId: null, parentVersion: null }),
  };
  let row = found;
  let change = "unchanged";
  if (!found) {
    row = await insertRulebook(db, { ...want, ownerKind: "league", leagueId, status: "in_force" }, { onConflict: "(league_id) WHERE owner_kind = 'league' AND status <> 'archived'" });
    if (row) change = "created";
    else row = rowOut(await one(db, "SELECT * FROM rulebooks WHERE owner_kind='league' AND league_id=$1 AND status <> 'archived'", [leagueId]));
  } else if (behind(found, want) || found.parentId !== want.parentId) {
    row = await updateRulebook(db, found.id, want, { bump: behind(found, want) });
    change = "updated";
  }
  if (league.rulebook_id !== row.id) await db.query("UPDATE leagues SET rulebook_id=$1 WHERE id=$2", [row.id, leagueId]);
  return { row, change };
}

/**
 * The couch's own copy this league plays by (Make it ours: provenance.ours, owned by one of the couch's games and
 * pointed at by each), or null.
 */
async function oursOf(db, leagueId) {
  return rowOut(
    await one(
      db,
      `SELECT r.* FROM rulebooks r JOIN leagues l ON l.rulebook_id = r.id
        WHERE l.id=$1 AND r.owner_kind='league' AND r.status <> 'archived' AND r.provenance->>'ours' = 'true'`,
      [leagueId]
    )
  );
}

/**
 * Brings a league's settings.rulebook in step (`settings` is mutated), under the caller's lock on the league:
 * with the flag off (and its season's own switch off, and no own copy made by its couch), takes it out; on, writes { id, version, data, reader } from the league's own rulebook or its
 * season's, making or refreshing those first. A legacy rulebook is written only when it's exactly what the league
 * plays by without it (legacyBase); otherwise the league stays on the old path and the result says why.
 *
 * -> { written, removed?, id?, version?, source?: 'own' | 'season', reason?, mismatch? }
 */
async function syncLeagueRulebook(db, leagueId, settings, { on } = {}) {
  const seasonId = await seasonIdOf(db, settings);
  // A couch that made the rulebook its own plays by its copy whether or not its season's leagues are on rulebooks.
  const enabled = on === undefined ? (await seasonLive(db, seasonId)) || !!(await oursOf(db, leagueId)) : on;
  const had = !!settings.rulebook;
  const off = (extra) => {
    delete settings.rulebook;
    return { written: false, removed: had, ...extra };
  };
  if (!enabled) return off({});
  const season = seasonId ? await ensureSeasonRulebook(db, seasonId) : null;
  const own = await ensureLeagueRulebook(db, leagueId, settings, { parent: season && season.row });
  const row = own.row || (season && season.row);
  if (!row) return off({ reason: settings.showId ? "its season isn't in the catalog" : "no show picked" });
  if (!row.compiled) return off({ reason: "its rulebook has no compiled rules" });
  if (row.compiledSource === "legacy") {
    const today = legacyBase(settings);
    if (row.reader !== today.reader || !sameData(row.compiled, today.data)) {
      return off({ mismatch: `${row.name} (${row.reader}, ${row.compiled.id}) isn't what the league plays by (${today.reader}, ${today.data.id})` });
    }
  }
  settings.rulebook = { id: row.id, version: row.version, data: row.compiled, reader: row.reader };
  return { written: true, id: row.id, version: row.version, source: own.row ? "own" : "season" };
}

/**
 * syncLeagueRulebook for one league in its own transaction, under its row lock, saving its state only when
 * settings.rulebook changed. For a walk over every league (scripts/rulebooks-flag.js), which shouldn't run a
 * league's waivers or bots the way the app's withLeagueLock does. -> syncLeagueRulebook's result, plus `saved`.
 */
async function syncLeagueRow(pool, leagueId, { on } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await one(client, "SELECT state FROM leagues WHERE id=$1 FOR UPDATE", [leagueId]);
    if (!r) {
      await client.query("ROLLBACK");
      return null;
    }
    const state = r.state;
    const before = JSON.stringify(state.settings.rulebook ?? null);
    const result = await syncLeagueRulebook(client, leagueId, state.settings, { on });
    const saved = JSON.stringify(state.settings.rulebook ?? null) !== before;
    if (saved) await client.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(state), leagueId]);
    await client.query("COMMIT");
    return { ...result, saved };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Every season rulebook of show `slug` brought up to its format (after the show's format changed). */
async function refreshShowRulebooks(db, slug) {
  const { rows } = await db.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug=$1", [slug]);
  for (const r of rows) await ensureSeasonRulebook(db, r.id);
  return rows.length;
}

module.exports = {
  rulebooksOn, seasonLive, setRulebooksOn, sameData, legacyBase, readerOf, inForceEdits, compileChain, saveChain,
  getRulebook, listLibrary, seasonRulebook, seasonIdOf, rulebookForLeague, createRulebook, copyRulebook, saveBlocks, setPhaseStart,
  leaguesUsing, lineage, compiledFor, seasonRulebookFormat,
  sourceFor, ensureTemplate, ensureLibraryEntry, knownPhaseStarts, ensureSeasonRulebook, ensureLeagueRulebook,
  syncLeagueRulebook, syncLeagueRow, refreshShowRulebooks, oursOf,
};
