// Stored show formats (db/migrations/0049, docs/PLAN-stage-3-format-proposals.md): drafts researched
// from a proposal, and approved formats a show can play by. Everything server-side that turns a format
// id into rules goes through resolveFormat here, so a stored format is found wherever a built-in one
// is; leagues get a cached copy of the data (setLeagueFormat) because the game logic can't read the
// database.
//
// Plain CommonJS (bare-node connectors and the Next routes both use it). `db` is a pool or a client.
const Formats = require("../src/lib/game/formats/index.js");
const P = require("../src/lib/game/formats/proposal.js");

/** An approved stored format's data half, or null (a built-in id, a draft, or no such format). */
async function formatDataFor(db, id) {
  if (!id || Formats.isBuiltInFormat(id)) return null;
  const { rows } = await db.query("SELECT data FROM show_formats WHERE id=$1 AND status='approved'", [id]);
  return rows.length ? rows[0].data : null;
}

/** The rules for format `id`, built-in or stored. A built-in never touches the database. */
async function resolveFormat(db, id) {
  return Formats.formatFor(id, await formatDataFor(db, id));
}

/** Whether `id` is something a show can play by: a built-in, or an approved stored format. */
async function isPlayableFormat(db, id) {
  if (typeof id !== "string" || !id) return false;
  return Formats.isBuiltInFormat(id) || !!(await formatDataFor(db, id));
}

/**
 * Every format a show can be switched to -- the built-ins, then approved stored ones -- with the terms
 * a new show on it defaults to, so a picker never has to resolve a stored format to label it.
 */
async function formatOptions(db) {
  const { rows } = await db.query("SELECT id, name, data->'terms' AS terms FROM show_formats WHERE status='approved' ORDER BY name");
  return [
    ...Formats.formatOptions().map((f) => ({ ...f, stored: false, terms: Formats.formatFor(f.id).terms })),
    ...rows.map((r) => ({ id: r.id, name: r.name, stored: true, terms: r.terms })),
  ];
}

/**
 * A league's cached format: the id always, and the data only for a stored format (a built-in's rules
 * are in the code, so a league on one carries nothing extra -- exactly what every league held before).
 */
function setLeagueFormat(settings, id, data) {
  settings.showFormat = id || null;
  if (id && data && !Formats.isBuiltInFormat(id)) settings.showFormatData = data;
  else delete settings.showFormatData;
}

/** Fills in a league's cached format for show `slug` (as a league's settings.showId names it). */
async function syncLeagueFormat(db, settings, slug) {
  const { rows } = await db.query("SELECT format FROM shows WHERE slug=$1", [slug]);
  const id = rows.length ? rows[0].format : null;
  setLeagueFormat(settings, id, await formatDataFor(db, id));
}

// ---------- drafts and approval ----------

const rowOut = (r) => ({
  id: r.id, name: r.name, status: r.status, version: r.version, proposal: r.proposal, data: r.data,
  createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at, approvedAt: r.approved_at,
});

async function listFormats(db) {
  const { rows } = await db.query(
    `SELECT f.id, f.name, f.status, f.version, f.created_at, f.updated_at, f.approved_at,
            (SELECT count(*)::int FROM shows s WHERE s.format = f.id) AS show_count
       FROM show_formats f ORDER BY f.updated_at DESC`
  );
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, version: r.version, showCount: r.show_count, createdAt: r.created_at, updatedAt: r.updated_at, approvedAt: r.approved_at }));
}

async function getFormat(db, id) {
  const { rows } = await db.query("SELECT * FROM show_formats WHERE id=$1", [id]);
  if (!rows.length) return null;
  const row = rowOut(rows[0]);
  return { ...row, review: P.reviewProposal(row.proposal, { id: row.id }) };
}

// A free id from the proposal's: never a built-in's, never one in use ("love-island", "love-island-2"...).
async function freeId(db, base) {
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    if (Formats.isBuiltInFormat(id)) continue;
    const { rows } = await db.query("SELECT 1 FROM show_formats WHERE id=$1", [id]);
    if (!rows.length) return id;
  }
}

