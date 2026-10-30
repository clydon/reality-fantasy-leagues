// Dev-only check for a show's Art and photos on the desk (docs/PLAN-desk-parity.md part 7b), against this lane's dev server,
// on a fixture of its own (zt_da_ people; ZT DA Isle, a game on TMDB's stand-in with two seasons, the newer airing with a cast
// and two photos, a follower and a game; ZT DA Bare, not on TMDB, with nothing), with TMDB's stand-in (fake-tmdb.js, the
// x-gys-tmdb header) and the browser's images served by the check itself (page.route): nothing asks TMDB.
//   1. Only site admins: zt_da_oz (a player) is refused it.
//   2. What a show has, per frame: the Header (its backdrop) and the Cards (its newest season's own poster), where each is
//      from, its framing, held or not; Cast photos by season.
//   3. A link per frame (Noticed x): the header's link leaves the cards on TMDB and the finder still fills the cards; the cards'
//      link shows on every season over its own poster and leaves the header alone; a bad address refused; History and Undo.
//   4. Framing per frame: refused on an image that's changed, saved on the one drawn, carried to every reader (the season's
//      header, the catalog, classic's own only for its own poster), a new image starting unframed, classic's colour kept.
//   5. TMDB, on its own: a link goes, the finder's pick comes; refused when it's on its own already. Choose one from TMDB
//      (the header's backdrops, a season's poster), held by hand. Undo, refused once something's changed since.
//   6. No art or photos: everything down (found photos too), every reader empty; Undo brings the art back and looks again.
//      Find art and photos again: a line in History.
//   7. Screens at --width: the show's About row; the art page (both frames' crops, Where it's from, Framing, Cast photos to
//      each Cast page, Find again, the switch, History, the show's Delete last); A link (a bad address, then one loaded and
//      previewed, used); Framing (dragged, the arrow keys, zoomed, every crop redrawn, Back to the middle, saved); Choose one
//      from TMDB; TMDB, on its own; the switch off and back; the player's show bar drawing the framing; nothing wider than the
//      screen.
//   8. Nothing real moved: every account, league and show that isn't zt_ is as it was.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                   (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-art.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-art.js --down             (takes the fixture down, nothing else)
//
// up/down: zt_da_ accounts (their sessions, seats, couch rows and follows), the ZT DA couch, the zt-da- shows (their seasons,
// cast and follows go with them) and game, and the admin_changes lines on them; --keep leaves the fixture up. Its join code
// starts Z7A (no real one may: it refuses to run if one does). Refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-art runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-art.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_da_${k}`;
const COUCH = "ZT DA Couch";
const ISLE = ["zt-da-isle", "ZT DA Isle"];
const BARE = ["zt-da-bare", "ZT DA Bare"];
const PREFIX = "Z7A";
const IMG = "https://image.tmdb.org/t/p";
const LINK = "https://images.zt-art.example.com/survivor/key-art.jpg";
const CARDS_LINK = "https://images.zt-art.example.com/survivor/cards.png";
const NOT_AN_IMAGE = "https://images.zt-art.example.com/survivor/page.html";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  const { rows: shows } = await pool.query("SELECT id FROM shows WHERE slug LIKE 'zt-da-%'");
  const { rows: games } = await pool.query("SELECT id FROM leagues WHERE slug LIKE 'zt-da-%' OR state->'settings'->>'showId' LIKE 'zt-da-%'");
  await pool.query(
    `DELETE FROM admin_changes WHERE (entity = 'show' AND entity_id = ANY($1)) OR (entity = 'game' AND entity_id = ANY($2))
        OR user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_da\\_%')`,
    [shows.map((r) => r.id), games.map((r) => r.id)]
  );
  await pool.query(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_da\\_%')`);
  await pool.query("DELETE FROM leagues WHERE id = ANY($1::uuid[])", [games.map((r) => r.id)]);
  await pool.query("DELETE FROM couches WHERE name LIKE 'ZT DA %'");
  await pool.query("DELETE FROM shows WHERE slug LIKE 'zt-da-%'");
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_da\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { rows: clash } = await pool.query("SELECT 1 FROM leagues WHERE join_code LIKE $1", [`${PREFIX}%`]);
  if (clash.length) throw new Error(`a league outside the fixture has a code starting ${PREFIX}: the check can't run here`);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-da-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now(), now())`,
      [id, U(k), `${U(k)}@zt-da.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  };
  await add("desk", { role: "admin" });
  for (const k of ["kim", "oz"]) await add(k);
  await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[ids.desk, ids.kim, ids.oz]]);

  // ZT DA Isle: on TMDB (the stand-in's show), its art found there; classic's colour on its poster.
  ids.isle = (
    await pool.query(
      `INSERT INTO shows (slug, name, kind, format, set_up_at, tmdb_id, art_url, backdrop_url, art_style, art_checked_at, castaway_term, tribe_term)
       VALUES ($1, $2, 'competition', 'survivor', now(), 990901, $3, $4, '{"color": 0.5}', now(), 'Castaway', 'Tribe') RETURNING id`,
      [ISLE[0], ISLE[1], `${IMG}/w500/zt-da-show.jpg`, `${IMG}/w1280/zt-da-back-0.jpg`]
    )
  ).rows[0].id;
  ids.isle1 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, status, art_url) VALUES ($1, 1, 'completed', NULL) RETURNING id", [ids.isle])).rows[0].id;
  ids.isle2 = (
    await pool.query("INSERT INTO show_seasons (show_id, season_number, status, art_url, photos_checked_at) VALUES ($1, 2, 'airing', $2, now()) RETURNING id", [ids.isle, `${IMG}/w500/zt-da-s2.jpg`])
  ).rows[0].id;
  for (const [i, [name, photo]] of [
    ["Zed Vee", `${IMG}/w185/zt-da-face-a.jpg`],
    ["Zoe Vale", `${IMG}/w185/zt-da-face-b.jpg`],
    ["Zack Vo", null],
  ].entries())
    await pool.query("INSERT INTO season_cast (season_id, name, tribe_name, sort_order, photo_url) VALUES ($1, $2, 'Red', $3, $4)", [ids.isle2, name, i, photo]);
  await pool.query("INSERT INTO show_follows (user_id, season_id) VALUES ($1, $2)", [ids.kim, ids.isle2]);
  // ZT DA Bare: not on TMDB, nothing found.
  ids.bare = (await pool.query("INSERT INTO shows (slug, name, kind, format, set_up_at, art_checked_at) VALUES ($1, $2, 'competition', 'survivor', now(), now()) RETURNING id", BARE)).rows[0].id;
  ids.bare1 = (await pool.query("INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, 1, 'upcoming') RETURNING id", [ids.bare])).rows[0].id;

  ids.couch = (await pool.query("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [COUCH, ids.kim])).rows[0].id;
  await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'owner', 'couch')", [ids.couch, ids.kim]);
  const s = S.defaultState();
  s.players = [{ id: "p1", name: U("kim"), color: "#5089c9", disabled: false, active: true }];
  s.draftOrder = ["p1"];
  Object.assign(s.settings, { leagueTypeId: "pickem", showId: ISLE[0], wikiSeason: "2" });
  ids.game = (
    await pool.query("INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id) VALUES ('ZT DA Picks', 'zt-da-picks', $1, $2, $3, $4) RETURNING id", [
      `${PREFIX}${crypto.randomBytes(2).toString("hex").toUpperCase().replace(/[01IO]/g, "Z")}`,
      S.migrateLeagueState(s),
      ids.kim,
      ids.couch,
    ])
  ).rows[0].id;
  await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'p1', 'commissioner')", [ids.game, ids.kim]);
  return ids;
}

