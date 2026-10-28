// Dev-only: the golden replays (docs/PLAN-start-a-game-gpt.md, the engine track's proof: every taped season through every game it
// already plays, scoring exactly as before the step). Engine against engine: each taped season's replays are played once
// (playtest.js run --keep, on the code as it stands), then every game they made is read by the code before the step and by the
// code after it, from the same states: as nobody and as each seat, at every mark (nothing seen, each episode with results,
// everything), the game it plays, its span, every score, this week's episode, finale predictions' points and the results'
// answer, and the game's own questions. Any difference is printed. Then playtest.js down. Two runs of the replays differ by
// themselves (waiver fills and computer players choose among equals), so their tables are never compared run to run.
//
//   node scripts/dev-test/golden.js [--before=HEAD] [--seasons="survivor 49,the-traitors-us 4"] [--keep-trees]
//
//   --before   the code before the step: a git ref (default HEAD, so run it with the step uncommitted)
//   after      the working tree as it stands: tracked and untracked files git doesn't ignore
//   --seasons  which taped seasons (default: every season on tape that this database has loaded)
//
// Needs: this lane's .env.local (a local database), the tapes (C:\Users\<you>\rfl-tapes, or TAPES_DIR), each season loaded into
// this lane's database once (LLM_BROWSER_API_URL=http://127.0.0.1:8765 node scripts/dev-test/tapes.js load <show> <season>: a
// load names only the local bot, and asks it nothing). The tapes are copied first and never written: a load gives the season
// this database's id, so the copy's season.json points at it. Both trees go in the OS temp folder, sharing this folder's
// node_modules and .models by directory links, taken out (links first, never their targets) at the end unless --keep-trees.
// No dev server; it uses zt-pt- rows only (playtest.js), so it can run beside a check on the zt_nd_ fixture. Exit 1 on any
// difference. About 5 minutes for five seasons.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { Pool } = require("pg");

const ROOT = path.join(__dirname, "..", "..");
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("golden.js runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || d;
const before = opt("before", "HEAD");
const TAPES = process.env.TAPES_DIR || path.join(os.homedir(), "rfl-tapes");
const work = path.join(os.tmpdir(), `rfl-golden-${Date.now()}`);
const run = (cmd, argv, o = {}) => {
  const r = spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 1 << 28, ...o });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(" ")}: ${r.stderr || r.stdout}`);
  return r.stdout;
};

/** A code tree: `ref`'s files (git archive), or the working tree's (null). Shares node_modules and .models by directory links. */
function tree(dir, ref) {
  fs.mkdirSync(dir, { recursive: true });
  if (ref) {
    // `ref`'s files written into the folder through a throwaway index: the lane's own index and working tree stay as they are.
    const env = { ...process.env, GIT_INDEX_FILE: path.join(work, `${path.basename(dir)}.index`) };
    run("git", ["read-tree", ref], { cwd: ROOT, env });
    run("git", ["checkout-index", "-a", "-f", `--prefix=${dir.replace(/\\/g, "/")}/`], { cwd: ROOT, env });
  } else {
    for (const f of run("git", ["ls-files", "-co", "--exclude-standard"], { cwd: ROOT }).split("\n").filter(Boolean)) {
      const from = path.join(ROOT, f);
      if (!fs.existsSync(from) || fs.statSync(from).isDirectory()) continue;
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.copyFileSync(from, path.join(dir, f));
    }
  }
  fs.copyFileSync(path.join(ROOT, ".env.local"), path.join(dir, ".env.local"));
  for (const link of ["node_modules", ".models"]) {
    const target = fs.realpathSync(path.join(ROOT, link));
    fs.symlinkSync(target, path.join(dir, link), "junction");
  }
  return dir;
}
/** Takes a tree's directory links out (never what they point at), then the tree; a link that won't come out leaves the tree
 *  where it is (false), so nothing ever deletes through it. */
function untree(dir) {
  for (const link of ["node_modules", ".models"]) {
    const p = path.join(dir, link);
    if (!fs.existsSync(p)) continue;
    try {
      fs.unlinkSync(p);
    } catch {
      try {
        fs.rmdirSync(p);
      } catch {
        /* checked below */
      }
    }
    if (fs.existsSync(p)) {
      console.log(`NOTE  left ${dir}: its ${link} link wouldn't come out (take it out by hand: rmdir, never a recursive delete)`);
      return false;
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

