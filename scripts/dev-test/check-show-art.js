// Dev-only check of the art and photo finder (src/lib/server/show-art.ts; docs/RESEARCH-show-art-and-cast-photos.md) against
// the real services: TMDB (needs TMDB_READ_TOKEN in .env.local), TVmaze, Wikipedia and Jolpica. No app server.
//
// It never touches a real show or league. `up` makes archived copies keyed "zt-art-":
//   survivor  a show named "Survivor" (US, no ids: found on TMDB by name), its season 51 with the cast's NAMES copied from
//             the local database's own Survivor 51 (read only; any copy of production has them), so the names are the wiki's
//             spellings, as in real use
//   f1        a sport show "Formula 1" with a 2026 season and the 2026 field's names from Jolpica
//   nfl       a sport show "NFL" with a few players' names (--names="A,B" for others), found by Wikipedia search
// `check` runs the finder on them and prints what it found (art URLs, how many photos and from where), failing when the
// basics are missing; `down` removes everything "zt-art-". `all` (the default) is up, check, down.
//
//   node scripts/dev-test/check-show-art.js [all|up|check|down] [--case=survivor|f1|nfl|both] [--no-tmdb] [--names=...]
//
// --no-tmdb hides the token from the finder, so the TVmaze fallback is what's checked (the survivor case then links its
// season to TVmaze's Survivor 51 listing, found through TVmaze's own search).
require("dotenv").config({ path: ".env.local" });
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });

const args = process.argv.slice(2);
const step = args.find((a) => !a.startsWith("--")) ?? "all";
const which = (args.find((a) => a.startsWith("--case=")) ?? "--case=both").slice(7);
const cases = which === "both" ? ["survivor", "f1"] : [which];
if (args.includes("--no-tmdb")) delete process.env.TMDB_READ_TOKEN;

const named = args.find((a) => a.startsWith("--names="));
// Real, public athletes, a couple with namesakes (Josh Allen: a politician and another player; Lamar Jackson: several).
const NFL = named ? named.slice(8).split(",").map((x) => x.trim()).filter(Boolean) : ["Patrick Mahomes", "Travis Kelce", "Josh Allen", "Lamar Jackson", "Justin Jefferson", "Saquon Barkley"];

const { pool } = jiti("../../src/lib/server/db.ts");
const art = jiti("../../src/lib/server/show-art.ts");

async function up() {
  for (const c of cases) {
    const slug = `zt-art-${c}`;
    await down(slug);
    const sport = c === "f1" || c === "nfl";
    const { rows } = await pool.query(
      `INSERT INTO shows (slug, name, castaway_term, tribe_term, kind, archived, listing)
       VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING id`,
      [slug, c === "nfl" ? "NFL" : sport ? "Formula 1" : "Survivor", sport ? "Driver" : "Castaway", sport ? "Team" : "Tribe", sport ? "sport" : "competition", JSON.stringify({ country: "US" })]
    );
    const showId = rows[0].id;
    let listingId = null;
    if (!sport && !process.env.TMDB_READ_TOKEN) {
      const found = await (await fetch("https://api.tvmaze.com/singlesearch/shows?q=survivor&embed=seasons")).json();
      listingId = found._embedded.seasons.find((s) => s.number === 51)?.id ?? null;
    }
    const { rows: ss } = await pool.query(
      `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, listing_id) VALUES ($1, $2, 'airing', $3, $4) RETURNING id`,
      [showId, sport ? 2026 : 51, sport ? "2026-03-06" : "2026-09-23", listingId]
    );
    let names;
    if (c === "nfl") {
      names = NFL;
    } else if (sport) {
      const d = await (await fetch("https://api.jolpi.ca/ergast/f1/2026/drivers/?limit=100")).json();
      names = d.MRData.DriverTable.Drivers.slice(0, 12).map((x) => `${x.givenName} ${x.familyName}`);
    } else {
      const { rows: real } = await pool.query(
        `SELECT sc.name FROM season_cast sc JOIN show_seasons ss ON ss.id = sc.season_id JOIN shows s ON s.id = ss.show_id
          WHERE s.slug = 'survivor' AND ss.season_number = 51 ORDER BY sc.name`
      );
      names = real.map((r) => r.name);
      if (!names.length) throw new Error("No Survivor 51 cast in this database to copy names from");
    }
    let i = 0;
    for (const n of names) await pool.query("INSERT INTO season_cast (season_id, name, sort_order) VALUES ($1, $2, $3)", [ss[0].id, n, i++]);
    console.log(`up: ${slug} (${names.length} people)`);
  }
}

async function check() {
  let ok = true;
  const fail = (msg) => {
    ok = false;
    console.log(`  FAIL ${msg}`);
  };
  for (const c of cases) {
    const slug = `zt-art-${c}`;
    const { rows } = await pool.query("SELECT s.id AS show_id, ss.id AS season_id FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE s.slug = $1", [slug]);
    if (!rows.length) throw new Error(`${slug} isn't up`);
    const { show_id, season_id } = rows[0];
    const t0 = Date.now();
    const showArt = await art.fillShowArt(show_id);
    const seasonArt = await art.fillSeasonArt(season_id);
    const photos = await art.fillCastPhotos(season_id);
    const { rows: s } = await pool.query("SELECT tmdb_id, art_url, backdrop_url, logo_url FROM shows WHERE id = $1", [show_id]);
    const { rows: se } = await pool.query("SELECT art_url FROM show_seasons WHERE id = $1", [season_id]);
    const { rows: cast } = await pool.query("SELECT name, photo_url FROM season_cast WHERE season_id = $1 ORDER BY name", [season_id]);
    console.log(`\n${slug} (${Date.now() - t0} ms): TMDB ${art.tmdbOn() ? `on, show ${s[0].tmdb_id ?? "not found"}` : "off"}`);
    console.log(`  show art ${showArt ? "found" : "none"}: poster ${s[0].art_url ?? "-"}\n    backdrop ${s[0].backdrop_url ?? "-"}\n    logo ${s[0].logo_url ?? "-"}`);
    console.log(`  season poster ${seasonArt ? se[0].art_url : "none"}`);
    console.log(`  photos: ${photos.found} of ${photos.looked} (${JSON.stringify(photos.from)})`);
    const missing = cast.filter((x) => !x.photo_url).map((x) => x.name);
    if (missing.length) console.log(`  no photo: ${missing.join(", ")}`);
    if (c === "survivor" && art.tmdbOn()) {
      if (s[0].tmdb_id !== 14658) fail(`Survivor should link to TMDB 14658, got ${s[0].tmdb_id}`);
      if (!s[0].backdrop_url || !s[0].art_url) fail("no poster or backdrop");
      if (!seasonArt) fail("no season poster");
      if (photos.found < photos.looked * 0.8) fail("under 80% of photos found");
    } else if (c === "survivor") {
      if (photos.found === 0) fail("TVmaze found no photos");
    } else if (photos.found < photos.looked * 0.8) fail("under 80% of drivers' photos found");
  }
  console.log(ok ? "\nall good" : "\nFAILED");
  if (!ok) process.exitCode = 1;
}

async function down(only) {
  const slugs = only ? [only] : cases.map((c) => `zt-art-${c}`);
  const { rowCount } = await pool.query("DELETE FROM shows WHERE slug = ANY($1)", [slugs]);
  if (!only) console.log(`down: removed ${rowCount} show(s)`);
}

(async () => {
  try {
    if (step === "up" || step === "all") await up();
    if (step === "check" || step === "all") await check();
    if (step === "down" || step === "all") await down();
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
