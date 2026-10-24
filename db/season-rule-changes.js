// Season rule changes (db/migrations/0053, docs/PLAN-season-rule-changes.md): checks an admin records
// for a season, and the approved changes the season's research and leagues play by.
//
// Two levels, kept apart on purpose:
//   the SEASON    -- research and the wiki read use the show's format plus every approved change in
//                    effect by the episode (seasonFormat). That's what makes research ask a new
//                    question and stage a new event type as a season decision.
//   each LEAGUE   -- is offered every approved change (settings.seasonRuleChanges) and scores only what
//                    its commissioner adopted (settings.adoptedRuleChanges). syncLeagueChanges below is
//                    what fills those in; src/lib/server/season-rule-changes.ts writes it.
//
// Plain CommonJS (bare-node connectors and the Next routes both use it). `db` is a pool or a client.
const Formats = require("../src/lib/game/formats/index.js");
const Check = require("../src/lib/game/formats/season-check.js");
const ShowFormats = require("./show-formats.js");
const Rulebooks = require("./rulebooks.js");

const asChange = (r) => ({
  id: r.id,
  version: r.version,
  effectiveEpisode: r.effective_episode,
  ...(r.summary ? { summary: r.summary } : {}),
  delta: r.delta,
});

/**
 * The season's approved changes, as leagues cache them: [{ id, version, effectiveEpisode, summary?,
 * delta }] in effect order. `throughEpisode` keeps those in effect by then; `excludeId` leaves one out
 * (the change being reviewed, so it's checked against everything else).
 */
async function approvedChanges(db, seasonId, { throughEpisode = null, excludeId = null } = {}) {
  if (!seasonId) return [];
  const { rows } = await db.query(
    `SELECT id, version, effective_episode, summary, delta FROM season_rule_changes
      WHERE season_id=$1 AND status='approved'
        AND ($2::int IS NULL OR effective_episode <= $2) AND ($3::uuid IS NULL OR id <> $3)
      ORDER BY effective_episode, approved_at, id`,
    [seasonId, throughEpisode, excludeId]
  );
  return rows.map(asChange);
}

/** show_seasons.id for (show slug, season number), or null -- how a league names its season. */
async function seasonIdFor(db, showSlug, seasonNumber) {
  if (!showSlug || seasonNumber == null || seasonNumber === "") return null;
  const { rows } = await db.query(
    "SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug=$1 AND ss.season_number::text=$2",
    [showSlug, String(seasonNumber)]
  );
  return rows.length ? rows[0].id : null;
}

async function seasonInfo(db, seasonId) {
  const { rows } = await db.query(
    `SELECT ss.id, ss.season_number, ss.name AS season_name, ss.wiki_url, s.slug, s.name AS show_name, s.format
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id=$1`,
    [seasonId]
  );
  return rows[0] || null;
}

/**
 * The rules the season plays by at `episode` (every approved change when none is given): the show's
 * format, or `formatId` when the caller knows which one the answers were asked under, plus its
 * approved changes. A change that no longer fits the format (the show was switched since) is left out
 * rather than breaking research -- the review screen is where that gets noticed.
 *
 * With the rulebooks flag on, the season's rulebook stands in for the show's format (db/rulebooks.js
 * seasonRulebookFormat: an unedited one only for the format it was frozen from, so it's the same rules).
 */
async function seasonFormat(db, seasonId, { formatId, episode = null, excludeId = null } = {}) {
  const info = formatId === undefined ? await seasonInfo(db, seasonId) : null;
  const id = formatId === undefined ? info && info.format : formatId;
  const base = (await Rulebooks.seasonRulebookFormat(db, seasonId, { formatId: id })) || (await ShowFormats.resolveFormat(db, id));
  const changes = await approvedChanges(db, seasonId, { throughEpisode: episode, excludeId });
  try {
    return Formats.withChanges(base, changes);
  } catch (e) {
    console.log(`[rule-changes] season ${seasonId}: changes not applied (${e.message})`);
    return base;
  }
}

// ---------- the check ----------

// The last episode this season has anything for: staged results or research.
async function airedThrough(db, seasonId) {
  const { rows } = await db.query(
    `SELECT greatest(
        (SELECT max(episode_number) FROM season_decisions WHERE season_id=$1),
        (SELECT max(er.episode_number) FROM episode_research er JOIN show_seasons ss
            ON er.show_id = ss.show_id AND er.season_number = ss.season_number WHERE ss.id=$1)
      ) AS n`,
    [seasonId]
  );
  return rows[0] && rows[0].n != null ? Number(rows[0].n) : null;
}