/** Everything a game reads as one viewer, as a string (the code's own StateLogic). */
function read(S, st) {
  const t = S.getLeagueType(st);
  return JSON.stringify({
    type: [t.id, !!t.hasRoster, !!t.hasActiveRoster, !!t.hasWeeklyPicks, !!t.hasCalls, !!t.hasBingo, !!t.hasQuestions],
    span: [S.startEpisode(st), S.endEpisode(st), S.gameOver(st), S.AnswerLogic.episodeNow(st)],
    scores: S.computeScores(st),
    finale: [...S.AnswerLogic.finalePoints(st)],
    actual: S.AnswerLogic.finaleActual(st),
    questions: S.AnswerLogic.questions(st).filter((q) => q.answer !== "calls").map((q) => q.id),
  });
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  let failures = 0;
  fs.mkdirSync(work, { recursive: true });
  const trees = [];
  try {
    // The seasons: those asked for, else every one on tape that this database has.
    const onTape = fs.readdirSync(TAPES, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) =>
      fs.readdirSync(path.join(TAPES, d.name), { withFileTypes: true }).filter((s) => s.isDirectory() && fs.existsSync(path.join(TAPES, d.name, s.name, "season.json"))).map((s) => `${d.name} ${s.name}`)
    );
    const wanted = opt("seasons", "") ? opt("seasons", "").split(",").map((x) => x.trim()) : onTape;
    // Copies of the tapes, each season.json pointing at this database's season (by its id, else its show and number).
    const tapes = path.join(work, "tapes");
    const seasons = [];
    for (const key of wanted) {
      const [show, number] = key.split(" ");
      const src = path.join(TAPES, show, number);
      const meta = JSON.parse(fs.readFileSync(path.join(src, "season.json"), "utf8"));
      // Its show by the TV listing it was found by (the tape's), never a replay's zt- copy.
      const tvmaze = meta.listing?.show?.id ?? null;
      const { rows } = await pool.query(
        `SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
          WHERE s.slug NOT LIKE 'zt-%' AND (ss.id::text = $1 OR (ss.season_number = $2 AND $3::text IS NOT NULL AND s.listing->>'url' LIKE '%/shows/' || $3::text || '/%'))
          ORDER BY (ss.id::text = $1) DESC, ss.created_at LIMIT 1`,
        [meta.seasonId || "", Number(number), tvmaze === null ? null : String(tvmaze)]
      );
      if (!rows[0]) {
        console.log(`SKIP  ${key}: not loaded here (LLM_BROWSER_API_URL=http://127.0.0.1:8765 node scripts/dev-test/tapes.js load ${key})`);
        continue;
      }
      fs.cpSync(src, path.join(tapes, show, number), { recursive: true });
      fs.writeFileSync(path.join(tapes, show, number, "season.json"), JSON.stringify({ ...meta, seasonId: rows[0].id }, null, 2));
      seasons.push(key);
    }
    const beforeTree = tree(path.join(work, "before"), before);
    trees.push(beforeTree);
    const afterTree = tree(path.join(work, "after"), null);
    trees.push(afterTree);
    const SB = require(path.join(beforeTree, "src/lib/game/state-logic.js"));
    const SA = require(path.join(afterTree, "src/lib/game/state-logic.js"));
    const env = { ...process.env, TAPES_DIR: tapes };
    let games = 0;
    let reads = 0;
    for (const key of seasons) {
      const t0 = Date.now();
      const played = spawnSync("node", ["scripts/dev-test/playtest.js", "run", ...key.split(" "), "--keep"], { cwd: afterTree, env, encoding: "utf8", maxBuffer: 1 << 28 });
      if (played.status !== 0) {
        failures++;
        console.log(`FAIL  ${key}: the replays didn't play\n${(played.stderr || played.stdout).split("\n").slice(-6).join("\n")}`);
        continue;
      }
      const users = (await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_pt\\_%'`)).rows.map((r) => r.id);
      const { rows } = await pool.query(
        `SELECT id, name, state FROM leagues WHERE (slug LIKE 'zt-pt-%' OR state->'settings'->>'showId' LIKE 'zt-pt-%' OR created_by = ANY($1::text[])) AND deleted_at IS NULL ORDER BY name`,
        [users]
      );
      const diffs = [];
      let n = 0;
      for (const { id, name, state } of rows) {
        const marks = [null, 0, ...new Set((state.episodes || []).filter((e) => SA.EpisodeLogic.resultsStage(e)).map((e) => e.number))];
        for (const seat of [null, ...(state.players || []).map((p) => p.id)]) {
          for (const mark of marks) {
            const a = read(SB, SB.GhostLogic.viewFor(JSON.parse(JSON.stringify(state)), seat, mark));
            const b = read(SA, SA.GhostLogic.viewFor(JSON.parse(JSON.stringify(state)), seat, mark));
            n++;
            if (a !== b) diffs.push(`${name} (${id}) seat ${seat} mark ${mark}:\n      before ${a.slice(0, 300)}\n      after  ${b.slice(0, 300)}`);
          }
        }
      }
      games += rows.length;
      reads += n;
      if (diffs.length) failures++;
      console.log(`${diffs.length ? "FAIL" : "PASS"}  ${key}: ${rows.length} games, ${n} reads${diffs.length ? `, ${diffs.length} differ` : ", every one the same"} (${Math.round((Date.now() - t0) / 1000)}s)`);
      for (const d of diffs.slice(0, 10)) console.log(`      ${d}`);
      spawnSync("node", ["scripts/dev-test/playtest.js", "down"], { cwd: afterTree, env, encoding: "utf8" });
    }
    console.log(`\n${seasons.length} seasons, ${games} games, ${reads} reads: ${failures ? `${failures} FAILED` : "every one the same"}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${e.stack || e}`);
  } finally {
    await pool.end();
    if (!args.includes("--keep-trees")) {
      // The work folder goes only once every tree in it has gone (its links out first).
      if (trees.map(untree).every(Boolean)) fs.rmSync(work, { recursive: true, force: true });
    } else console.log(`trees kept in ${work}`);
    process.exit(failures ? 1 : 0);
  }
})();
