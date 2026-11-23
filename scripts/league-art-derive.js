// A league's band art from a generated photo (docs/design-round/league-art-spec.md; src/lib/sports/league-art.ts): crops a 16:9
// strip from a square source in public/art/generated/, lifts its exposure so the sport reads under a band's dark fade, saves it as
// public/art/generated/league/<id>-wide.webp and writes (or replaces) its entry in the manifest, with the transform and SHA-256. No
// provider call: the source must already be in the library (generate it with scripts/dev-test/check-nano-banana.js --jobs, e.g.
// docs/design-round/league-art-photo-jobs.json, and record the source's own manifest entry first). Then add one line to LEAGUE_ART.
//
// Run:  node scripts/league-art-derive.js <id> [--top 300] [--brightness 1.6] [--gamma 1.25] [--quality 74] [--sheet out.jpg]
//   <id>          the source's name without .png ("football-night-v1")
//   --top         the strip's first row in the 1024 source (576 rows tall): where the sport is (turf, diamond, court), not sky
//   --sheet       also writes a band-sized preview (716 x 252, the band's own fade over it) to look at before using it
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
if (!id || !/^[a-z0-9-]+$/.test(id)) throw new Error("usage: node scripts/league-art-derive.js <id> [--top N] [--brightness B] [--gamma G]");
const ROOT = path.join(__dirname, "..");
const src = path.join(ROOT, "public/art/generated", `${id}.png`);
if (!fs.existsSync(src)) throw new Error(`${src} isn't in the library`);
const top = Number(opt("top", 300));
const brightness = Number(opt("brightness", 1.6));
const gamma = Number(opt("gamma", 1.25));
const quality = Number(opt("quality", 74));
const rel = `public/art/generated/league/${id}-wide.webp`;
const out = path.join(ROOT, rel);

(async () => {
  const meta = await sharp(src).metadata();
  if (meta.width !== 1024 || top < 0 || top + 576 > meta.height) throw new Error(`the strip (top ${top}, 576 tall) doesn't fit ${meta.width} x ${meta.height}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(src).extract({ left: 0, top, width: 1024, height: 576 }).modulate({ brightness }).gamma(gamma).webp({ quality, effort: 6 }).toFile(out);
  const bytes = fs.readFileSync(out);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  const manifestPath = path.join(ROOT, "public/art/generated/manifest.json");
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const source = m.assets.find((a) => a.file === `public/art/generated/${id}.png`);
  if (!source) throw new Error(`${id}.png has no manifest entry: record the source first`);
  const entry = {
    file: rel,
    url: `/${rel.replace(/^public\//, "")}`,
    derivedFrom: source.file,
    transform: `crop 1024x576 at y=${top}; brightness ${brightness}, gamma ${gamma} (the sport reads under a band's dark fade); WebP quality ${quality} (sharp)`,
    provider: "derived locally (no provider call)",
    width: 1024,
    height: 576,
    bytes: bytes.length,
    sha256,
    purpose: "A league's band art (src/lib/sports/league-art.ts)",
    sourceStudy: "league-art-2026-11-23",
    reviewStatus: "candidate; league art (docs/design-round/league-art-spec.md)",
  };
  const at = m.assets.findIndex((a) => a.file === rel);
  if (at >= 0) m.assets[at] = { ...m.assets[at], ...entry, purpose: m.assets[at].purpose ?? entry.purpose };
  else m.assets.push(entry);
  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + "\n");
  console.log(`${rel}: ${bytes.length} bytes, sha256 ${sha256}`);

  const sheet = opt("sheet", null);
  if (sheet) {
    const [W, H] = [716, 252];
    const fade = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g"><stop offset="0" stop-color="#100e15" stop-opacity=".94"/><stop offset=".55" stop-color="#100e15" stop-opacity=".8"/><stop offset="1" stop-color="#100e15" stop-opacity=".45"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`
    );
    await sharp(await sharp(out).resize(W, H, { fit: "cover" }).toBuffer()).composite([{ input: fade }]).jpeg({ quality: 82 }).toFile(path.resolve(sheet));
    console.log(`preview: ${sheet}`);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
