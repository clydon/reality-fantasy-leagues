// Links every league's castaways to their season's cast (docs/PLAN-universal-season-cast.md, pieces 1
// and 6): sets castaway.seasonCastId, the stable link that lets a rename, new photo or starting-tribe
// fix in season_cast reach each league in place instead of adding a second person.
//
//   node db/link-season-cast.js                      dry run: print the report, write nothing
//   node db/link-season-cast.js --season=<uuid>      ...approved-cast seasons: this one only
//   node db/link-season-cast.js --apply --expect=<fingerprint>
//   node db/link-season-cast.js --confirm="ZZSSB1:Jess=Jess White;ABC123:Sam=Sam Phelan"
//                                                    an admin's own call on a name the report left
//                                                    ambiguous or unmatched: <join code>:<castaway>=<season
//                                                    cast name>. Part of the plan and its fingerprint, so
//                                                    it's dry-run and applied like everything else.
//
// Two kinds of season, one report:
//
//   1. Seasons with an APPROVED cast (piece 1): link each league's castaways to it.
//   2. Seasons with leagues but NO season cast -- self-serve seasons, where each league typed its own
//      roster (piece 6). The most complete league roster (most castaways; the oldest league on a tie)
//      becomes the season's cast, created as if that league's commissioner had entered it: approved,
//      credited to that league, starting tribes held until episode 1 and its commissioner asked (see
//      db/migrations/0055), finished at once if any league on the season is already underway. Then
//      every league is linked to it, exactly as in 1.
//
// THIS IS THE DANGEROUS STEP OF THAT PLAN. A wrong link hands a drafted castaway someone else's
// identity, and nothing downstream would notice. So:
//
//   * Matching is StateLogic.planSeasonCastLinks: exact name, then a forgiving match that has to agree
//     in both directions. Anything else -- an ambiguous name, a row nobody matches, a castaway nobody
//     claims -- is reported and left alone, never guessed. Those are for an admin to resolve.
//   * A dry run is the default and prints a fingerprint of exactly what it would write. --apply refuses
//     without --expect=<that fingerprint>, and re-plans inside the row locks: if anything moved between
//     the dry run and the apply (a league joined the season, someone renamed a castaway), the
//     fingerprint won't match and nothing is written. What's applied is always what was reviewed.
//   * The only change written to a league is castaway.seasonCastId on castaways that have none. The dry
//     run proves it: each league's state with the links stripped must equal the state it read, and its
//     scores must be the same before and after.
//   * Nothing is renamed, re-photographed, re-tribed or added here. The report previews what the NEXT
//     push of the cast would change in each league (a commissioner's edit, an admin's approve or fix, a
//     league re-picking its season) -- StateLogic.applySeasonCast, the same function the app runs -- so
//     a spelling about to change in someone's league is seen before it can happen.
//
// Plain CommonJS under bare `node`, like db/wiki-sync.js -- it reads the real game logic, not a copy.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const StateLogic = require("../src/lib/game/state-logic.js");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    // Split on the FIRST "=" only: --confirm's values have their own.
    const raw = a.replace(/^--/, "");
    const at = raw.indexOf("=");
    return at < 0 ? [raw, true] : [raw.slice(0, at), raw.slice(at + 1)];
  })
);
const APPLY = !!args.apply;
// A self-serve season's cast holds its starting tribes from episode 1 until someone says otherwise
// (season-cast-write.ts's createFromRoster does the same) -- the preview uses the same hold.
const SELF_SERVE_HOLD = 1;

// --confirm: { joinCode: [{ castaway, season }] }.
const CONFIRMED = {};
String(args.confirm || "")
  .split(";")
  .map((x) => x.trim())
  .filter(Boolean)
  .forEach((x) => {
    const m = x.match(/^([^:]+):(.+)=(.+)$/);
    if (!m) throw new Error(`--confirm entry "${x}" isn't <join code>:<castaway>=<season cast name>`);
    (CONFIRMED[m[1].trim().toUpperCase()] ||= []).push({ castaway: m[2].trim(), season: m[3].trim() });
  });

// Score rows embed whole castaway objects; the link is the one key allowed to differ.
const withoutLinks = (value) => JSON.stringify(value, (k, v) => (k === "seasonCastId" ? undefined : v));
const clone = (v) => JSON.parse(JSON.stringify(v));

async function approvedSeasons(db) {
  const { rows } = await db.query(
    `SELECT ss.id, ss.season_number, ss.tribes_from_episode, s.slug, s.name AS show_name
       FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE ss.cast_approved_at IS NOT NULL ${args.season ? "AND ss.id = $1" : ""}
      ORDER BY s.slug, ss.season_number`,
    args.season ? [args.season] : []
  );
  return rows;
}