/** Research's own "something new happened" notes for the season (db/episode-research.js rulesNote),
 * newer than the last recorded check. */
async function researchFlags(db, seasonId) {
  const { rows } = await db.query(
    `SELECT er.episode_number, er.payload->>'rulesNote' AS note
       FROM episode_research er JOIN show_seasons ss ON er.show_id = ss.show_id AND er.season_number = ss.season_number
      WHERE ss.id=$1 AND coalesce(er.payload->>'rulesNote', '') <> ''
        AND er.episode_number > coalesce((SELECT max(checked_through) FROM season_rule_changes
                                           WHERE season_id=$1 AND status IN ('approved', 'no_change')), 0)
      ORDER BY er.episode_number`,
    [seasonId]
  );
  return rows.map((r) => ({ episode: r.episode_number, note: r.note }));
}

/** The prompt an admin copies into a web-searching chat. */
async function checkPrompt(db, seasonId) {
  const info = await seasonInfo(db, seasonId);
  if (!info) return null;
  const format = await seasonFormat(db, seasonId);
  return Check.buildCheckPrompt({
    showName: info.show_name,
    seasonLabel: info.season_name || `season ${info.season_number}`,
    wikiUrl: info.wiki_url,
    data: format.data,
    airedThrough: await airedThrough(db, seasonId),
    approved: await approvedChanges(db, seasonId),
    flags: await researchFlags(db, seasonId),
  });
}

// ---------- recorded checks ----------

const rowOut = (r) => ({
  id: r.id, seasonId: r.season_id, status: r.status, effectiveEpisode: r.effective_episode, checkedThrough: r.checked_through,
  summary: r.summary, proposal: r.proposal, delta: r.delta, baseFormat: r.base_format, baseVersion: r.base_version, version: r.version,
  createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at, approvedAt: r.approved_at,
});

// The review of a change against the season's rules without it -- and those rules, which the review
// screen re-runs reviewCheck against live as the admin edits (the same review, client-side).
async function reviewOf(db, row) {
  const base = await seasonFormat(db, row.season_id, { excludeId: row.id });
  return { review: Check.reviewCheck(row.proposal, base.data, { effectiveEpisode: row.effective_episode }), baseData: base.data };
}

/** Every recorded check for a season, newest first (no reviews: the list only needs the status). */
async function listChanges(db, seasonId) {
  const { rows } = await db.query("SELECT * FROM season_rule_changes WHERE season_id=$1 ORDER BY created_at DESC", [seasonId]);
  return rows.map(rowOut);
}

/** One check, with its review and the season's rules it was reviewed against (`baseData`). */
async function getChange(db, id) {
  const { rows } = await db.query("SELECT * FROM season_rule_changes WHERE id=$1", [id]);
  if (!rows.length) return null;
  return { ...rowOut(rows[0]), ...(await reviewOf(db, rows[0])) };
}

async function baseVersionOf(db, formatId) {
  if (!formatId || Formats.isBuiltInFormat(formatId)) return null;
  const { rows } = await db.query("SELECT version FROM show_formats WHERE id=$1", [formatId]);
  return rows.length ? rows[0].version : null;
}

/**
 * A pasted check answer -> a recorded check. "Nothing changed" is recorded straight away as
 * no_change (there's nothing to review); anything else is a draft. Throws (with a reason) if the
 * paste isn't JSON.
 */