/** A pasted chat answer -> a stored draft, with its review. Throws (with a reason) if it isn't JSON. */
async function createDraft(db, answer, userId) {
  const proposal = P.parseProposal(answer);
  const base = P.reviewProposal(proposal).id;
  const id = await freeId(db, base);
  const review = P.reviewProposal(proposal, { id });
  await db.query(
    "INSERT INTO show_formats (id, name, status, proposal, created_by) VALUES ($1, $2, 'draft', $3, $4)",
    [id, review.data.name, JSON.stringify(proposal), userId || null]
  );
  return getFormat(db, id);
}

/**
 * Saves edited rows. A draft just saves. An approved format must still be approvable, and its data and
 * version move on; the caller pushes the new data to the leagues on its shows (`leagueSlugs`).
 */
async function saveProposal(db, id, proposal, userId) {
  const current = await getFormat(db, id);
  if (!current) return null;
  const review = P.reviewProposal(proposal, { id });
  if (current.status === "approved") {
    if (!review.approvable) return { ...current, refused: review.problems, review };
    await db.query(
      "UPDATE show_formats SET proposal=$2, data=$3, name=$4, version=version+1, approved_by=$5, updated_at=now() WHERE id=$1",
      [id, JSON.stringify(proposal), JSON.stringify(review.data), review.data.name, userId || null]
    );
  } else {
    await db.query("UPDATE show_formats SET proposal=$2, name=$3, updated_at=now() WHERE id=$1", [id, JSON.stringify(proposal), review.data.name]);
  }
  return { ...(await getFormat(db, id)), leagueSlugs: current.status === "approved" ? await showSlugsUsing(db, id) : [] };
}

/** Approves a draft: re-derives it, refuses unless approvable, and stores its data. */
async function approveFormat(db, id, userId) {
  const current = await getFormat(db, id);
  if (!current) return null;
  if (current.status === "approved") return { ...current, alreadyApproved: true };
  if (!current.review.approvable) return { ...current, refused: current.review.problems };
  await db.query(
    "UPDATE show_formats SET status='approved', data=$2, approved_by=$3, approved_at=now(), updated_at=now() WHERE id=$1",
    [id, JSON.stringify(current.review.data), userId || null]
  );
  return getFormat(db, id);
}

/** Deletes a draft, or an approved format no show plays by. Returns why not, if not. */
async function deleteFormat(db, id) {
  const current = await getFormat(db, id);
  if (!current) return { notFound: true };
  const shows = await showSlugsUsing(db, id);
  if (shows.length) return { inUse: shows };
  await db.query("DELETE FROM show_formats WHERE id=$1", [id]);
  return { deleted: true };
}

async function showSlugsUsing(db, id) {
  const { rows } = await db.query("SELECT slug FROM shows WHERE format=$1", [id]);
  return rows.map((r) => r.slug);
}

/** A free show slug from `base` ("love-island", "love-island-2", ...), unlike the admin create-show
 * route this never refuses -- a casual self-serve user shouldn't hit a dead-end "rename it" error. */
async function freeShowSlug(db, base) {
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const { rows } = await db.query("SELECT 1 FROM shows WHERE slug=$1", [slug]);
    if (!rows.length) return slug;
  }
}

/** Creates a new show playing by an approved format's data, owned by `userId`. Used by the self-serve
 * /api/formats/:id/create-show route; the admin route keeps its own inline insert (it also supports
 * switching an EXISTING show to the format, which this never does). */
async function createShowForFormat(db, data, { userId, domains } = {}) {
  const slug = await freeShowSlug(db, data.id.slice(0, 40));
  const { rows } = await db.query(
    `INSERT INTO shows (slug, name, castaway_term, tribe_term, format, research_domains, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, slug, name`,
    [slug, data.name, data.terms.castaway, data.terms.tribe, data.id, domains?.length ? domains : null, userId || null]
  );
  return rows[0];
}

module.exports = {
  formatDataFor, resolveFormat, isPlayableFormat, formatOptions, setLeagueFormat, syncLeagueFormat,
  listFormats, getFormat, createDraft, saveProposal, approveFormat, deleteFormat, showSlugsUsing,
  createShowForFormat,
};
