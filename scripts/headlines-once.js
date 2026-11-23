// ONE-TIME: headlines for the episode write-ups saved before migration 0456 (docs/design-round/tonight-writeup-bolder.md; the
// user, 2026-11-23: "a one time AI ask for all existing prod episodes ... then new episodes from here on out have the headline
// built in"). New write-ups get theirs from the recap search itself (episode-recaps.ts recapPrompt), so once production's rows are
// filled this has nothing left to do. It's kept in scripts/ beside the other one-off data jobs, not in the test bank.
//
// The headline is written from the summary alone, never a new search: one prompt lists every write-up without a headline, the
// answer is JSON, and each headline is checked the same way a new one is (plainHeadline: one clean line of HEADLINE_MAX, 45,
// characters or fewer, never cut; a longer one is dropped and that episode shows its write-up without one).
//
//   node scripts/headlines-once.js prompt [--from-backup=backups/prod-2026-11-21] [--out=<file>]
//        the prompt, from the database (AUTH_DATABASE_URL) or from a production backup's JSON (reads files only)
//   node scripts/headlines-once.js apply <answer.json or .txt> [--db=<url>] [--dry-run]
//        writes each headline where that episode has a write-up and still no headline (never over one); prints every line.
//        Refuses a database that isn't local unless --db names it outright (production only with the user's OK, after 0456 is live).
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { HEADLINE_MAX, plainHeadline, plainRecap } = jiti("../src/lib/game/recap-text.ts");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const [cmd, file] = args.filter((a) => !a.startsWith("--"));
const LOCAL = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/;

/** Every write-up without a headline: { id: "<season>:<number>", show, season, kind, word, number, summary }. */
async function missing() {
  const backup = opt("from-backup", null);
  if (backup) {
    const read = (t) => {
      const j = JSON.parse(fs.readFileSync(path.join(backup, `${t}.json`), "utf8"));
      return Array.isArray(j) ? j : j.rows;
    };
    const seasons = new Map(read("show_seasons").map((s) => [s.id, s]));
    const shows = new Map(read("shows").map((s) => [s.id, s]));
    return read("season_episodes")
      .filter((e) => e.summary && !e.headline)
      .map((e) => {
        const ss = seasons.get(e.season_id);
        const sh = shows.get(ss?.show_id);
        return { id: `${e.season_id}:${e.number}`, show: sh?.name ?? "?", season: ss?.season_number ?? ss?.name ?? "?", kind: sh?.kind ?? "competition", word: sh?.episode_term || "Episode", number: e.number, summary: e.summary };
      })
      .sort((a, b) => a.show.localeCompare(b.show) || String(a.season).localeCompare(String(b.season)) || a.number - b.number);
  }
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const { rows } = await pool.query(
      `SELECT e.season_id, e.number, e.summary, sh.name AS show, ss.season_number AS season, sh.kind, sh.episode_term AS word
         FROM season_episodes e JOIN show_seasons ss ON ss.id = e.season_id JOIN shows sh ON sh.id = ss.show_id
        WHERE e.summary IS NOT NULL AND e.headline IS NULL ORDER BY sh.name, ss.season_number, e.number`
    );
    return rows.map((r) => ({ id: `${r.season_id}:${r.number}`, show: r.show, season: r.season, kind: r.kind, word: r.word || "Episode", number: r.number, summary: r.summary }));
  } finally {
    await pool.end();
  }
}

function promptOf(list) {
  return [
    `Write a headline for each of these TV episode write-ups. Use only what each write-up says. Answer with JSON only, in this shape:`,
    `{"headlines": [{"id": "...", "headline": "..."}]}`,
    `Each headline is one line of ${HEADLINE_MAX} characters or fewer, in the past tense, the way a TV recap would title it: who left and how (the vote and its count, a quit, a twist), or the episode's biggest moment if nobody left. Name everyone who left. For a sports game: the final score with who won. Plain words, no quotes, no semicolons (join two facts with a comma), no full stop at the end. "id" is the id given before each write-up.`,
    ``,
    ...list.map((e) => `id ${e.id} · ${e.show} ${e.season}, ${e.word} ${e.number}${e.kind === "sport" ? " (sport)" : ""}:\n${plainRecap(e.summary)}\n`),
  ].join("\n");
}

function answerOf(text) {
  const t = text.replace(/```(?:json)?/gi, "");
  const from = t.indexOf("{");
  const to = t.lastIndexOf("}");
  if (from < 0 || to <= from) throw new Error("no JSON in the answer");
  const list = JSON.parse(t.slice(from, to + 1)).headlines;
  if (!Array.isArray(list)) throw new Error('the answer has no "headlines" list');
  return list;
}

(async () => {
  if (cmd === "prompt") {
    const list = await missing();
    const text = promptOf(list);
    const out = opt("out", null);
    if (out) fs.writeFileSync(out, text);
    else console.log(text);
    console.error(`[headlines] ${list.length} write-ups without a headline${out ? ` · prompt in ${out}` : ""}`);
    return;
  }
  if (cmd === "apply") {
    if (!file) throw new Error("usage: apply <answer file>");
    const url = opt("db", process.env.AUTH_DATABASE_URL || "");
    if (!LOCAL.test(url) && !opt("db", null)) throw new Error("refusing a database that isn't local: name it with --db=<url>");
    const dry = has("dry-run");
    const pool = new Pool({ connectionString: url });
    let wrote = 0;
    let dropped = 0;
    try {
      for (const a of answerOf(fs.readFileSync(file, "utf8"))) {
        const [season, n] = String(a.id ?? "").split(":");
        const h = plainHeadline(a.headline);
        if (!h || !season || !Number(n)) {
          dropped++;
          console.log(`  dropped ${a.id}: ${JSON.stringify(a.headline)}`);
          continue;
        }
        const sql = `${dry ? "SELECT 1 FROM season_episodes" : "UPDATE season_episodes SET headline = $3"} WHERE season_id = $1 AND number = $2 AND summary IS NOT NULL AND headline IS NULL`;
        const { rowCount } = await pool.query(sql, dry ? [season, Number(n)] : [season, Number(n), h]);
        if (rowCount) wrote++;
        console.log(`  ${rowCount ? (dry ? "would write" : "wrote") : "skipped (has one, or no write-up)"} ${a.id}: ${h}`);
      }
    } finally {
      await pool.end();
    }
    console.log(`[headlines] ${dry ? "would write" : "wrote"} ${wrote}, dropped ${dropped}`);
    return;
  }
  throw new Error("usage: node scripts/headlines-once.js prompt|apply ... (see the header)");
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