const REAL_USERS = `SELECT md5(string_agg(id || coalesce(username, '') || email || coalesce(role, '') || approved::text, ',' ORDER BY id)) AS h
  FROM "user" WHERE username IS NULL OR username NOT LIKE 'zt\\_%'`;
const REAL_LEAGUES = `SELECT md5(string_agg(id || name || join_code || md5(state::text) || coalesce(deleted_at::text, ''), ',' ORDER BY id)) AS h FROM leagues WHERE slug NOT LIKE 'zt-%'`;
const REAL_SHOWS = `SELECT md5(string_agg(s.id || s.name || coalesce(s.art_url, '') || coalesce(s.backdrop_url, '') || coalesce(s.art_style::text, '') || s.art_by_hand::text
    || s.backdrop_by_hand::text || s.art_link::text || s.art_off::text || coalesce(s.backdrop_style::text, '')
    || (SELECT coalesce(string_agg(coalesce(ss.art_url, '') || ss.art_by_hand::text, ' ' ORDER BY ss.id), '') FROM show_seasons ss WHERE ss.show_id = s.id), ',' ORDER BY s.id)) AS h
  FROM shows s WHERE s.slug NOT LIKE 'zt-%'`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_da_ fixture down");
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  const before = await Promise.all([REAL_USERS, REAL_LEAGUES, REAL_SHOWS].map(async (q) => (await pool.query(q)).rows[0].h));
  const tmdb = await require("./fake-tmdb").start();
  const closers = [() => tmdb.close()];
  const H = { "x-gys-tmdb": tmdb.url };
  try {
    const ids = await up(pool);
    const as = {
      desk: await api({ user: U("desk"), pass: PASSWORD, headers: H }),
      kim: await api({ user: U("kim"), pass: PASSWORD }),
      oz: await api({ user: U("oz"), pass: PASSWORD }),
    };
    const undo = (id) => as.desk.call("POST", `/api/desk/changes/${id}/undo`, {});
    const get = async (id = ids.isle) => (await as.desk.call("GET", `/api/desk/shows/${id}`)).body;
    const art = (a, id = ids.isle) => as.desk.call("POST", `/api/desk/shows/${id}`, { art: a });
    const row = async (id = ids.isle) => (await pool.query("SELECT * FROM shows WHERE id = $1", [id])).rows[0];
    const header = async (sid = ids.isle2) => (await as.kim.call("GET", `/api/seasons/${sid}/space`)).body?.show ?? {};
    const catalog = async (sid = ids.isle2) => ((await as.kim.call("GET", "/api/catalog")).body.seasons || []).find((x) => x.seasonId === sid) ?? {};
    const classic = async () => ((await as.kim.call("GET", "/api/shows")).body.shows || []).find((x) => x.slug === ISLE[0]) ?? {};
    const lines = async () => (await get()).history.map((l) => l.text);

    // ---- 1. only site admins ----
    let r = await as.oz.call("GET", `/api/desk/shows/${ids.isle}`);
    check(r.status === 403, "a player is refused a show's art", String(r.status));
    r = await as.oz.call("POST", `/api/desk/shows/${ids.isle}`, { art: { find: true } });
    check(r.status === 403, "a player can't change it", String(r.status));

    // ---- 2. what it has ----
    let s = await get();
    check(
      s.art.header.url === `${IMG}/w1280/zt-da-back-0.jpg` && s.art.header.source === "tmdb" && s.art.header.frame === null && !s.art.header.held,
      "the header: its backdrop, TMDB's, unframed",
      JSON.stringify(s.art.header)
    );
    check(
      s.art.cards.url === `${IMG}/w500/zt-da-s2.jpg` && s.art.cards.source === "tmdb" && s.art.cards.season === "ZT DA Isle 2" && !s.art.cards.held,
      "the cards: its newest season's own poster, TMDB's",
      JSON.stringify(s.art.cards)
    );
    check(
      JSON.stringify(s.art.photos.map((p) => [p.number, p.cast, p.with])) === JSON.stringify([[2, 3, 2], [1, 0, 0]]),
      "cast photos by season, newest first: 2 of 3, then no cast",
      JSON.stringify(s.art.photos)
    );
    let b = await get(ids.bare);
    check(b.art.header.source === "none" && b.art.cards.source === "none" && !b.art.cards.url, "a show with nothing: none in either frame", JSON.stringify([b.art.header, b.art.cards]));

    // ---- 3. a link per frame ----
    r = await art({ frame: "header", link: "http://images.zt-art.example.com/x.jpg" });
    check(r.status === 400, "a link that isn't https is refused", JSON.stringify(r.body));
    r = await art({ frame: "header", link: "not a link at all" });
    check(r.status === 400, "an address that isn't one is refused", String(r.status));
    r = await art({ frame: "header", link: LINK });
    const headerLinkId = r.body.changeId;
    s = r.body;
    let sr = await row();
    check(r.status === 200 && s.art.header.source === "link" && s.art.header.url === LINK && sr.backdrop_by_hand && !sr.art_by_hand, "the header from a link: held, the poster not", JSON.stringify([r.status, s.art?.header]));
    check(s.art.cards.source === "tmdb" && s.art.cards.url === `${IMG}/w500/zt-da-s2.jpg`, "a link on the header leaves the cards on TMDB", JSON.stringify(s.art.cards));
    check((await lines())[0] === "Header from a link: images.zt-art.example.com", "a line in History", (await lines())[0]);
    check((await header()).backdropUrl === LINK, "the season's header reads the link");
    // The finder still fills the cards (and leaves the header's link).
    r = await art({ find: true });
    sr = await row();
    check(r.status === 200 && sr.backdrop_url === LINK && sr.art_url === `${IMG}/w500/zt-da-poster-1.jpg`, "Find again: the header's link stays, the poster is TMDB's best", JSON.stringify([sr.backdrop_url, sr.art_url]));
    check(tmdb.asked.some((x) => x.startsWith(`/tv/${tmdb.SHOW}/images`)) && /^Looked for art and photos/.test((await lines())[0]), "Find again asked TMDB's stand-in, a line in History", (await lines())[0]);

    // the cards' link: over every season's own poster, the header left alone
    r = await art({ frame: "cards", link: CARDS_LINK });
    const cardsLinkId = r.body.changeId;
    sr = await row();
    check(r.status === 200 && r.body.art.cards.source === "link" && r.body.art.cards.url === CARDS_LINK && sr.art_link && sr.art_by_hand, "the cards from a link", JSON.stringify(r.body.art?.cards));
    check(r.body.art.header.url === LINK, "a link on the cards leaves the header alone");
    check((await header()).artUrl === CARDS_LINK && (await header(ids.isle1)).artUrl === CARDS_LINK, "every season's cards read it, over its own poster", (await header()).artUrl);
    check((await catalog()).artUrl === CARDS_LINK, "the catalog reads it too");
    r = await art({ find: true });
    sr = await row();
    check(sr.art_url === CARDS_LINK && sr.backdrop_url === LINK, "Find again leaves both links");

    // ---- 4. framing per frame ----
    r = await art({ frame: "header", x: 20, y: 40, zoom: 1.5, url: `${IMG}/w1280/zt-da-back-0.jpg` });
    check(r.status === 409, "framing an image that isn't drawn any more is refused", JSON.stringify(r.body));
    r = await art({ frame: "header", x: 20, y: 40, zoom: 1.4, url: LINK });
    check(r.status === 400, "a zoom that isn't one of the four is refused", String(r.status));
    r = await art({ frame: "header", x: 20, y: 40, zoom: 1.5, url: LINK });
    const headerFrameId = r.body.changeId;
    sr = await row();
    check(r.status === 200 && JSON.stringify(r.body.art.header.frame) === JSON.stringify({ x: 20, y: 40, zoom: 1.5 }), "the header framed", JSON.stringify(r.body.art?.header));
    check(JSON.stringify(sr.backdrop_style) === JSON.stringify({ x: 20, y: 40, url: LINK, zoom: 1.5 }), "kept with the image it frames", JSON.stringify(sr.backdrop_style));
    check((await header()).backdropUrl === `${LINK}#frame=20,40,1.5`, "the season's header carries it", (await header()).backdropUrl);
    check((await lines())[0] === "Framing of its header: 20% across, 40% down · 1.5× zoom", "a line in History", (await lines())[0]);
    r = await art({ frame: "cards", x: 8, y: 50, zoom: 1, url: CARDS_LINK });
    sr = await row();
    check(r.status === 200 && sr.art_style.color === 0.5 && sr.art_style.frame?.x === 8 && sr.art_style.frame?.url === CARDS_LINK && sr.art_style.x === undefined, "the cards framed (the desk's, under frame), classic's colour kept", JSON.stringify(sr.art_style));
    check((await header()).artUrl === `${CARDS_LINK}#frame=8,50,1` && (await catalog()).artUrl === `${CARDS_LINK}#frame=8,50,1` && (await catalog()).artPosition === "8% 50%", "the cards' readers carry it", JSON.stringify([(await header()).artUrl, (await catalog()).artPosition]));
    let c = await classic();
    check(c.art_style?.x === 8 && c.art_style?.color === 0.5, "classic reads it: it frames the show's own poster", JSON.stringify(c.art_style));
    r = await undo(headerFrameId);
    check(r.status === 409, "Undo of the header's framing, refused once the art moved since", JSON.stringify(r.body));

    // ---- 5. TMDB, on its own; Choose one from TMDB; Undo ----
    r = await art({ frame: "cards", tmdb: true });
    sr = await row();
    check(r.status === 200 && !sr.art_link && !sr.art_by_hand && sr.art_url === `${IMG}/w500/zt-da-poster-1.jpg`, "cards back to TMDB: the link goes, TMDB's poster comes", JSON.stringify([sr.art_url, sr.art_link]));
    check(r.body.art.cards.url === `${IMG}/w500/zt-da-s2-poster-1.jpg` && r.body.art.cards.frame === null, "the season's own poster again (the finder's), unframed: a new image", JSON.stringify(r.body.art.cards));
    check(!(await header()).artUrl.includes("#frame"), "its readers carry no framing now");
    c = await classic();
    check(c.art_style?.x === undefined && c.art_style?.color === 0.5, "classic leaves out a framing set for another image, keeps its colour", JSON.stringify(c.art_style));
    check(r.body.art.header.url === LINK && r.body.art.header.source === "link", "the header's link stays");
    r = await art({ frame: "cards", tmdb: true });
    check(r.status === 409, "TMDB, on its own when it is already: refused", JSON.stringify(r.body));
    r = await undo(cardsLinkId);
    check(r.status === 409, "Undo of the cards' link, refused once they've changed since", JSON.stringify(r.body));

    // Choose one from TMDB: the header's backdrops
    r = await as.desk.call("GET", `/api/desk/shows/${ids.isle}/art?season=${ids.isle2}`);
    const backdrops = (r.body.show || []).filter((x) => x.kind === "backdrop");
    check(r.status === 200 && backdrops.length === 3 && r.body.season.length === 2, "Choose art: the stand-in's backdrops and the season's posters", JSON.stringify([r.status, backdrops.length, r.body.season?.length]));
    r = await art({ choose: { backdrop: backdrops[2].url } });
    const chooseId = r.body.changeId;
    sr = await row();
    check(r.status === 200 && sr.backdrop_url === backdrops[2].url && sr.backdrop_by_hand && r.body.art.header.source === "chosen" && r.body.art.header.frame === null, "a backdrop chosen: held, unframed", JSON.stringify(r.body.art?.header));
    check((await lines())[0] === "Chose the header's image from TMDB", "a line in History", (await lines())[0]);
    r = await art({ choose: { backdrop: "https://elsewhere.example.com/x.jpg" } });
    check(r.status === 400, "Choose art takes TMDB's images only", String(r.status));
    r = await art({ choose: { seasonId: ids.isle2, seasonPoster: `${IMG}/w500/zt-da-s2-poster-2.jpg` } });
    check(r.status === 200 && r.body.art.cards.source === "chosen" && r.body.art.cards.url === `${IMG}/w500/zt-da-s2-poster-2.jpg` && r.body.art.cards.held, "a season's poster chosen: the cards held", JSON.stringify(r.body.art?.cards));
    // Framing a season's poster leaves classic's own framing of the show's poster (drawn wherever that poster is) as it was
    await pool.query(`UPDATE shows SET art_style = art_style || '{"y": 88}' WHERE id = $1`, [ids.isle]);
    r = await art({ frame: "cards", x: 30, y: 50, zoom: 1.25, url: `${IMG}/w500/zt-da-s2-poster-2.jpg` });
    sr = await row();
    c = await classic();
    check(
      r.status === 200 && sr.art_style.y === 88 && sr.art_style.frame?.url === `${IMG}/w500/zt-da-s2-poster-2.jpg` && c.art_style?.y === 88 && c.art_style?.x === undefined,
      "a season's poster framed: classic's framing of the show's poster kept, and classic reads only its own",
      JSON.stringify([sr.art_style, c.art_style])
    );
    check((await header()).artUrl === `${IMG}/w500/zt-da-s2-poster-2.jpg#frame=30,50,1.25` && !(await header(ids.isle1)).artUrl?.includes("#frame=30"), "the season's cards framed, another season's not", JSON.stringify([(await header()).artUrl, (await header(ids.isle1)).artUrl]));
    // TMDB, on its own for the header: the finder's best backdrop, the cards still held
    r = await art({ frame: "header", tmdb: true });
    sr = await row();
    check(r.status === 200 && !sr.backdrop_by_hand && sr.backdrop_url === `${IMG}/w1280/zt-da-back-1.jpg` && r.body.art.cards.source === "chosen", "the header back to TMDB's best, the cards still chosen", JSON.stringify([sr.backdrop_url, r.body.art?.cards?.source]));
    // Undo of the choose: refused (the header moved since); Undo of the latest (TMDB, on its own) puts the chosen one back
    r = await undo(chooseId);
    check(r.status === 409, "Undo refused once the art moved on", JSON.stringify(r.body));
    const latest = (await pool.query("SELECT id FROM admin_changes WHERE entity = 'show' AND entity_id = $1 AND action = 'artTmdb' ORDER BY created_at DESC LIMIT 1", [ids.isle])).rows[0].id;
    r = await undo(latest);
    sr = await row();
    check(r.status === 200 && sr.backdrop_url === backdrops[2].url && sr.backdrop_by_hand, "Undo: the chosen backdrop back, held", JSON.stringify([r.status, sr.backdrop_url]));
    r = await undo(headerLinkId);
    check(r.status === 409, "an old Undo stays refused", String(r.status));

    // ---- 6. No art or photos, Undo, Find again ----
    tmdb.cast = ["Zed Vee", "Zoe Vale", "Zack Vo"];
    r = await art({ off: true });
    const offId = r.body.changeId;
    sr = await row();
    const photos = async () => (await pool.query("SELECT count(*) FILTER (WHERE COALESCE(photo_url, '') <> '')::int AS n FROM season_cast WHERE season_id = $1", [ids.isle2])).rows[0].n;
    check(r.status === 200 && sr.art_off && !sr.art_url && !sr.backdrop_url && !sr.backdrop_by_hand && !sr.art_link && (await photos()) === 0, "No art or photos: all of it down, found photos too", JSON.stringify([sr.art_off, sr.art_url, await photos()]));
    check(r.body.art.header.source === "none" && r.body.art.cards.source === "none" && (await header()).artUrl === null && (await header()).backdropUrl === null, "every reader empty");
    check(/^No art or photos · its name on a plain card · 2 found photos down$/.test(r.body.text), "its toast says so", r.body.text);
    r = await art({ frame: "header", link: LINK });
    check(r.status === 409, "nothing set while it's off", JSON.stringify(r.body));
    r = await art({ find: true });
    check(r.status === 409, "nor looked for", String(r.status));
    r = await undo(offId);
    sr = await row();
    check(r.status === 200 && !sr.art_off && sr.backdrop_url === backdrops[2].url && sr.backdrop_by_hand, "Undo: back on as it was", JSON.stringify([sr.art_off, sr.backdrop_url]));
    check((await photos()) === 3, "and the photos looked for again (the stand-in has all three now)", String(await photos()));
    r = await art({ off: true });
    r = await art({ off: false });
    sr = await row();
    check(r.status === 200 && !sr.art_off && sr.backdrop_url === `${IMG}/w1280/zt-da-back-1.jpg` && sr.art_url === `${IMG}/w500/zt-da-poster-1.jpg`, "off, then back on: the finder's art again", JSON.stringify([sr.backdrop_url, sr.art_url]));
    r = await art({ off: false });
    check(r.status === 409, "on when it's on: refused", String(r.status));

    // ---- 7. screens ----
    const dsk = await open({ user: U("desk"), pass: PASSWORD, width, height: 844, headers: H });
    closers.push(dsk.close);
    const failed = [];
    dsk.page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    const pictures = async (page) => {
      await page.route(/^https:\/\/image\.tmdb\.org\//, (route) => route.fulfill({ status: 200, contentType: "image/svg+xml", body: tmdb.picture(route.request().url()) }));
      await page.route(/^https:\/\/images\.zt-art\.example\.com\//, (route) => {
        const u = route.request().url();
        return /\.html$/.test(u) ? route.fulfill({ status: 200, contentType: "text/html", body: "<p>a page</p>" }) : route.fulfill({ status: 200, contentType: "image/svg+xml", body: tmdb.picture(u) });
      });
      await page.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const st = document.createElement("style");
          st.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(st);
        });
      });
    };
    await pictures(dsk.page);
    const pg = dsk.page;
    let n = 0;
    const shot = async (name, full = false) => {
      await pg.waitForTimeout(350);
      await Promise.race([settle(pg), pg.waitForTimeout(3000)]);
      await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`), fullPage: full });
    };
    const fits = async (where) => {
      const wide = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    const toasted = async (re) => {
      try {
        await pg.waitForFunction((src) => new RegExp(src).test(document.querySelector("[data-toast]")?.textContent || ""), re.source, { timeout: 20000 });
      } catch {
        /* read what's there */
      }
      return ((await pg.locator("[data-toast]").textContent().catch(() => "")) || "").trim();
    };
    const sheet = () => pg.locator("[role=dialog][data-open]").last();
    const rowLine = async (k) => ((await pg.locator(`[data-desk-row='${k}'] small`).first().innerText().catch(() => "")) || "").trim();
    const mainCrop = (k) => pg.locator(`[data-crops='${k}'] img`).first();
    closers.unshift(async () => {
      if (failures) await pg.screenshot({ path: path.join(out, `zz-last-${width}.png`), fullPage: true }).catch(() => {});
    });

    // the show's About row
    await pg.goto(`${BASE}/desk/show/${ids.isle}`);
    await pg.locator("[data-desk-row='show-art']").waitFor({ timeout: 60000 });
    check(/From TMDB, on its own · header, cards and cast photos/.test(await rowLine("show-art")), "the show's Art and photos row", await rowLine("show-art"));
    check((await pg.locator("[data-desk-art]").count()) === 0, "the show's page has no art section of its own now");
    await pg.locator("[data-desk-row='show-art']").click();
    await pg.locator("[data-desk-art]").waitFor({ timeout: 30000 });
    check(pg.url().endsWith(`/desk/show/${ids.isle}/art`), "it opens the show's Art and photos page", pg.url());
    await pg.waitForFunction(() => [...document.querySelectorAll("[data-crops] img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
    check((await pg.locator("[data-crops='header'] figure").count()) === 2 && (await pg.locator("[data-crops='cards'] figure").count()) === 2, "each frame drawn in the two crops it's used in");
    check(
      /Its page\s*Up next/i.test(await pg.locator("[data-crops='header']").innerText()) && /Your shows\s*The guide/i.test(await pg.locator("[data-crops='cards']").innerText()),
      "the crops named where they're used"
    );
    check(/TMDB, on its own · a backdrop without words first/.test(await rowLine("art-header-source")) && /Centred|50% across, 30% down/.test(await rowLine("art-header-frame")), "the header's rows", `${await rowLine("art-header-source")} | ${await rowLine("art-header-frame")}`);
    check(/TMDB, on its own · each season's own poster/.test(await rowLine("art-cards-source")) && (await rowLine("art-cards-frame")) === "Centred", "the cards' rows", `${await rowLine("art-cards-source")} | ${await rowLine("art-cards-frame")}`);
    check(/3 of 3 have photos · TMDB and TVmaze/.test(await rowLine("art-photos-2")) && /No cast yet/.test(await rowLine("art-photos-1")), "Cast photos by season", await rowLine("art-photos-2"));
    check(
      (await pg.locator("[data-desk-row='art-photos-2']").getAttribute("href")) === `/desk/season/${ids.isle2}/cast`,
      "each to its Cast page"
    );
    const lastSection = await pg.evaluate(() => [...document.querySelectorAll("section")].pop()?.getAttribute("data-delete-row"));
    check(lastSection === "show", "the show's Delete, last", String(lastSection));
    await shot("art", true);
    await fits("the art page");

    // A link for the header: a page's address, then an image's
    await pg.locator("[data-desk-row='art-header-source']").click();
    await sheet().locator("[data-src='link']").click();
    await sheet().locator("[data-field-input='art-link']").first().fill(NOT_AN_IMAGE);
    await sheet().locator("[data-art-link-bad]").waitFor({ timeout: 15000 }).catch(() => {});
    check((await sheet().locator("[data-art-link-bad]").count()) === 1 && (await sheet().locator("[data-art-use]").isDisabled()), "a page's address: said, and Use this art off");
    await shot("link-bad");
    await sheet().locator("[data-field-input='art-link']").first().fill(LINK);
    await sheet().locator("[data-art-preview]").waitFor({ timeout: 15000 }).catch(() => {});
    check(/Loaded: images\.zt-art\.example\.com · 1200 × 675/.test(await sheet().locator("[data-art-preview]").innerText().catch(() => "")), "an image's address: loaded, its size said, previewed in both crops", await sheet().locator("[data-art-preview]").innerText().catch(() => "none"));
    check(/A link stops TMDB changing it/.test(await sheet().innerText()) && /Only art we.re allowed to show/.test(await sheet().innerText()), "what a link means, said");
    await shot("link");
    await fits("A link");
    await sheet().locator("[data-art-use]").click();
    check(/Header: your link · TMDB won.t change it/.test(await toasted(/your link/)), "used: its toast");
    await pg.locator("[data-desk-row='art-header-source']").filter({ hasText: "A link" }).waitFor({ timeout: 15000 });
    check(/A link · images\.zt-art\.example\.com\/survivor\/key-art\.jpg/.test(await rowLine("art-header-source")), "the header's row: A link and its address", await rowLine("art-header-source"));
    check((await row()).backdrop_url === LINK, "saved");

    // Framing the header: dragged, the arrow keys, zoomed, every crop redrawn, saved
    await pg.locator("[data-desk-row='art-header-frame']").click();
    const stage = sheet().locator("[data-frame-stage='header']");
    await stage.waitFor({ timeout: 15000 });
    await pg.waitForTimeout(600);
    const box = await stage.boundingBox();
    // At 1× the crop (2.1 wide) is wider than the image (16:9): only up and down move. Zoomed 1.5×, both do.
    await sheet().locator("[data-zoom='1.5']").click();
    const before1 = await sheet().locator("[data-crops='header'] img").first().getAttribute("style");
    await pg.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await pg.mouse.down();
    await pg.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.2, { steps: 6 });
    await pg.mouse.up();
    const dragged = await sheet().locator("[data-frame-window]").getAttribute("aria-valuetext");
    check(/^0% across, 0% down · 1\.5× zoom$/.test(dragged || ""), "zoomed 1.5×, dragged to the top left: the window follows", dragged);
    check((await sheet().locator("[data-crops='header'] img").first().getAttribute("style")) !== before1, "every crop redrawn as it moves");
    await sheet().locator("[data-frame-window]").focus();
    await pg.keyboard.press("ArrowRight");
    await pg.keyboard.press("ArrowRight");
    const keyed = await sheet().locator("[data-frame-window]").getAttribute("aria-valuetext");
    check(keyed === "8% across, 0% down · 1.5× zoom", "the arrow keys move it", keyed);
    check(/scale\(1\.5\)/.test((await sheet().locator("[data-crops='header'] img").nth(1).getAttribute("style")) || ""), "Up next's crop zoomed too");
    await shot("framing");
    await fits("Framing");
    await sheet().locator("[data-frame-middle]").click();
    check((await sheet().locator("[data-frame-window]").getAttribute("aria-valuetext")) === "Centred", "Back to the middle: centred");
    await sheet().locator("[data-zoom='1.25']").click();
    await sheet().locator("[data-frame-window]").focus();
    await pg.keyboard.press("ArrowLeft");
    await pg.keyboard.press("ArrowUp");
    await sheet().locator("[data-frame-save]").click();
    check(/Framing saved · everywhere it shows/.test(await toasted(/Framing saved/)), "saved: its toast");
    await pg.waitForFunction(() => /46% across, 46% down · 1\.25× zoom/.test(document.querySelector("[data-desk-row='art-header-frame']")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(/46% across, 46% down · 1\.25× zoom/.test(await rowLine("art-header-frame")), "the header's Framing row says it", await rowLine("art-header-frame"));
    sr = await row();
    check(JSON.stringify(sr.backdrop_style) === JSON.stringify({ x: 46, y: 46, url: LINK, zoom: 1.25 }), "kept on the link it frames", JSON.stringify(sr.backdrop_style));
    check(/scale\(1\.25\)/.test((await mainCrop("header").getAttribute("style")) || ""), "the page's crops drawn framed");

    // Choose one from TMDB for the cards: a season's poster
    await pg.locator("[data-desk-row='art-cards-source']").click();
    await sheet().locator("[data-src='choose']").click();
    await pg.locator("[data-choose-art='cards']").waitFor({ timeout: 30000 });
    check((await sheet().locator("[data-art-pick='poster']").count()) === 4, "Choose one from TMDB: the season's posters and the show's", String(await sheet().locator("[data-art-pick='poster']").count()));
    await shot("choose");
    await sheet().locator("[data-art-pick='poster']").nth(1).click();
    check(/the season.s poster is chosen/i.test(await toasted(/chosen/)), "chosen: its toast");
    await pg.waitForFunction(() => /Chosen from TMDB/.test(document.querySelector("[data-desk-row='art-cards-source']")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(/Chosen from TMDB/.test(await rowLine("art-cards-source")), "the cards' row: chosen from TMDB", await rowLine("art-cards-source"));

    // TMDB, on its own for the cards
    await pg.locator("[data-desk-row='art-cards-source']").click();
    await sheet().locator("[data-src='tmdb']").click();
    check(/Back to TMDB, on its own/.test(await toasted(/Back to TMDB/)), "TMDB, on its own: its toast");
    await pg.waitForFunction(() => /TMDB, on its own/.test(document.querySelector("[data-desk-row='art-cards-source']")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    check(/TMDB, on its own · each season's own poster/.test(await rowLine("art-cards-source")), "the cards on their own again", await rowLine("art-cards-source"));
    await pg.goto(`${BASE}/desk/show/${ids.isle}`);
    await pg.locator("[data-desk-row='show-art']").waitFor({ timeout: 30000 });
    check(/Header from a link · cards from TMDB/.test(await rowLine("show-art")), "the show's row says where each frame is from", await rowLine("show-art"));
    await pg.goBack();
    await pg.locator("[data-desk-art]").waitFor({ timeout: 30000 });

    // The player's show bar draws the header's framing (a zoom in a box of its own)
    const kim = await open({ user: U("kim"), pass: PASSWORD, width, height: 844 });
    closers.push(kim.close);
    await pictures(kim.page);
    await kim.page.goto(`${BASE}/show/${ids.isle2}/tonight`);
    await kim.page.locator(".nd-showbar [data-art]").first().waitFor({ timeout: 60000 });
    const bar = await kim.page.evaluate(() => {
      const el = document.querySelector(".nd-showbar [data-art]");
      const img = el.tagName === "IMG" ? el : el.querySelector("img");
      return { tag: el.tagName, src: img?.getAttribute("src"), style: img?.getAttribute("style") || "" };
    });
    check(bar.tag === "SPAN" && bar.src === LINK && /object-position: 46% 46%/.test(bar.style) && /scale\(1\.25\)/.test(bar.style), "the player's show bar: the link, framed and zoomed", JSON.stringify(bar));
    await kim.page.waitForTimeout(800);
    await kim.page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-player-showbar-${width}.png`) });

    // No art or photos, and back
    await pg.locator("[data-switch='art-off']").click();
    check(/No art or photos · its name on a plain card/.test(await toasted(/No art or photos/)), "the switch: its toast");
    await pg.locator("[data-art-off-panel]").waitFor({ timeout: 15000 });
    check((await pg.locator("[data-crops]").count()) === 0 && /Off/.test(await rowLine("art-photos-2")), "off: no frames, its cast photos off");
    await shot("off", true);
    await pg.locator("[data-art-on]").click();
    check(/Art and photos are back/.test(await toasted(/are back/)), "Turn them back on: its toast");
    await pg.locator("[data-crops='header']").waitFor({ timeout: 15000 });
    await fits("the art page, back on");

    // A show with nothing
    await pg.goto(`${BASE}/desk/show/${ids.bare}/art`);
    await pg.locator("[data-desk-art='none']").waitFor({ timeout: 30000 });
    check(/Nothing on TMDB yet · its name on a plain card/.test(await rowLine("art-cards-source")) && (await pg.locator("[data-desk-row='art-cards-frame']").count()) === 0, "a show with nothing: said, and no framing to set");
    await shot("none");

    const errs = [...dsk.errors, ...kim.errors].filter((e) => !/Failed to load resource/.test(e));
    check(!errs.length && !failed.length, "no page errors or failed requests", [...errs, ...failed].join(" | "));
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await down(pool);
    const after = await Promise.all([REAL_USERS, REAL_LEAGUES, REAL_SHOWS].map(async (q) => (await pool.query(q)).rows[0].h));
    check(after[0] === before[0], "every real account is as it was");
    check(after[1] === before[1], "every real league is as it was");
    check(after[2] === before[2], "every real show's art is as it was");
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