async function castOf(db, seasonId) {
  const { rows } = await db.query(
    `SELECT id, name, tribe_name AS "tribeName", photo_url AS "photoUrl"
       FROM season_cast WHERE season_id=$1 ORDER BY sort_order ASC, name ASC`,
    [seasonId]
  );
  return rows;
}

// The same leagues applyApprovedCastToLeagues pushes a cast into (text comparison, for the same reason).
async function leaguesOn(db, slug, seasonNumber, lock) {
  const { rows } = await db.query(
    `SELECT id, name, join_code, created_at, state FROM leagues
      WHERE state->'settings'->>'showId' = $1 AND state->'settings'->>'wikiSeason' = $2
      ORDER BY name ${lock ? "FOR UPDATE" : ""}`,
    [slug, String(seasonNumber)]
  );
  return rows;
}

// Self-serve seasons: leagues on a catalogued show and a whole-number season that has no cast rows.
async function selfServeSeasons(db) {
  const { rows } = await db.query(
    `SELECT s.id AS show_id, s.slug, s.name AS show_name, (l.state->'settings'->>'wikiSeason')::int AS season_number
       FROM leagues l JOIN shows s ON s.slug = l.state->'settings'->>'showId'
      WHERE l.state->'settings'->>'wikiSeason' ~ '^[0-9]+$'
        AND NOT EXISTS (SELECT 1 FROM show_seasons ss JOIN season_cast sc ON sc.season_id = ss.id
                         WHERE ss.show_id = s.id AND ss.season_number = (l.state->'settings'->>'wikiSeason')::int)
      GROUP BY 1, 2, 3, 4 ORDER BY 2, 4`
  );
  return rows;
}

// The roster that becomes a self-serve season's cast, as rows with stand-in ids ("new:0"...) until
// they're inserted. A name the roster has twice gets one row; the second castaway is reported.
function proposedCast(source) {
  const rows = [];
  const repeats = [];
  for (const c of source.state.castaways) {
    const name = (c.name || "").trim();
    if (!name) continue;
    if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) { repeats.push(name); continue; }
    const startId = c.startTribeId !== undefined ? c.startTribeId : c.tribeId;
    const tribe = startId ? StateLogic.getTribe(source.state, startId) : null;
    rows.push({ id: `new:${rows.length}`, name, tribeName: tribe ? tribe.name : null, photoUrl: c.photoUrl || null });
  }
  return { rows, repeats };
}

const pickSource = (leagues) =>
  [...leagues].sort((a, b) => b.state.castaways.length - a.state.castaways.length || new Date(a.created_at) - new Date(b.created_at))[0];

// Plans one league and proves what applying it would do, all on a copy.
function planLeague(league, cast, tribesFromEpisode) {
  const state = league.state;
  // An admin's confirmations first, by exact name on both sides, onto a working copy -- the planner then
  // sees them as already linked. Refused (and the run fails) if either side is missing or already taken.
  const working = clone(state);
  const confirmed = [];
  for (const c of CONFIRMED[String(league.join_code).toUpperCase()] || []) {
    const who = working.castaways.filter((x) => x.name === c.castaway);
    const row = cast.find((r) => r.name === c.season);
    const problem =
      who.length !== 1 ? `no single castaway named "${c.castaway}"`
      : who[0].seasonCastId ? `"${c.castaway}" is already linked`
      : !row ? `no season cast row named "${c.season}"`
      : working.castaways.some((x) => x.seasonCastId === row.id) ? `"${c.season}" is already someone else here`
      : null;
    if (problem) throw new Error(`--confirm ${league.join_code}:${c.castaway}=${c.season}: ${problem}`);
    who[0].seasonCastId = row.id;
    confirmed.push({ seasonCastId: row.id, seasonName: row.name, castawayId: who[0].id, castawayName: who[0].name, how: "confirmed" });
  }
  const planned = StateLogic.planSeasonCastLinks(working, cast, { forgiving: true });
  const plan = {
    ...planned,
    links: [...planned.links.filter((l) => !confirmed.some((c) => c.castawayId === l.castawayId)), ...confirmed],
  };
  const copy = clone(working);
  const linked = [...confirmed.map((c) => c.castawayName), ...StateLogic.applySeasonCastLinks(copy, planned)];

  const stripped = clone(copy);
  stripped.castaways.forEach((c) => {
    const was = state.castaways.find((x) => x.id === c.id);
    if (!was || was.seasonCastId === undefined) delete c.seasonCastId;
  });
  const onlyLinksChanged = JSON.stringify(stripped) === JSON.stringify(state);
  const scoresBefore = withoutLinks(StateLogic.computeScores(clone(state)));
  const scoresAfter = withoutLinks(StateLogic.computeScores(clone(copy)));

  // Not written here: what the next push of the cast changes in this league, now people are linked.
  const preview = clone(copy);
  const due = StateLogic.castTribesDue(preview, tribesFromEpisode);
  const next = StateLogic.applySeasonCast(preview, cast, { withTribes: due });
  // ...and, while the starting tribes are held here, what they'll change when they come due.
  const later = due ? [] : StateLogic.syncSeasonCast(clone(preview), cast, { withTribes: true }).retribed;

  return { plan, linked, copy, onlyLinksChanged, scoresSame: scoresBefore === scoresAfter, next, later };
}

