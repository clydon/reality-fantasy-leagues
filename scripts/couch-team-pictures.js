// The site owner's one-off: team pictures into ONE couch, by hand (docs/PLAN-team-logos.md L6). Not a feature: the app never
// supplies a team's logo to anyone. This is the owner doing for their own private couch what any member may do one team at a time
// (set a picture only that couch sees); each row is recorded as set by them (source 'load'). Never run it for anyone else's couch,
// and never commit the pictures it makes (the repo is public).
//
//   node scripts/couch-team-pictures.js --couch <couch id> --by <username> --league football/nfl[,basketball/nba,...] [--dry-run] [--out <dir>]
//   node scripts/couch-team-pictures.js --couch <couch id> --remove        takes away every picture this script set on that couch
//   --couch only: the database's one couch (refused, listing them, when there are more); --by owner: that couch's owner
//
// For each team in each league: ESPN's team list (its default logo and its colour; the app's own reader drops logos on purpose),
// the logo downloaded once, composed into a finished 256 by 256 square (compose(), the plan's "Composition": the white caption
// plate, the logo contained in a box inset 10% top, left and right and 18% at the bottom, the team's colour on the cut corner),
// and saved with couch-pictures.ts setCouchPicture under the team's key (team:<league>:<ESPN id>, the key our badges carry).
// --by must be on the couch. --dry-run composes and writes nothing (--out saves the squares as files to look at, outside the repo).
//
// Needs: the database in .env.local (AUTH_DATABASE_URL), or set AUTH_DATABASE_URL for another one: production only with the owner's say-so.
// Talks to ESPN: one team list per league and one download per team (about 32 a league).
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local"), quiet: true });
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SIZE = 256;
// The composition (docs/PLAN-team-logos.md, "Composition", decided through impeccable 2026-11-22).
const BOX = { left: 0.1, top: 0.1, right: 0.1, bottom: 0.18 };
const CUT = { right: 0.68, bottom: 0.76 }; // the badge's cut: from 68% down the right edge to 76% along the bottom
const PLATE = "#ffffff";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const flag = (name) => process.argv.includes(`--${name}`);

/** A logo (any image bytes) and a team's colour (hex, no #) as the finished square: WebP bytes. */
async function compose(logo, color) {
  const box = { w: Math.round(SIZE * (1 - BOX.left - BOX.right)), h: Math.round(SIZE * (1 - BOX.top - BOX.bottom)) };
  const fitted = await sharp(logo).resize(box.w, box.h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const tag = /^[0-9a-f]{6}$/i.test(color ?? "") ? `#${color}` : "#4a4558";
  const corner = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><path d="M${SIZE} ${SIZE * CUT.right}L${SIZE} ${SIZE}L${SIZE * CUT.bottom} ${SIZE}Z" fill="${tag}"/></svg>`
  );
  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: PLATE } })
    .composite([
      { input: fitted, left: Math.round(SIZE * BOX.left), top: Math.round(SIZE * BOX.top) },
      { input: corner, left: 0, top: 0 },
    ])
    .webp({ quality: 90 })
    .toBuffer();
}

/** ESPN's teams in a league ("football/nfl"): id, name, colour and its default (light-ground) logo. */
async function espnTeams(league) {
  const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/teams?limit=1000`);
  if (!r.ok) throw new Error(`ESPN ${league}: ${r.status}`);
  const j = await r.json();
  const teams = j.sports?.[0]?.leagues?.[0]?.teams ?? [];
  return teams
    .map(({ team: t }) => {
      const logos = t.logos ?? [];
      const best = logos.find((l) => (l.rel ?? []).includes("default") && !(l.rel ?? []).includes("dark")) ?? logos.find((l) => !(l.rel ?? []).includes("dark")) ?? logos[0];
      return { id: String(t.id), name: t.displayName, color: t.color ?? null, logo: best?.href ?? null, active: t.isActive !== false };
    })
    .filter((t) => t.active && t.logo);
}

async function main() {
  let couch = arg("couch");
  if (!couch || (couch !== "only" && !/^[0-9a-f-]{36}$/i.test(couch))) throw new Error("say the couch: --couch <couch id> (or --couch only)");
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
  const { pool } = jiti("../src/lib/server/db.ts");
  try {
    if (couch === "only") {
      const { rows: all } = await pool.query("SELECT c.id, c.name, count(m.user_id)::int AS members FROM couches c LEFT JOIN couch_members m ON m.couch_id = c.id GROUP BY c.id ORDER BY c.created_at");
      if (all.length !== 1) throw new Error(`--couch only needs exactly one couch; there are ${all.length}: ${all.map((c) => `"${c.name}" (${c.members} members) ${c.id}`).join("; ")}`);
      couch = all[0].id;
    }
    const { rows: couches } = await pool.query("SELECT name FROM couches WHERE id = $1", [couch]);
    if (!couches[0]) throw new Error(`no couch ${couch}`);
    if (flag("remove")) {
      const { rowCount } = await pool.query("DELETE FROM couch_pictures WHERE couch_id = $1 AND source = 'load'", [couch]);
      console.log(`removed ${rowCount} pictures this script set on "${couches[0].name}"`);
      return;
    }
    const by = arg("by");
    const leagues = (arg("league") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!by || !leagues.length) throw new Error("say who and which leagues: --by <username> --league football/nfl[,...]");
    const { rows: who } = await pool.query(
      by === "owner"
        ? `SELECT m.user_id AS id FROM couch_members m WHERE m.couch_id = $2 AND m.role = 'owner' AND $1 = 'owner' ORDER BY m.joined_at NULLS LAST LIMIT 1`
        : `SELECT u.id FROM "user" u JOIN couch_members m ON m.user_id = u.id AND m.couch_id = $2 WHERE lower(u.username) = lower($1)`,
      [by, couch]
    );
    if (!who[0]) throw new Error(`${by} isn't on that couch`);
    const dry = flag("dry-run");
    const out = arg("out");
    if (out) fs.mkdirSync(out, { recursive: true });
    const { setCouchPicture, teamKey } = jiti("../src/lib/server/couch-pictures.ts");
    console.log(`${dry ? "(dry run) " : ""}team pictures into "${couches[0].name}", set by ${by}`);
    for (const league of leagues) {
      const teams = await espnTeams(league);
      let done = 0;
      const failed = [];
      for (const t of teams) {
        try {
          const r = await fetch(t.logo);
          if (!r.ok) throw new Error(`logo ${r.status}`);
          const square = await compose(Buffer.from(await r.arrayBuffer()), t.color);
          if (out) fs.writeFileSync(path.join(out, `${league.replace("/", "-")}-${t.id}.webp`), square);
          if (!dry) await setCouchPicture(couch, teamKey(league, t.id), { bytes: square, type: "image/webp" }, who[0].id, "load");
          done++;
        } catch (e) {
          failed.push(`${t.name}: ${e.message}`);
        }
      }
      console.log(`${league}: ${done} of ${teams.length}${failed.length ? `; not done: ${failed.join("; ")}` : ""}`);
    }
  } finally {
    await pool.end();
  }
}

module.exports = { compose, espnTeams };
if (require.main === module)
  main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  });
