// Dev-only check (docs/PLAN-new-design.md step R3, plan T-30 and T-36): with the rulebooks flag on, every zt league
// scores exactly as with it off, and turning it off puts every league back as it was. Real SQL on the local database
// through the functions the app and scripts/rulebooks-flag.js use; never flips the real flag (each sync is told `on`).
//
//   node scripts/dev-test/check-rulebook-flag.js run    up, the checks, down; prints PASS/FAIL per check
//   node scripts/dev-test/check-rulebook-flag.js up     just rulebook-fixture.js's leagues, to look at by hand
//   node scripts/dev-test/check-rulebook-flag.js down
//
// What it checks, on rulebook-fixture.js's leagues (built-ins of all three types, a stored format, an own copy, an
// adopted season change, a league from before formats, a stale cache, a season that isn't in the catalog):
//   the backfill makes each zt season's rulebook as its format, and the season change as an edit;
//   the flag on writes settings.rulebook from the right rulebook, and every league scores the same (standings, each
//   episode's events and points, the season's end, the catalog); the stale and catalog-less leagues stay on the old
//   path; a season's research reads its rulebook as the same format; the comparison catches a wrong rulebook;
//   a stored format re-approved, an own copy edited and abandoned keep rulebooks and leagues in step (and a league
//   whose cache didn't follow is refused, not mis-scored);
//   saved from unedited blocks, a rulebook compiles on its base and still scores the same, and a real edit plays;
//   phase starts, lineage, leagues using, a copy;
//   a season made today (docs/PLAN-start-a-game-gpt.md S2): Survivor's is its blocks compiled, never frozen, and its
//   league scores as on survivor.js; The Traitors' is still frozen; what asks research (seasonResearchRulebook); a frozen
//   season from before its built-in's data moved refreshes and stays frozen; a show switched to another format gets that
//   format's rulebook anew, the old one archived;
//   the flag off takes settings.rulebook out and leaves each league exactly as it was.
//
// Needs the local database (Docker survivor-draft-pg) with migration 0107 applied; no dev server. Refuses a
// non-local database. The backfill it runs is the real one over everything (idempotent; on the local copy it only
// adds the zt rows).
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const Formats = require("../../src/lib/game/formats/index.js");
const { compileRulebook } = require("../../src/lib/game/formats/rulebook-compile.js");
const survivorBlocks = require("../../src/lib/game/formats/blocks/survivor.blocks.js");
const R = require("../../db/rulebooks.js");
const ShowFormats = require("../../db/show-formats.js");
const { backfill, BACKFILL_LOCK } = require("../../db/backfill-rulebooks.js");
const { scoringSnapshot, comparePlayed } = require("../rulebooks-flag.js");
const fixture = require("./rulebook-fixture.js");

const READERS = { survivor: "survivor", "the-traitors-us": "traitors", "the-challenge": "challenge", [fixture.SHOW_SLUG]: "research" };

const stateOf = async (pool, id) => (await pool.query("SELECT state FROM leagues WHERE id=$1", [id])).rows[0].state;

