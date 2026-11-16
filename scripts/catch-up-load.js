// Loads a rehearsal's catch-up answers into a database, then releases the catch-up (docs/PLAN-cast-properties.md chunk 6c; the
// user, 2026-11-16: apply the rehearsal's results after, rather than asking everything again). The answers come from
// `scripts/catch-up-rehearse.js --export=<file>` on a Neon branch of production; loaded here, production's catch-up uses each in
// place of asking our bot (catch-up.ts loadedAnswer), still reading it with production's own cast and rules and trying it against
// production's own games first, so anything that changed since the branch was made is still guarded. An answer that doesn't
// read is set aside and asked live.
//
//   node scripts/catch-up-load.js load --in=<file> --endpoint=<ep-...> [--production]   the answers, then the hold released
//   node scripts/catch-up-load.js release --endpoint=<ep-...> [--production]            release only (it asks our bot for all)
//   node scripts/catch-up-load.js status --endpoint=<ep-...> [--production]             queued seasons, loaded answers, the hold
//     with CATCHUP_DATABASE_URL set to the database's connection string (a clipboard window like the rehearsal's: Claude never
//     sees the string). Production only with --production AND its compute's id as --endpoint; anything else must not be
//     production. It writes catchup_answers rows and app_settings 'catchup_hold', nothing else.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const { Pool } = require("pg");

const PRODUCTION = "ep-empty-star-b42m1jue";
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const url = process.env.CATCHUP_DATABASE_URL;
if (!url) throw new Error("set CATCHUP_DATABASE_URL to the database's connection string");
const endpoint = (h) => h.split(".")[0].replace(/-pooler$/, "");
const host = new URL(url).hostname;
const want = opt("endpoint");
if (!want) throw new Error("--endpoint=<ep-...> is required");
if (endpoint(host) !== want && !/^(localhost|127\.0\.0\.1)$/.test(host)) throw new Error(`the string's host isn't ${want}`);
const isProduction = endpoint(host) === PRODUCTION;
if (isProduction !== args.includes("--production")) throw new Error(isProduction ? "that's production: add --production to mean it" : "--production given, but that isn't production's compute");
console.log(`[load] on ${endpoint(host)}${isProduction ? " (PRODUCTION)" : ""}`);

(async () => {
  const pool = new Pool({ connectionString: url });
  // An idle connection the database drops is an error on the pool; unhandled it ends the process (and prints the client).
  pool.on("error", (e) => console.error("[load] an idle connection closed:", e.message));
  try {
    const status = async () => {
      const { rows: q } = await pool.query("SELECT count(*) FILTER (WHERE done_at IS NULL AND stuck_at IS NULL)::int AS open, count(*)::int AS all FROM season_catchups");
      const { rows: a } = await pool.query("SELECT source, count(*)::int AS n, count(used_at)::int AS used FROM catchup_answers GROUP BY source");
      const { rows: h } = await pool.query("SELECT value FROM app_settings WHERE key = 'catchup_hold'");
      console.log(`[load] seasons queued: ${q[0].open} open of ${q[0].all}; answers: ${a.map((x) => `${x.n} ${x.source} (${x.used} used)`).join(", ") || "none"}; held: ${h[0]?.value === true}`);
    };
    if (cmd === "status") return await status();
    if (cmd === "load") {
      const file = opt("in");
      if (!file) throw new Error("--in=<the exported file>");
      const { answers } = JSON.parse(fs.readFileSync(file, "utf8"));
      let loaded = 0;
      const missing = new Set();
      for (const a of answers) {
        const { rows } = await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2", [a.slug, a.season]);
        if (!rows[0]) {
          missing.add(`${a.slug} ${a.season}`);
          continue;
        }
        // A loaded answer is used once, in place of an ask; one asked here already stays as it is.
        const r = await pool.query(
          `INSERT INTO catchup_answers (season_id, step, episode_number, answer, source) VALUES ($1, $2, $3, $4, 'loaded')
           ON CONFLICT (season_id, step, episode_number) DO UPDATE SET answer = EXCLUDED.answer, source = 'loaded', used_at = NULL, created_at = now()
           WHERE catchup_answers.source = 'loaded'`,
          [rows[0].id, a.step, a.episode, a.answer]
        );
        loaded += r.rowCount;
      }
      console.log(`[load] ${loaded} of ${answers.length} answer(s) loaded${missing.size ? `; no such season here: ${[...missing].join(", ")}` : ""}`);
    } else if (cmd !== "release") throw new Error("usage: catch-up-load.js load --in=<file> | release | status, with --endpoint (and --production)");
    await pool.query("INSERT INTO app_settings (key, value, updated_at) VALUES ('catchup_hold', 'false'::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = 'false'::jsonb, updated_at = now()");
    console.log("[load] the catch-up is released: the bot's clock runs it from its next call");
    await status();
  } catch (e) {
    console.error("[load] failed:", e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