const newLinks = (leagueId, plan) =>
  plan.links.filter((l) => l.how !== "id").map((l) => ["link", leagueId, l.castawayId, l.seasonCastId]);

function fingerprint(all) {
  const sorted = [...all].map((x) => x.join("|")).sort();
  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex").slice(0, 16);
}

function report(cast, league, r) {
  const { plan, next } = r;
  const tally = (how) => plan.links.filter((l) => l.how === how).length;
  console.log(`\n  ${league.name} (${league.join_code}) -- ${league.state.castaways.length} castaways, season cast ${cast.length}`);
  console.log(`    already linked: ${tally("id")}   exact: ${tally("exact")}   forgiving: ${tally("forgiving")}   confirmed: ${tally("confirmed")}`);
  plan.links.filter((l) => l.how === "confirmed").forEach((l) => console.log(`      confirmed by admin: league "${l.castawayName}" -> season "${l.seasonName}"`));
  plan.links.filter((l) => l.how === "forgiving").forEach((l) => console.log(`      forgiving: league "${l.castawayName}" -> season "${l.seasonName}"`));
  plan.ambiguous.forEach((a) => console.log(`    AMBIGUOUS (${a.how}), left unlinked: season "${a.seasonName}" could be ${a.candidates.map((c) => `"${c}"`).join(" / ")}`));
  plan.unmatched.forEach((u) => console.log(`    UNMATCHED season row, no castaway here: "${u.seasonName}"`));
  plan.unlinked.forEach((u) => console.log(`    UNLINKED league castaway, no season row: "${u.castawayName}"`));
  console.log(`    proof: only seasonCastId changes: ${r.onlyLinksChanged ? "yes" : "NO"}   scores identical: ${r.scoresSame ? "yes" : "NO"}`);
  const changes = [
    ...next.synced.renamed.map((x) => `rename "${x.from}" -> "${x.to}"`),
    ...next.synced.photos.map((n) => `new photo for "${n}"`),
    ...next.synced.retribed.map((x) => `starting tribe of "${x.name}": ${x.from} -> ${x.to}`),
    ...next.synced.conflicts.map((x) => `CONFLICT: can't rename "${x.from}" -> "${x.to}" (name taken)`),
    ...next.castaways.map((n) => `add "${n}"`),
    ...next.needsReview.map((n) => `NOT add "${n}" (an unlinked castaway here might be them -- needs review)`),
    ...r.later.map((x) => `when starting tribes come due: starting tribe of "${x.name}": ${x.from} -> ${x.to}`),
  ];
  console.log(`    next push of the cast would change in place: ${changes.length ? "" : "nothing"}`);
  changes.forEach((c) => console.log(`      ${c}`));
}

