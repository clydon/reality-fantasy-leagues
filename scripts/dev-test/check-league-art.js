// Dev-only: a league's art for the couch, through the real routes (docs/design-round/league-art-spec.md; src/lib/server/league-art.ts;
// the user, 2026-11-23: "per user but me as the admin can set it for everyone… everyone in my couch sees art without action on their
// end, if they want to change it they can", and uploads). On new-fixture.js's zt_nd couch (alex owns it; riley, jordan, sam and
// casey are on it) and a made-up league key (no sports data needed):
//   - nobody has chosen: nobody's pick for the couch
//   - riley (a member) chooses: the couch follows riley (the first member to choose), and jordan, who hasn't, sees riley's pick
//   - alex (the owner) chooses: the couch follows alex; riley's own choice still wins for riley
//   - alex uploads a picture (a real JPEG; a PNG's bytes sent as a JPEG pass too: the bytes are what's checked): it's alex's choice and
//     the couch's, jordan can read it, it's refused with no session (401); text sent as a picture is refused (415), too big (413)
//   - a baseball league can't take football's photo, nor "upload" without a picture (400)
//   - alex removes the picture: the couch falls back to riley's pick, alex's choice of it is gone
// Every choice and picture it made is taken away after (also before, in case a run stopped partway).
// Needs: the app (BASE, default :3000) and the zt_nd couch up (census-app.js --up, or new-fixture.js up).
// Run:   node scripts/dev-test/check-league-art.js
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const sharp = require("sharp");
const { api, BASE } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-league-art runs against a local database only");
const LEAGUE = "football/zt-art";
const OTHER = "baseball/zt-art";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)})` : ""}`);
  if (!ok) failures++;
}

async function cleanup(pool) {
  await pool.query("DELETE FROM league_art_pictures WHERE league LIKE '%/zt-art'");
  await pool.query("UPDATE user_settings SET league_art = league_art - $1 - $2 WHERE league_art ?| ARRAY[$1, $2]", [LEAGUE, OTHER]);
}

async function main() {
  const pool = new Pool({ connectionString: DB });
  await cleanup(pool);
  try {
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (!couch) throw new Error("the zt_nd couch isn't up (census-app.js --up, or new-fixture.js up)");
    const as = (who) => api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const [alex, riley, jordan] = await Promise.all([as("alex"), as("riley"), as("jordan")]);
    const ids = Object.fromEntries((await pool.query(`SELECT username, id FROM "user" WHERE username = ANY($1)`, [["alex", "riley"].map(fixture.username)])).rows.map((r) => [r.username.replace(/^zt_nd_/, ""), r.id]));
    const state = async (who) => (await who.call("GET", `/api/me/league-art?couch=${couch}`)).body;
    const choose = (who, league, art) => who.call("PUT", `/api/me/league-art?couch=${couch}`, { league, art });

    check(!(await state(jordan)).couch[LEAGUE], "nobody has chosen: nobody's pick for the couch");

    await choose(riley, LEAGUE, "event-night-v1");
    let j = await state(jordan);
    check(j.couch[LEAGUE]?.by === ids.riley && j.couch[LEAGUE]?.art === "event-night-v1" && !j.mine[LEAGUE], "a member chooses first: the couch follows them, and someone who hasn't chosen sees it", j.couch[LEAGUE]);

    await choose(alex, LEAGUE, "football-night-v1");
    j = await state(jordan);
    const r = await state(riley);
    check(j.couch[LEAGUE]?.by === ids.alex && j.couch[LEAGUE]?.art === "football-night-v1", "the owner chooses: the couch follows the owner", j.couch[LEAGUE]);
    check(r.mine[LEAGUE] === "event-night-v1", "a member's own choice stays theirs", r.mine);

    // A real JPEG, as the browser makes one (1280 by 720).
    const jpeg = await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#2a6b4f" } }).jpeg({ quality: 80 }).toBuffer();
    const up = await alex.raw("PUT", `/api/me/league-art?league=${encodeURIComponent(LEAGUE)}&couch=${couch}`, { body: jpeg, type: "image/jpeg" });
    const upBody = await up.json().catch(() => ({}));
    check(up.status === 200 && upBody.mine?.[LEAGUE] === "upload" && upBody.pictures?.[LEAGUE] > 0, "the owner uploads a picture: it's their choice", { status: up.status, mine: upBody.mine });
    j = await state(jordan);
    const pic = j.couch[LEAGUE];
    check(pic?.art === "upload" && pic?.by === ids.alex && pic?.picture === upBody.pictures?.[LEAGUE], "and the couch's: the owner's picture, with its version", pic);
    const url = `/api/people/${encodeURIComponent(ids.alex)}/league-art?league=${encodeURIComponent(LEAGUE)}&v=${pic?.picture}`;
    const seen = await jordan.raw("GET", url);
    check(seen.status === 200 && seen.headers.get("content-type") === "image/jpeg" && /private/.test(seen.headers.get("cache-control") ?? ""), "someone on the couch can see it (private, kept by version)", { status: seen.status, type: seen.headers.get("content-type") });
    const anon = await fetch(BASE + url);
    check(anon.status === 401, "nobody signed in can't (401)", anon.status);

    const text = await alex.raw("PUT", `/api/me/league-art?league=${encodeURIComponent(LEAGUE)}`, { body: Buffer.from("<svg onload=alert(1)>"), type: "image/jpeg" });
    check(text.status === 415, "text sent as a picture is refused (415)", text.status);
    const big = await alex.raw("PUT", `/api/me/league-art?league=${encodeURIComponent(LEAGUE)}`, { body: Buffer.concat([jpeg.subarray(0, 3), Buffer.alloc(420 * 1024)]), type: "image/jpeg" });
    check(big.status === 413, "a picture over 400 KB is refused (413)", big.status);
    const wrong = await choose(alex, OTHER, "football-night-v1");
    const noPic = await choose(riley, LEAGUE, "upload");
    check(wrong.status === 400 && noPic.status === 400, "a baseball league can't wear football's photo, nor 'upload' without a picture (400)", [wrong.status, noPic.status]);

    const gone = await alex.raw("DELETE", `/api/me/league-art?league=${encodeURIComponent(LEAGUE)}&couch=${couch}`);
    const goneBody = await gone.json().catch(() => ({}));
    j = await state(jordan);
    check(gone.status === 200 && !goneBody.pictures?.[LEAGUE] && !goneBody.mine?.[LEAGUE] && j.couch[LEAGUE]?.by === ids.riley, "the owner removes it: their choice of it goes, and the couch falls back to the first member's pick", { mine: goneBody.mine, couch: j.couch[LEAGUE] });
    check((await jordan.raw("GET", url)).status === 404, "the removed picture isn't served (404)");
  } finally {
    await cleanup(pool);
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
