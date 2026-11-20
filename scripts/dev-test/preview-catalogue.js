// The gallery's whole catalogue against live previews (docs/PLAN-preview-release.md, step 2): each of the gallery's games on a
// season, the builder's verdict (tools/gameplay-bench/preview/definition.cjs verdict: the explorer's analysis), then a season of it
// played headless (preview.cjs typical); with --live, each game the verdict passes also made as a live preview, its copies written to
// this lane's database through the real routes and then removed (tools/gameplay-bench/preview/live.cjs). A game the verdict passes
// that then fails, or one it stops that plays, is a mismatch: the exit code says so.
//
// The season: the made-up one (tests/fixtures/preview-season: no real people), or --s51 the first slice's Survivor 51 from this
// lane's recordings (scripts/dev-test/preview-proof.js record).
//
//   node scripts/dev-test/preview-catalogue.js [--s51] [--only=fantasy,pool]
//   node --env-file=.env.local scripts/dev-test/preview-catalogue.js --live    needs this lane's dev server (BASE, default :3014)
const path = require("path");
const root = path.resolve(__dirname, "../..");
const Def = require(path.join(root, "tools/gameplay-bench/preview/definition.cjs"));
const G = require(path.join(root, "src/lib/game/start-gallery/index.js"));
const { typical } = require(path.join(root, "tools/gameplay-bench/preview/preview.cjs"));

const args = process.argv.slice(2);
const has = (k) => args.includes(`--${k}`);
const only = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const BASE = process.env.BASE || "http://localhost:3014";

(async () => {
  const season = has("s51") ? require("./preview-proof.js")._h.season() : require(path.join(root, "tests/fixtures/preview-season/season.js")).season();
  const rows = [], live = has("live") ? require(path.join(root, "tools/gameplay-bench/preview/live.cjs")) : null;
  for (const b of G.galleryFor(season.page)) {
    if (only.length && !only.includes(b.id)) continue;
    const row = { id: b.id, gallery: b.state, verdict: "-", played: "-", live: "-", why: b.state === "plays" ? "" : b.why || "" };
    rows.push(row);
    if (b.state !== "plays") continue;
    let d;
    try { d = Def.build(season, { base: b.id, gameId: b.id, seed: 7 }); } catch (e) { row.verdict = "build"; row.why = e.message; continue; }
    const v = Def.verdict(d);
    row.verdict = v.ok ? "yes" : "no";
    if (!v.ok) row.why = v.why;
    try { typical(d, 1, 7, Def.resultsFor(season), "alex"); row.played = "yes"; } catch (e) { row.played = "no"; if (v.ok) row.why = e.message.slice(0, 160); }
    if (live && v.ok) {
      const t0 = Date.now();
      let made = null;
      try {
        made = await live.make({ input: d, app: BASE, resultsFor: Def.resultsFor(season), seasons: 1 });
        await made.rest;
        if (made.preview.failed) throw Error(String(made.preview.failed));
        row.live = `yes ${Math.round((Date.now() - t0) / 100) / 10}s`;
      } catch (e) { row.live = "no"; row.why = String(e.message).slice(0, 160); }
      finally { if (made) await live.down(made.preview).catch((e) => console.error("down:", e.message)); }
    }
  }
  if (live) await require(path.join(root, "tools/gameplay-bench/live-db.cjs")).close().catch(() => {});
  const bad = rows.filter((r) => r.gallery === "plays" && ((r.verdict === "yes") !== (r.played === "yes") || (live && r.verdict === "yes" && !r.live.startsWith("yes"))));
  for (const r of rows) console.log(`${r.id.padEnd(13)} ${r.gallery.padEnd(7)} verdict ${r.verdict.padEnd(5)} played ${r.played.padEnd(4)} live ${r.live.padEnd(8)} ${r.why}`);
  const ok = rows.filter((r) => r.verdict === "yes").length, plays = rows.filter((r) => r.gallery === "plays").length;
  console.log(`\n${ok} of the ${plays} games the gallery offers here can be previewed; ${bad.length} mismatch${bad.length === 1 ? "" : "es"}${bad.length ? ": " + bad.map((r) => r.id).join(", ") : ""}`);
  process.exitCode = bad.length ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
