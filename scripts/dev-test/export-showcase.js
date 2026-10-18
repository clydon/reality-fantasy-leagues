// Exports real show data (casts, photos, tribes, exits, points per episode) for mocks, demo and
// promotional graphics. Read-only: it never writes to the database. No usernames or player data
// leave the DB; only show-level facts (who's in the cast, what they scored, when they left).
//
//   node scripts/dev-test/export-showcase.js [outDir=.impeccable/mocks/showcase]
//
// Needs AUTH_DATABASE_URL in .env.local (the local copy of production is fine). Writes
// <outDir>/showcase.json and downloads every cast photo to <outDir>/img/<season>/<name>.<ext>, so
// mocks work offline and can be published with their images. Re-run to refresh; existing photos
// are kept.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const sharp = require("sharp"); // ships with Next
sharp.cache(false); // Windows keeps cached files locked otherwise

const OUT = process.argv[2] || ".impeccable/mocks/showcase";
// Seasons to export: [show slug, season number, a league on that season to read results from (or null)]
const SEASONS = [
  ["survivor", 49, "S49 Active Roster"],
  ["survivor", 51, "Weekly Start/Bench"],
  ["the-traitors-us", 5, "Traitors Shared"],
  ["the-challenge", 37, null],
];

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function download(url, dest) {
  if (fs.existsSync(dest)) return true;
  if (!/^https?:/.test(url)) {
    const local = path.join("public", url);
    if (!fs.existsSync(local)) return false;
    fs.copyFileSync(local, dest);
    return true;
  }
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (showcase export)" } });
  if (!r.ok) return false;
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return true;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const out = { exportedAt: new Date().toISOString(), seasons: [] };
  for (const [showSlug, num, leagueName] of SEASONS) {
    const { rows: [ss] } = await pool.query(
      `SELECT ss.*, sh.name show_name, sh.castaway_term, sh.tribe_term FROM show_seasons ss JOIN shows sh ON sh.id=ss.show_id
       WHERE sh.slug=$1 AND ss.season_number=$2`, [showSlug, num]);
    if (!ss) { console.log("missing", showSlug, num); continue; }
    const { rows: cast } = await pool.query(`SELECT name, tribe_name, photo_url, sort_order FROM season_cast WHERE season_id=$1 ORDER BY sort_order`, [ss.id]);
    const dir = path.join(OUT, "img", `${showSlug}-${num}`);
    fs.mkdirSync(dir, { recursive: true });

    // results from a league on this season (show-level facts only)
    let byName = {}, episodes = 0, tribes = {};
    if (leagueName) {
      const { rows: [lg] } = await pool.query(`SELECT state FROM leagues WHERE name=$1`, [leagueName]);
      const s = lg.state, pts = s.settings.eventPoints || {};
      (s.tribes || []).forEach((t) => (tribes[t.name] = t.color));
      const scored = s.episodes.filter((e) => (e.scoringEvents || []).length || (e.events || []).length);
      episodes = scored.length;
      for (const c of s.castaways) byName[c.name] = { status: c.status, exitMethod: c.exitMethod, place: c.placementOrder, tribeNow: (s.tribes.find((t) => t.id === c.tribeId) || {}).name, perEp: [], exitEp: null };
      scored.forEach((e, i) => {
        const add = (id, v, why) => { const c = s.castaways.find((x) => x.id === id); if (!c) return; const b = byName[c.name]; b.perEp[i] = (b.perEp[i] || 0) + v; (b.why ||= []).push([i + 1, why, v]); };
        (e.scoringEvents || []).forEach((ev) => add(ev.castawayId, pts[ev.type] ?? 0, ev.type));
        (e.events || []).forEach((ev) => { add(ev.castawayId, ev.method === "Quit" ? pts.quit ?? -8 : pts.votedOut ?? -4, ev.method); const c = s.castaways.find((x) => x.id === ev.castawayId); if (c) byName[c.name].exitEp = e.number; });
      });
    }
    const people = [];
    for (const c of cast) {
      // every photo ends up a 480px square JPEG (wiki originals can be several MB)
      const ext = (c.photo_url || "").split("?")[0].match(/\.(png|jpe?g|webp|gif)$/i)?.[1] || "jpg";
      const file = `${slug(c.name)}.jpg`, dest = path.join(dir, file), raw = path.join(dir, `${slug(c.name)}.orig.${ext.toLowerCase()}`);
      let ok = fs.existsSync(dest);
      if (!ok && c.photo_url && await download(c.photo_url, raw)) {
        const buf = await sharp(fs.readFileSync(raw)).resize(480, 480, { fit: "cover", position: "attention" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
        fs.writeFileSync(dest, buf); fs.unlinkSync(raw); ok = true;
      }
      const r = byName[c.name] || Object.entries(byName).find(([n]) => n.split(" ")[0] === c.name.split(" ")[0])?.[1] || {};
      const perEp = Array.from({ length: episodes }, (_, i) => r.perEp?.[i] || 0);
      people.push({ name: c.name, tribe: c.tribe_name || r.tribeNow || null, tribeNow: r.tribeNow || null, photo: ok ? `img/${showSlug}-${num}/${file}` : null,
        status: r.status || null, exitMethod: r.exitMethod || null, exitEp: r.exitEp || null, place: r.place || null, perEp, total: perEp.reduce((a, b) => a + b, 0), why: r.why || [] });
    }
    out.seasons.push({ show: ss.show_name, slug: showSlug, season: num, status: ss.status, premiere: ss.premiere_date, airTime: ss.air_time, castTerm: ss.castaway_term, tribeTerm: ss.tribe_term,
      episodesScored: episodes, tribes, cast: people });
    console.log(`${ss.show_name} ${num}: ${people.length} cast, ${people.filter((p) => p.photo).length} photos, ${episodes} episodes scored`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "showcase.json"), JSON.stringify(out, null, 1));
  // the same data as a script, so file:// mocks can load it without fetch
  fs.writeFileSync(path.join(OUT, "data.js"), "window.SHOWCASE=" + JSON.stringify(out) + ";\n");
  console.log("wrote", path.join(OUT, "showcase.json"));
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
