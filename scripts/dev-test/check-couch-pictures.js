// Dev-only check of a couch's own team pictures (docs/PLAN-team-logos.md L4's store and L6's one-off load): who sees one, which one
// wins across two couches, replacing and taking one away, the badge's team key, and the load script's composition. Its pictures are
// made up here (a coloured disc with ZT on it), never a real team's logo.
//
//   node scripts/dev-test/check-couch-pictures.js [up | down] [--keep]
//
// Rows: three accounts zt_cp_ann, zt_cp_bo (on both couches) and zt_cp_out (on neither), couches "ZT pictures A" and "ZT pictures B",
// their members and pictures; every run removes the last run's first (down), and removes its own at the end unless --keep.
// Needs the local database only (it refuses any other): no app server, no ESPN.
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env.local"), quiet: true });
const path = require("path");
const sharp = require("sharp");

const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { pool } = jiti("../../src/lib/server/db.ts");
const pics = jiti("../../src/lib/server/couch-pictures.ts");
const { teamBadgeSrc, badgeTeamOf } = jiti("../../src/lib/sports/team-badge.ts");
const { compose } = require("../couch-team-pictures.js");

const USERS = ["zt_cp_ann", "zt_cp_bo", "zt_cp_out"];
const COUCHES = ["ZT pictures A", "ZT pictures B"];
const KEY = "team:football/zt-league:9101";
let failures = 0;
const check = (ok, what, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
};

async function down() {
  const { rows } = await pool.query("SELECT id FROM couches WHERE name = ANY($1)", [COUCHES]);
  if (rows.length) await pool.query("DELETE FROM couches WHERE id = ANY($1)", [rows.map((r) => r.id)]);
  await pool.query('DELETE FROM "user" WHERE username = ANY($1)', [USERS]);
  return rows.length;
}

async function up() {
  const id = {};
  for (const u of USERS) {
    id[u] = `zt-cp-${u.slice(6)}`;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'user', true, now(), now())`,
      [id[u], u, `${u}@example.test`]
    );
  }
  for (const [i, name] of COUCHES.entries()) {
    id[name] = (await pool.query("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [name, id.zt_cp_ann])).rows[0].id;
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'owner', 'couch')", [id[name], id.zt_cp_ann]);
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'member', 'couch')", [id[name], id.zt_cp_bo]);
    if (i === 1) await pool.query("DELETE FROM couch_members WHERE couch_id = $1 AND user_id = $2", [id[name], id.zt_cp_ann]);
  }
  return id;
}

/** A made-up logo: a disc in a colour with ZT on it (never a real team's). */
const madeUp = (fill) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><ellipse cx="150" cy="100" rx="140" ry="90" fill="${fill}"/><text x="150" y="125" font-size="80" text-anchor="middle" fill="#fff" font-family="Arial">ZT</text></svg>`)).png().toBuffer();

async function main() {
  const cmd = process.argv[2];
  if (!/localhost|127\.0\.0\.1/.test(process.env.AUTH_DATABASE_URL ?? "")) throw new Error("the local database only");
  const gone = await down();
  if (cmd === "down") return console.log(`down: removed ${gone} couches`);
  const id = await up();
  if (cmd === "up") return console.log(`up: ${COUCHES.join(", ")}`, id);
  const viewer = (u) => ({ id: id[u], role: "user" });
  const [A, B] = [id[COUCHES[0]], id[COUCHES[1]]];
  try {
    // The load script's composition: a finished square, small.
    const red = await compose(await madeUp("#c8102e"), "c8102e");
    const meta = await sharp(red).metadata();
    check(meta.width === 256 && meta.height === 256 && meta.format === "webp" && red.length < pics.COUCH_PICTURE_MAX, `the composition: a 256 by 256 WebP of ${red.length} bytes`, meta);
    const corner = await sharp(red).ensureAlpha().extract({ left: 252, top: 252, width: 1, height: 1 }).raw().toBuffer();
    const plate = await sharp(red).ensureAlpha().extract({ left: 8, top: 8, width: 1, height: 1 }).raw().toBuffer();
    check(corner[3] < 20 && plate[0] > 150 && plate[1] < 60 && plate[3] > 240, "the team's colour as the plate, its corner cut away as the badge's", { corner: [...corner], plate: [...plate] });

    // The badge carries its team.
    check(badgeTeamOf(teamBadgeSrc("ZTU", "c8102e", "ZT United", KEY)) === KEY && badgeTeamOf(teamBadgeSrc("ZTU", "c8102e")) === null && badgeTeamOf("https://x.test/a.png") === null, "a badge says its team; a photo or a badge without one says none");

    // One couch's picture: its members see it, nobody else does.
    const v1 = await pics.setCouchPicture(A, KEY, { bytes: red, type: "image/webp" }, id.zt_cp_ann, "load");
    const seen = await pics.couchPictureOf(viewer("zt_cp_ann"), A, KEY);
    check(v1 === 1 && seen && Buffer.compare(seen.bytes, red) === 0, "a member sees their couch's picture, byte for byte");
    check((await pics.couchPictureOf(viewer("zt_cp_out"), A, KEY)) === null, "someone not on the couch doesn't");
    const out = await pics.yourTeamPictures(id.zt_cp_out);
    check(Object.keys(out).length === 0, "and their team pictures are none", out);
    const ann = await pics.yourTeamPictures(id.zt_cp_ann);
    check(ann[KEY] === `/api/couches/${A}/pictures?key=${encodeURIComponent(KEY)}&v=1`, "a member's team pictures link it, with its version", ann);

    // Replaced: a new version, so phones fetch it again.
    await pics.setCouchPicture(A, KEY, { bytes: await compose(await madeUp("#0b162a"), "0b162a"), type: "image/webp" }, id.zt_cp_bo, "upload");
    check((await pics.yourTeamPictures(id.zt_cp_ann))[KEY]?.endsWith("&v=2"), "set again, it's version 2");

    // Two couches with the same team: the one the hub shows wins, else the newest.
    await pics.setCouchPicture(B, KEY, { bytes: red, type: "image/webp" }, id.zt_cp_bo, "upload");
    check((await pics.yourTeamPictures(id.zt_cp_bo))[KEY]?.startsWith(`/api/couches/${B}/`), "on two couches, the newest picture wins");
    await pool.query("INSERT INTO user_settings (user_id, hub_couch) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET hub_couch = $2", [id.zt_cp_bo, A]);
    check((await pics.yourTeamPictures(id.zt_cp_bo))[KEY]?.startsWith(`/api/couches/${A}/`), "unless the hub shows the other couch: its picture wins");

    // Refused: a key that isn't a team's, too big.
    const refused = async (f) => f().then(() => false, () => true);
    check(await refused(() => pics.setCouchPicture(A, "team:../../x", { bytes: red, type: "image/webp" }, id.zt_cp_ann, "upload")), "a key that isn't a team's is refused");
    check(await refused(() => pics.setCouchPicture(A, KEY, { bytes: Buffer.alloc(pics.COUCH_PICTURE_MAX + 1), type: "image/webp" }, id.zt_cp_ann, "upload")), "a picture over 100 KB is refused");
    check(await refused(() => pics.setCouchPicture(A, KEY, { bytes: red, type: "image/svg+xml" }, id.zt_cp_ann, "upload")), "an SVG is refused (it could carry script)");

    // Taken away: the badge shows again.
    check((await pics.removeCouchPicture(A, KEY)) && (await pics.couchPictureOf(viewer("zt_cp_ann"), A, KEY)) === null, "taken away, nobody sees it");
  } finally {
    if (!process.argv.includes("--keep")) await down();
    await pool.end();
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