async function recordCheck(db, seasonId, answer, userId) {
  const info = await seasonInfo(db, seasonId);
  if (!info) return null;
  const proposal = Check.parseCheck(answer);
  const base = await seasonFormat(db, seasonId);
  const review = Check.reviewCheck(proposal, base.data);
  const { rows } = await db.query(
    `INSERT INTO season_rule_changes (season_id, status, effective_episode, checked_through, summary, proposal, base_format, base_version, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      seasonId, review.changed ? "draft" : "no_change", review.changed ? review.effectiveEpisode : null, review.checkedThrough,
      review.summary || null, JSON.stringify(proposal), info.format || null, await baseVersionOf(db, info.format), userId || null,
    ]
  );
  return getChange(db, rows[0].id);
}

/**
 * Saves the review screen's edits (the answer's rows, and the effective episode). A draft just saves.
 * An approved change must stay approvable; its delta and version move on, and the caller pushes it to
 * the season's leagues (`pushSeason`). Leagues that adopted it keep their frozen copy until their
 * commissioner reviews the new version.
 */
async function saveChange(db, id, proposal, { effectiveEpisode } = {}, userId) {
  const { rows } = await db.query("SELECT * FROM season_rule_changes WHERE id=$1", [id]);
  if (!rows.length) return null;
  const row = rows[0];
  if (!["draft", "approved"].includes(row.status)) return { ...rowOut(row), refusedStatus: row.status };
  const next = { ...row, proposal, effective_episode: effectiveEpisode ?? row.effective_episode };
  const { review } = await reviewOf(db, next);
  const ep = review.effectiveEpisode;
  if (row.status === "approved") {
    if (!review.approvable) return { ...rowOut(row), review, refused: review.problems };
    await db.query(
      `UPDATE season_rule_changes SET proposal=$2, delta=$3, effective_episode=$4, summary=$5, version=version+1,
              approved_by=$6, updated_at=now() WHERE id=$1`,
      [id, JSON.stringify(proposal), JSON.stringify(review.delta), ep, review.summary || null, userId || null]
    );
  } else {
    await db.query(
      "UPDATE season_rule_changes SET proposal=$2, effective_episode=$3, summary=$4, checked_through=$5, updated_at=now() WHERE id=$1",
      [id, JSON.stringify(proposal), ep, review.summary || null, review.checkedThrough]
    );
  }
  return { ...(await getChange(db, id)), pushSeason: row.status === "approved" ? row.season_id : null };
}

/** Approves a draft: re-derives it, refuses unless approvable, and stores its delta. */
async function approveChange(db, id, userId) {
  const current = await getChange(db, id);
  if (!current) return null;
  if (current.status === "approved") return { ...current, alreadyApproved: true };
  if (current.status !== "draft") return { ...current, refusedStatus: current.status };
  if (!current.review.approvable) return { ...current, refused: current.review.problems };
  await db.query(
    `UPDATE season_rule_changes SET status='approved', delta=$2, effective_episode=$3, summary=$4,
            approved_by=$5, approved_at=now(), updated_at=now() WHERE id=$1`,
    [id, JSON.stringify(current.review.delta), current.review.effectiveEpisode, current.review.summary || null, userId || null]
  );
  return { ...(await getChange(db, id)), pushSeason: current.seasonId };
}

/** Takes an approved change back. Research stops asking its questions; leagues that adopted it keep
 * their copy until their commissioner removes it (it's never pulled out from under a league). */
async function withdrawChange(db, id) {
  const { rows } = await db.query(
    "UPDATE season_rule_changes SET status='withdrawn', updated_at=now() WHERE id=$1 AND status='approved' RETURNING season_id",
    [id]
  );
  return rows.length ? { withdrawn: true, pushSeason: rows[0].season_id } : { withdrawn: false };
}

/** Deletes a draft or a no_change record. An approved change is withdrawn instead, never deleted. */
async function deleteChange(db, id) {
  const { rows } = await db.query("SELECT status FROM season_rule_changes WHERE id=$1", [id]);
  if (!rows.length) return { notFound: true };
  if (!["draft", "no_change"].includes(rows[0].status)) return { refusedStatus: rows[0].status };
  await db.query("DELETE FROM season_rule_changes WHERE id=$1", [id]);
  return { deleted: true };
}

// ---------- what a league caches ----------

/**
 * Brings a league's cached changes in step with its season (`settings` is mutated): it's offered every
 * approved change. `adoptAll` is for a league that has just picked this season -- it starts playing
 * the season as it now stands, so everything approved is adopted (decided 2026-10-06: a league that's
 * already running decides for itself; one that isn't yet gets the season's rules). Otherwise what it
 * adopted is never touched here.
 */
async function syncLeagueChanges(db, settings, { adoptAll = false } = {}) {
  const seasonId = await seasonIdFor(db, settings.showId, settings.wikiSeason);
  const changes = await approvedChanges(db, seasonId);
  if (changes.length) settings.seasonRuleChanges = changes;
  else delete settings.seasonRuleChanges;
  if (adoptAll) {
    if (changes.length) settings.adoptedRuleChanges = changes;
    else delete settings.adoptedRuleChanges;
  }
  return { seasonId, offered: changes.length };
}

module.exports = {
  approvedChanges, seasonIdFor, seasonInfo, seasonFormat, checkPrompt, airedThrough, researchFlags,
  listChanges, getChange, recordCheck, saveChange, approveChange, withdrawChange, deleteChange, syncLeagueChanges,
};