async function main() {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  if (APPLY && !args.expect) {
    console.error("--apply needs --expect=<fingerprint> from a dry run you've reviewed.");
    process.exit(1);
  }
  const db = await pool.connect();
  let ok = true;
  try {
    if (APPLY) await db.query("BEGIN");
    const all = [];
    const writes = [];
    const creates = [];
    console.log(APPLY ? "APPLY (re-planned inside the locks)" : "DRY RUN -- nothing is written");

    console.log("\n=== Seasons with an approved cast ===");
    for (const season of await approvedSeasons(db)) {
      const cast = await castOf(db, season.id);
      const leagues = await leaguesOn(db, season.slug, season.season_number, APPLY);
      console.log(`\n${season.show_name} season ${season.season_number} (${season.id}) -- approved cast of ${cast.length}, ${leagues.length} league(s)`);
      for (const league of leagues) {
        const r = planLeague(league, cast, season.tribes_from_episode);
        report(cast, league, r);
        if (!r.onlyLinksChanged || !r.scoresSame) ok = false;
        all.push(...newLinks(league.id, r.plan));
        if (r.linked.length) writes.push({ id: league.id, state: r.copy });
      }
    }

    if (!args.season) {
      console.log("\n=== Self-serve seasons: leagues, but no season cast ===");
      const seasons = await selfServeSeasons(db);
      if (!seasons.length) console.log("  none");
      for (const season of seasons) {
        const leagues = (await leaguesOn(db, season.slug, season.season_number, APPLY)).filter((l) => l.state.castaways.length);
        if (!leagues.length) continue;
        const source = pickSource(leagues);
        const { rows: cast, repeats } = proposedCast(source);
        const underway = leagues.some((l) => StateLogic.seasonUnderway(l.state));
        console.log(
          `\n${season.show_name} season ${season.season_number} -- ${leagues.length} league(s) with a roster. ` +
            `Proposed season cast: ${source.name} (${source.join_code})'s ${cast.length}` +
            (underway ? "; finished at once (a league is already underway)" : "; its commissioner can keep editing until it's finished")
        );
        console.log(`  proposed: ${cast.map((c) => c.name).join(", ")}`);
        repeats.forEach((n) => console.log(`  REPEATED in ${source.name}, second one left unlinked: "${n}"`));
        all.push(["create", season.slug, season.season_number, source.id, ...cast.map((c) => `${c.name}/${c.tribeName ?? ""}/${c.photoUrl ?? ""}`)]);
        const plans = [];
        for (const league of leagues) {
          const r = planLeague(league, cast, SELF_SERVE_HOLD);
          report(cast, league, r);
          if (!r.onlyLinksChanged || !r.scoresSame) ok = false;
          all.push(...newLinks(league.id, r.plan));
          plans.push({ league, r });
        }
        creates.push({ season, source, cast, underway, plans });
      }
    }

    const fp = fingerprint(all);
    const linkCount = all.filter((x) => x[0] === "link").length;
    console.log(`\n${creates.length} season cast(s) to create; ${linkCount} new link(s). Fingerprint: ${fp}`);
    if (!ok) {
      console.log("A proof line above says NO -- refusing to apply. Nothing written.");
      if (APPLY) await db.query("ROLLBACK");
      process.exitCode = 1;
      return;
    }
    if (!APPLY) {
      if (all.length) console.log(`To write exactly these: node db/link-season-cast.js --apply --expect=${fp}${args.season ? ` --season=${args.season}` : ""}`);
      return;
    }
    if (fp !== args.expect) {
      await db.query("ROLLBACK");
      console.error(`Fingerprint is ${fp}, not ${args.expect}: something changed since that dry run. Nothing written -- dry-run again.`);
      process.exitCode = 1;
      return;
    }

    for (const w of writes) {
      await db.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(w.state), w.id]);
    }
    for (const c of creates) {
      await db.query(
        "INSERT INTO show_seasons (show_id, season_number) VALUES ($1,$2) ON CONFLICT (show_id, season_number) DO NOTHING",
        [c.season.show_id, c.season.season_number]
      );
      const { rows: [ss] } = await db.query(
        "SELECT id FROM show_seasons WHERE show_id=$1 AND season_number=$2 FOR UPDATE",
        [c.season.show_id, c.season.season_number]
      );
      const real = {};
      for (const [i, row] of c.cast.entries()) {
        const { rows: [ins] } = await db.query(
          "INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id",
          [ss.id, row.name, row.tribeName, row.photoUrl, i]
        );
        real[row.id] = ins.id;
      }
      await db.query(
        `UPDATE show_seasons SET cast_approved_at=now(), cast_approved_by=NULL, cast_size=$2, cast_created_by_league=$3,
                cast_tribes_confirmed=false, tribes_from_episode=$4, cast_locked_at=${c.underway ? "now()" : "NULL"}, updated_at=now()
          WHERE id=$1`,
        [ss.id, c.cast.length, c.source.id, SELF_SERVE_HOLD]
      );
      await db.query(
        `INSERT INTO season_cast_changes (season_id, field, after, by_league) VALUES ($1, 'created', $2, $3)`,
        [ss.id, `${c.cast.length} (from ${c.source.name}'s roster, by db/link-season-cast.js)`, c.source.id]
      );
      for (const { league, r } of c.plans) {
        if (!r.linked.length) continue;
        r.copy.castaways.forEach((x) => { if (x.seasonCastId && real[x.seasonCastId]) x.seasonCastId = real[x.seasonCastId]; });
        await db.query("UPDATE leagues SET state=$1, updated_at=now() WHERE id=$2", [JSON.stringify(r.copy), league.id]);
      }
    }
    await db.query("COMMIT");
    console.log(`Written: ${creates.length} season cast(s) created, ${linkCount} link(s).`);
  } catch (e) {
    if (APPLY) await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
