// Dev-only: opt-in show art for the zt fixtures, so a design round's frames carry the character production has (the census in
// census-app.js; docs/design-round/). Off by default: a check that runs a fixture without asking gets the art-less shows it
// always got, so nothing it asserts moves.
//
//   await require("./fixture-art").borrow(pool, "zt-nd-survivor", "survivor");      // a real show's art, season by season
//   await require("./fixture-art").generated(pool, "zt-gd-late-show", "talk");       // the project's own generated atmosphere
//
// `borrow` copies what the local database already holds for a real show (shows.art_url, backdrop_url, logo_url and their framing;
// each season's poster where the real show has the same season number) onto a zt show: the same URLs production shows, nothing
// new fetched or stored. `generated` points a zt show at one of public/art/generated/ (manifest.json there: original images, not
// any network's key art). Both refuse a show whose slug isn't zt-. Nothing to undo: the zt show's rows go with its fixture's down.
const GENERATED = {
  talk: "/art/generated/tv-companion-v1.png",
  stage: "/art/generated/event-night-v1.png",
  island: "/art/generated/island-night-v1.png",
  football: "/art/generated/football-night-v1.png",
};

function zt(slug) {
  if (!/^zt-/.test(slug)) throw new Error(`fixture-art only dresses zt shows, not ${slug}`);
}

/** A real show's art onto a zt show; false when the local database has no such show (a fresh checkout: the zt show stays bare). */
async function borrow(pool, ztSlug, realSlug) {
  zt(ztSlug);
  const { rows } = await pool.query(`SELECT art_url, backdrop_url, logo_url, art_style, backdrop_style FROM shows WHERE slug = $1`, [realSlug]);
  if (!rows[0]) return false;
  const r = rows[0];
  await pool.query(
    `UPDATE shows SET art_url = $2, backdrop_url = $3, logo_url = $4, art_style = $5, backdrop_style = $6 WHERE slug = $1`,
    [ztSlug, r.art_url, r.backdrop_url, r.logo_url, r.art_style, r.backdrop_style]
  );
  await seasons(pool, ztSlug, realSlug);
  return true;
}

/** Each zt season's poster from the real show's season of the same number, where it has one (a season added later: call again). */
async function seasons(pool, ztSlug, realSlug) {
  zt(ztSlug);
  await pool.query(
    `UPDATE show_seasons z SET art_url = r.art_url
       FROM shows zs, show_seasons r JOIN shows rs ON rs.id = r.show_id
      WHERE zs.id = z.show_id AND zs.slug = $1 AND rs.slug = $2 AND r.season_number = z.season_number AND r.art_url IS NOT NULL`,
    [ztSlug, realSlug]
  );
}

/** One of the project's generated atmospheres as a zt show's poster and header. */
async function generated(pool, ztSlug, key) {
  zt(ztSlug);
  const url = GENERATED[key];
  if (!url) throw new Error(`no generated art called ${key} (${Object.keys(GENERATED).join(", ")})`);
  await pool.query(`UPDATE shows SET art_url = $2, backdrop_url = $2 WHERE slug = $1`, [ztSlug, url]);
}

module.exports = { borrow, seasons, generated, GENERATED };
