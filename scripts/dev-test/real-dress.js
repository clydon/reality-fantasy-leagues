// Dev-only: a real show's season as the bench's dress (tools/gameplay-bench/explorer/dress.cjs), so the design round's situations
// can be seen on a real game (the user, 2026-11-15: "so I can see what a real game would look like"): the castaways' real names and
// photos, the show's name and season, read once from the local database into an ignored file. The show's art isn't copied here:
// the bench borrows it from the local database when it writes the case (fixture-art.js borrow).
//
//   node --env-file=.env.local scripts/dev-test/real-dress.js record [--show=survivor] [--season=51]
//   node scripts/dev-test/real-dress.js list
//
// Where it lands: .ui-atlas/fixtures/real/<show>-<season>.json (ignored): real people's names stay on this machine and out of the
// public repo. Reads only; refuses a non-local database. A sport's dress needs nothing here: it reads the ESPN recording
// (scripts/dev-test/espn-snapshot.js, tools/gameplay-bench/explorer/sports-roster.cjs).
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const DIR = path.resolve(__dirname, "../../.ui-atlas/fixtures/real");

async function record() {
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) throw new Error("real-dress reads the local database only (AUTH_DATABASE_URL)");
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DB });
  try {
    const slug = opt("show", "survivor"), number = Number(opt("season", "51"));
    const { rows: [s] } = await pool.query(
      `SELECT sh.name AS show, sh.castaway_term, sh.tribe_term, ss.id, ss.name FROM shows sh JOIN show_seasons ss ON ss.show_id = sh.id WHERE sh.slug = $1 AND ss.season_number = $2`,
      [slug, number]
    );
    if (!s) throw new Error(`no ${slug} season ${number} in the local database`);
    const { rows: cast } = await pool.query(`SELECT name, photo_url, tribe_name FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name`, [s.id]);
    // The cast taken a tribe at a time in turn, so a smaller world's pool still has every tribe in it.
    const byTribe = new Map();
    for (const c of cast) byTribe.set(c.tribe_name || "", [...(byTribe.get(c.tribe_name || "") || []), c]);
    const lists = [...byTribe.values()], mixed = [];
    for (let i = 0; mixed.length < cast.length; i++) for (const l of lists) if (l[i]) mixed.push(l[i]);
    const out = {
      schemaVersion: 1,
      recordedAt: new Date().toISOString(),
      source: "the local database's real season (scripts/dev-test/real-dress.js); stays out of git",
      show: { slug, name: s.show, castawayTerm: s.castaway_term, tribeTerm: s.tribe_term },
      season: { number, name: s.name || `Season ${number}` },
      cast: mixed.map((c) => ({ name: c.name, photoUrl: c.photo_url || null, tribe: c.tribe_name || null })),
    };
    fs.mkdirSync(DIR, { recursive: true });
    const file = path.join(DIR, `${slug}-${number}.json`);
    fs.writeFileSync(file, JSON.stringify(out, null, 1));
    console.log(`${file}: ${out.cast.length} people, ${out.cast.filter((c) => c.photoUrl).length} with photos`);
  } finally {
    await pool.end();
  }
}

function list() {
  if (!fs.existsSync(DIR)) return console.log("nothing recorded yet");
  for (const f of fs.readdirSync(DIR)) console.log(f);
}

const cmd = args[0];
(cmd === "record" ? record() : cmd === "list" ? Promise.resolve(list()) : Promise.reject(new Error("record | list"))).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