// A change to a league under its row lock, then the rulebook sync, as the app's routes do it (withLeagueLock, then
// syncLeagueRulebook beside setLeagueFormat / setLeagueRuleset).
async function mutate(pool, leagueId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT state FROM leagues WHERE id=$1 FOR UPDATE", [leagueId]);
    const state = rows[0].state;
    await fn(state, client);
    const result = await R.syncLeagueRulebook(client, leagueId, state.settings, { on: true });
    await client.query("UPDATE leagues SET state=$1 WHERE id=$2", [JSON.stringify(state), leagueId]);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function run(pool) {
  let failed = 0;
  const check = (label, ok, detail = "") => {
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok || !detail ? "" : `: ${detail}`}`);
  };
  const eq = (label, got, want) => check(label, R.sameData(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
  const flagBefore = await R.rulebooksOn(pool);
  const fx = await fixture.up(pool);
  const by = Object.fromEntries(fx.leagues.map((l) => [l.slug, l]));
  try {
    const before = new Map();
    for (const l of fx.leagues) before.set(l.slug, await stateOf(pool, l.leagueId));

    // The backfill, the real one.
    const client = await pool.connect();
    let report;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [BACKFILL_LOCK]);
      report = await backfill(client);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    const zt = report.checks.filter((c) => c.season.endsWith(` ${fixture.SEASON}`));
    eq("the backfill makes a rulebook for each zt season", zt.map((c) => c.season).sort(), Object.keys(READERS).map((s) => `${s} ${fixture.SEASON}`).sort());
    const made = report.checks.filter((c) => c.season.endsWith(` ${fixture.FRESH}`));
    check("and one for each made today, each its format's rules (Survivor's: its blocks compiled)", made.length === 2 && made.every((c) => c.same), JSON.stringify(made));
    check("each is exactly the format its research reads", zt.every((c) => c.same), JSON.stringify(zt));
    eq("with the season's reader", Object.fromEntries(zt.map((c) => [c.season.split(" ")[0], c.reader])), READERS);
    const books = {};
    for (const [slug, id] of Object.entries(fx.seasons)) books[slug] = await R.seasonRulebook(pool, id);
    const { rows: edits } = await pool.query("SELECT * FROM rulebook_edits WHERE legacy_id=$1", [fx.change.id]);
    check("the season's rule change is copied as an edit", edits.length === 1 && edits[0].rulebook_id === books.survivor.id && edits[0].status === "in_force" && edits[0].from_episode === 3);
    eq("its delta as ops", edits[0] && edits[0].ops.map((o) => `${o.op} ${o.block} ${o.id || o.value.id}`), ["add customMoments ztBonus", "add points ztBonus"]);
    const template = await R.getRulebook(pool, books[fx.showSlug].parentId);
    check("a stored format's template sits in the library", template && template.ownerKind === "library" && template.parentKind === "show_format" && template.parentId === fx.formatId);

    // The flag on, league by league (what scripts/rulebooks-flag.js on does).
    const on = {};
    for (const l of fx.leagues) on[l.slug] = await R.syncLeagueRow(pool, l.leagueId, { on: true });
    const seasonOnes = fx.leagues.filter((l) => l.kind === "season" || l.kind === "adopted" || l.kind === "legacy");
    check("every league on a season gets its season's rulebook", seasonOnes.every((l) => on[l.slug].written && on[l.slug].saved && on[l.slug].source === "season" && on[l.slug].id === books[l.show].id), JSON.stringify(seasonOnes.map((l) => [l.slug, on[l.slug]])));
    const ownBook = await R.rulebookForLeague(pool, { leagueId: by["zt-rb-own"].leagueId });
    check("an own copy gets its own rulebook", on["zt-rb-own"].written && on["zt-rb-own"].source === "own" && ownBook.reader === "league" && ownBook.parentId === books.survivor.id);
    check("a stale cache stays on the old path", !on["zt-rb-stale"].written && /plays by/.test(on["zt-rb-stale"].mismatch || ""), JSON.stringify(on["zt-rb-stale"]));
    check("so does a season that isn't in the catalog", !on["zt-rb-noseason"].written && !!on["zt-rb-noseason"].reason);
    const states = {};
    for (const l of fx.leagues) states[l.slug] = await stateOf(pool, l.leagueId);
    eq("settings.rulebook is { id, version, data, reader }", Object.keys(states["zt-rb-survivor-pickem"].settings.rulebook).sort(), ["data", "id", "reader", "version"]);
    eq("each with its family's reader", Object.fromEntries(seasonOnes.map((l) => [l.slug, states[l.slug].settings.rulebook.reader])), Object.fromEntries(seasonOnes.map((l) => [l.slug, READERS[l.show]])));
    // (A season made today plays by its built-in's blocks: comparePlayed compares its events and catalog as sets.)
    const played = [];
    for (const l of fx.leagues.filter((x) => on[x.slug].written)) {
      played.push([l.slug, comparePlayed(states[l.slug], { phaseStarts: (await R.getRulebook(pool, on[l.slug].id)).phaseStarts })]);
    }
    check(`all ${played.length} written leagues score exactly the same`, played.every(([, c]) => c.same && c.rules), JSON.stringify(played.filter(([, c]) => !(c.same && c.rules))));
    const bonus = scoringSnapshot(states["zt-rb-adopted"]).events.slice(2).every((ep) => ep.some(([type]) => type === "ztBonus"));
    check("an adopted season change still scores on top of the rulebook", bonus);

    // A season's research reads its rulebook.
    for (const [slug, id] of Object.entries(fx.seasons)) {
      const { rows } = await pool.query("SELECT format FROM shows WHERE slug=$1", [slug]);
      const ruled = await R.seasonRulebookFormat(pool, id, { formatId: rows[0].format, on: true });
      const today = await ShowFormats.resolveFormat(pool, rows[0].format);
      check(`${slug}: research reads the season's rulebook, the same format`, !!ruled && R.sameData(ruled.data, today.data));
    }
    check("not with the flag off", !(await R.seasonRulebookFormat(pool, fx.seasons.survivor, { formatId: "survivor", on: false })));

    // The comparison can fail: a rulebook with other points doesn't score the same.
    const wrong = structuredClone(states["zt-rb-survivor-active-roster"]);
    for (const e of wrong.settings.rulebook.data.events) if (typeof e.defaultPoints === "number") e.defaultPoints += 5;
    check("a wrong rulebook is caught", !comparePlayed(wrong).same);

    // A stored format re-approved: its season's rulebook follows; a league whose cache hasn't is refused.
    const moved = fixture.storedData();
    for (const e of moved.events) if (typeof e.defaultPoints === "number") e.defaultPoints += 1;
    await pool.query("UPDATE show_formats SET data=$2, version=version+1 WHERE id=$1", [fx.formatId, JSON.stringify(moved)]);
    const storedSlug = "zt-rb-stored-active-roster";
    const refused = await mutate(pool, by[storedSlug].leagueId, () => {});
    check("a league whose cache didn't follow the format is refused", !refused.written && !!refused.mismatch, JSON.stringify(refused));
    await R.refreshShowRulebooks(pool, fx.showSlug);
    const followed = await mutate(pool, by[storedSlug].leagueId, (s) => ShowFormats.setLeagueFormat(s.settings, fx.formatId, moved));
    const storedBook = await R.seasonRulebook(pool, fx.seasons[fx.showSlug]);
    check("re-approved, the season's rulebook moves on a version", storedBook.version === 2 && R.sameData(storedBook.compiled, moved));
    check("and the league follows it, scoring the same", followed.written && followed.version === 2 && comparePlayed(await stateOf(pool, by[storedSlug].leagueId)).same);
    check("its template too", (await R.getRulebook(pool, template.id)).version === 2);

    // An own copy edited, then given up.
    const edited = fixture.ownData();
    edited.events[0].defaultPoints = 7;
    const ownId = by["zt-rb-own"].leagueId;
    const afterEdit = await mutate(pool, ownId, async (s, c) => {
      await c.query("UPDATE league_rulesets SET data=$2, version=version+1 WHERE id=$1", [by["zt-rb-own"].rulesetId, JSON.stringify(edited)]);
      s.settings.leagueRulesetData = edited;
    });
    check("an edited own copy moves its rulebook on", afterEdit.written && afterEdit.source === "own" && afterEdit.version === 2 && comparePlayed(await stateOf(pool, ownId)).same);

    // Lineage and who's using what, while the own copy exists.
    const using = await R.leaguesUsing(pool, books.survivor.id);
    eq("the season's rulebook is followed by its leagues", using.following.map((l) => l.slug).sort(), ["zt-rb-adopted", "zt-rb-legacy", "zt-rb-stale", "zt-rb-survivor-active-roster", "zt-rb-survivor-classic-draft", "zt-rb-survivor-pickem"]);
    eq("and copied by the own copy", using.ownCopies.map((l) => l.slug), ["zt-rb-own"]);
    const line = await R.lineage(pool, books.survivor.id);
    check("its lineage: the Survivor template, from the built-in", line.parents.length === 1 && line.parents[0].ownerKind === "library" && line.origin && line.origin.kind === "builtin" && line.origin.id === "survivor" && line.ownCopies === 1 && line.following === 6, JSON.stringify(line));

    const abandoned = await mutate(pool, ownId, async (s, c) => {
      await c.query("UPDATE leagues SET ruleset_id=NULL WHERE id=$1", [ownId]);
      delete s.settings.leagueRulesetData;
    });
    const { rows: ownRows } = await pool.query("SELECT status FROM rulebooks WHERE owner_kind='league' AND league_id=$1", [ownId]);
    const { rows: ownLeague } = await pool.query("SELECT rulebook_id FROM leagues WHERE id=$1", [ownId]);
    check("given up, the own rulebook is archived and the league follows its season", abandoned.written && abandoned.source === "season" && ownRows.every((r) => r.status === "archived") && !ownLeague[0].rulebook_id);

    // Saved from blocks: compiled on its base, unedited it scores the same; edited, the edit is what plays.
    const saved = await R.saveBlocks(pool, books.survivor.id, books.survivor.blocks, null);
    check("unedited blocks save, compiled on the frozen base", saved.rulebook && saved.rulebook.compiledSource === "blocks" && saved.rulebook.version === 2 && R.sameData(saved.rulebook.base, books.survivor.base));
    const roster = by["zt-rb-survivor-active-roster"].leagueId;
    const resynced = await mutate(pool, roster, () => {});
    check("leagues take the new version and still score the same", resynced.written && resynced.version === 2 && comparePlayed(await stateOf(pool, roster)).same);
    const blocks = structuredClone(books.survivor.blocks);
    blocks.points.immunityChallengeWon = 99;
    const pointed = await R.saveBlocks(pool, books.survivor.id, blocks, null);
    await mutate(pool, roster, () => {});
    const playing = await stateOf(pool, roster);
    const win = S.formatOf(playing).events.find((e) => e.id === "individualImmunity");
    check("a real edit is what the league plays by", pointed.rulebook.version === 3 && win && win.defaultPoints === 99 && !comparePlayed(playing).same);
    eq("compiled on the base, not on the last compile", pointed.rulebook.base, books.survivor.base);
    const refusedSave = await R.saveBlocks(pool, books.survivor.id, { ...blocks, kind: "nonsense" }, null);
    check("blocks with a problem are refused, located", !!refusedSave.refused && refusedSave.refused.some((p) => p.at && p.message));

    const phased = await R.setPhaseStart(pool, books.survivor.id, "merged", 4);
    check("a phase start is kept, and recompiles a rulebook from blocks", phased.rulebook && phased.rulebook.phaseStarts.merged === 4 && phased.rulebook.version === 4);
    check("a phase that isn't there is refused", !!(await R.setPhaseStart(pool, books.survivor.id, "nope", 2)).refused);
    const copy = await R.copyRulebook(pool, books["the-traitors-us"].id, { ownerKind: "league", leagueId: by["zt-rb-noseason"].leagueId });
    const { rows: copied } = await pool.query("SELECT rulebook_id FROM leagues WHERE id=$1", [by["zt-rb-noseason"].leagueId]);
    check("a copy points at what it was made from, at its version", copy.parentKind === "rulebook" && copy.parentId === books["the-traitors-us"].id && copy.parentVersion === 1 && copied[0].rulebook_id === copy.id);

    // A season made today (docs/PLAN-start-a-game-gpt.md S2): a built-in whose blocks stand alone is compiled from them,
    // never frozen; the others still are, until theirs do.
    const fresh = await R.seasonRulebook(pool, fx.fresh.survivor);
    const blocksWant = compileRulebook(survivorBlocks.blocks, { aliases: survivorBlocks.aliases, reader: "research", phaseStarts: fresh.phaseStarts }).data;
    check(
      "a new Survivor season is its blocks compiled, never survivor.js frozen",
      fresh.compiledSource === "blocks" && fresh.reader === "research" && !fresh.base && R.sameData(fresh.aliases, survivorBlocks.aliases) &&
        R.sameData(fresh.compiled, blocksWant) && fresh.provenance.from === "builtin" && fresh.provenance.id === "survivor",
      JSON.stringify({ source: fresh.compiledSource, reader: fresh.reader, provenance: fresh.provenance })
    );
    const freshTraitors = await R.seasonRulebook(pool, fx.fresh["the-traitors-us"]);
    check("a new Traitors season is still frozen: its blocks don't stand alone yet", freshTraitors.compiledSource === "legacy" && freshTraitors.reader === "traitors");
    // Its league plays by it with the flag on, and scores as on survivor.js (each episode's events and the catalog as sets:
    // their order and labels are the blocks').
    const freshSlug = "zt-rb-fresh-survivor";
    check("its league plays by it with the flag on", on[freshSlug].written && on[freshSlug].id === fresh.id, JSON.stringify(on[freshSlug]));
    const freshPlayed = comparePlayed(states[freshSlug], { phaseStarts: fresh.phaseStarts });
    check("and scores exactly as on survivor.js, by its blocks' rules", freshPlayed.same && freshPlayed.rules, JSON.stringify(freshPlayed));
    check("which the backfill and the flag hold it to", R.isFormatsRules(fresh, Formats.FORMATS.survivor) && !R.isFormatsRules({ ...fresh, compiled: Formats.FORMATS.survivor.data }, Formats.FORMATS.survivor));
    // Unedited, it follows its blocks as a frozen one follows its format: compiled before the blocks or the compiler moved on
    // (here, without the tags), it's compiled again, a version on.
    const stale = structuredClone(fresh.compiled);
    for (const e of stale.events) delete e.tags;
    await pool.query("UPDATE rulebooks SET compiled=$2 WHERE id=$1", [fresh.id, JSON.stringify(stale)]);
    const followed2 = await R.ensureSeasonRulebook(pool, fx.fresh.survivor);
    check(
      "unedited, it follows its blocks: compiled again when they moved on, a version on",
      followed2.change === "updated" && followed2.row.id === fresh.id && followed2.row.version === fresh.version + 1 && R.sameData(followed2.row.compiled, blocksWant),
      JSON.stringify({ change: followed2.change, version: followed2.row.version })
    );
    check("and left alone when they haven't", (await R.ensureSeasonRulebook(pool, fx.fresh.survivor)).change === "unchanged");
    // What asks a season's research, recorded with what it stores (db/episode-research.js askedAlike): a frozen season's
    // rulebook asks what its format asks, so it's recorded with the flag off too; one from blocks only once it's live.
    const challengeBook = books["the-challenge"];
    const frozenOff = await R.seasonResearchRulebook(pool, fx.seasons["the-challenge"], { formatId: "challenge", on: false });
    check("research on a frozen season asks by its format and records its rulebook", !frozenOff.format && !!frozenOff.rulebook && frozenOff.rulebook.id === challengeBook.id);
    const frozenOn = await R.seasonResearchRulebook(pool, fx.seasons["the-challenge"], { formatId: "challenge", on: true });
    check("and with the flag on asks by the rulebook", !!frozenOn.format && R.sameData(frozenOn.format.data, challengeBook.compiled) && frozenOn.rulebook.id === challengeBook.id);
    const otherFormat = await R.seasonResearchRulebook(pool, fx.seasons["the-challenge"], { formatId: "survivor", on: true });
    check("but not a frozen rulebook of another format", !otherFormat.format && !otherFormat.rulebook);
    const freshOff = await R.seasonResearchRulebook(pool, fx.fresh.survivor, { formatId: "survivor", on: false });
    check("a rulebook from blocks that isn't live asks nothing, so it isn't recorded", !freshOff.format && !freshOff.rulebook);
    const freshOn = await R.seasonResearchRulebook(pool, fx.fresh.survivor, { formatId: "survivor", on: true });
    check("live, it asks and is recorded", !!freshOn.format && R.sameData(freshOn.format.data, fresh.compiled) && freshOn.rulebook.id === fresh.id);
    // A frozen season whose data is from before its built-in's moved on (the tags, S2): refreshed, a version on, still frozen.
    const old = structuredClone(challengeBook.compiled);
    for (const e of old.events) delete e.tags;
    await pool.query("UPDATE rulebooks SET compiled=$2, base=$2 WHERE id=$1", [challengeBook.id, JSON.stringify(old)]);
    const refreshed = await R.ensureSeasonRulebook(pool, fx.seasons["the-challenge"]);
    check(
      "a frozen season from before its built-in's data moved refreshes, and stays frozen",
      refreshed.change === "updated" && refreshed.row.id === challengeBook.id && refreshed.row.compiledSource === "legacy" && refreshed.row.reader === "challenge" &&
        refreshed.row.version === challengeBook.version + 1 && R.sameData(refreshed.row.compiled, Formats.FORMATS.challenge.data),
      JSON.stringify({ change: refreshed.change, version: refreshed.row.version })
    );
    // The zt show switched to Survivor's format: Survivor's rulebook anew (its blocks), the stored format's archived.
    const storedSeason = fx.seasons[fx.showSlug];
    const was = await R.seasonRulebook(pool, storedSeason);
    await pool.query("UPDATE shows SET format='survivor' WHERE slug=$1", [fx.showSlug]);
    const switched = await R.ensureSeasonRulebook(pool, storedSeason);
    const { rows: wasRow } = await pool.query("SELECT status FROM rulebooks WHERE id=$1", [was.id]);
    const { rows: pointsAt } = await pool.query("SELECT rulebook_id FROM show_seasons WHERE id=$1", [storedSeason]);
    check(
      "a show switched to another format gets that format's rulebook anew, the old one archived",
      switched.change === "created" && switched.row.id !== was.id && wasRow[0].status === "archived" && switched.row.compiledSource === "blocks" &&
        switched.row.provenance.id === "survivor" && pointsAt[0].rulebook_id === switched.row.id,
      JSON.stringify({ change: switched.change, was: wasRow[0], source: switched.row.compiledSource })
    );
    await pool.query("UPDATE shows SET format=$2 WHERE slug=$1", [fx.showSlug, fx.formatId]);

    // The flag off: settings.rulebook out of every league, and each back exactly as it was.
    const off = {};
    for (const l of fx.leagues) off[l.slug] = await R.syncLeagueRow(pool, l.leagueId, { on: false });
    const after = {};
    for (const l of fx.leagues) after[l.slug] = await stateOf(pool, l.leagueId);
    check("the flag off takes settings.rulebook out of every league", fx.leagues.every((l) => !("rulebook" in after[l.slug].settings)));
    check("and saves only the leagues that had one", fx.leagues.every((l) => off[l.slug].saved === !!states[l.slug].settings.rulebook || ["zt-rb-own", storedSlug].includes(l.slug)));
    // Untouched leagues are exactly as before the flag went on; the two whose caches the checks changed, as they now are.
    const untouched = fx.leagues.filter((l) => ![storedSlug, "zt-rb-own"].includes(l.slug));
    check("every untouched league is exactly as it was", untouched.every((l) => R.sameData(after[l.slug], before.get(l.slug))), untouched.filter((l) => !R.sameData(after[l.slug], before.get(l.slug))).map((l) => l.slug).join(", "));
    check("and scores as it did", untouched.every((l) => R.sameData(scoringSnapshot(after[l.slug]), scoringSnapshot(before.get(l.slug)))));
    check("the real flag was never touched", (await R.rulebooksOn(pool)) === flagBefore);
  } finally {
    await fixture.down(pool);
  }
  const { rows: left } = await pool.query(
    `SELECT count(*)::int AS n FROM rulebooks WHERE (owner_kind='library' AND parent_id=$1) OR season_id IN (SELECT id FROM show_seasons WHERE name=$2)`,
    [fixture.FORMAT_ID, fixture.SEASON_NAME]
  );
  check("down leaves no zt rulebooks", left[0].n === 0);
  console.log(failed ? `${failed} failed` : "all passed");
  if (failed) process.exitCode = 1;
}

if (require.main === module) {
  const url = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) throw new Error("check-rulebook-flag runs against a local database only");
  const pool = new Pool({ connectionString: url });
  const cmd = process.argv[2];
  const go = {
    run,
    up: (p) => fixture.up(p).then((r) => console.log(`[zt] up: ${r.leagues.length} leagues`)),
    down: (p) => fixture.down(p).then(() => console.log("[zt] down")),
  }[cmd];
  (go ? go(pool) : Promise.reject(new Error("usage: run | up | down")))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { run };
