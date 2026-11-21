// Dev-only test bank: a week of the bell's notices on the zt_nd couch (new-fixture.js), for the design round's step 8
// (notifications: the push and the bell). The rows are written as push-core.js keep() writes them, in the words each push
// function says today (push-events.ts, waiver-pushes.js, db/reminders.js, remind-moves.js), timed from the season's own
// schedule: Episode 5 aired four days ago, Episode 6 airs in three. Each person gets the words their mark lets out (alex,
// riley and jordan have seen 5; sam 3), with the guarded words (`spoils`, `safe`) on a notice that names who went home, so the
// bell's read-time guard is exercised too.
//
//   node scripts/dev-test/notes-fixture.js up [--read] [--words=before|after]
//     (needs new-fixture.js up; --read marks the bell read before them; --words: today's push words before step 8, or its
//     grammar after, the default)
//   node scripts/dev-test/notes-fixture.js down
//   require("./notes-fixture").up(pool, { read }) / .down(pool)   (census-app.js --up layers it)
//
// Every row's key starts "zt-notes-" except the reminders, keyed as the real jobs key them (so the bell's rule that drops a
// reminder once its moment has gone is exercised), which down removes only from the zt_nd couch's people. Refuses a non-local database. Never touches real people.
require("dotenv").config({ path: ".env.local", quiet: true });

/** [who, type, minutes ago (from now), title, body, link (season-relative), spoils?, safe?] */
function rowsFor(who, s, words = "after") {
  const seen = who === "sam" ? 3 : 5;
  // Today's words (before step 8) or the new grammar's (after): the news first, then where it's from and what to do.
  const W = (before, after) => (words === "before" ? before : after);
  const H = 60, D = 24 * H;
  // Episode 5 aired 4 days ago at 8 PM ET (new-fixture.js: Episode 6 airs in 3 days at 8 PM).
  const ep5 = 4 * D;
  const out = [
    // db/reminders.js, two hours before an episode airs, while a move is open.
    // Its key says it's about Episode 5, which has aired, so the bell no longer lists it (notify-prefs.ts reminderHolds).
    [who, "reminder", ep5 + 2 * H, W("Lineup League: episode 5 airs in about 2 hours", "Ep 5 locks in about 2 hours"), W("Set your episode 5 lineup (1 empty slot) · Make your Couch Cup pick", "ZT Survivor 51 · Lineup League: set your lineup (1 empty slot) · Couch Cup: make your pick"), `/show/${s}/tonight`, null, null, `remind:${s}:5:before:2h`],
    // notifyEpisodeResults: early results, minutes after the episode, with waivers' line.
    seen >= 5
      ? [who, "episodeResults", ep5 - 70, "Ep 5: Carter Krull went home", `ZT Survivor 51 · Final results by noon tomorrow. Waivers ${W("process", "close")} Wed 8:00 PM.`, `/show/${s}/tonight`, 5, { title: "Ep 5 results are in", body: `ZT Survivor 51 · Reveal when you've watched. Waivers ${W("process", "close")} Wed 8:00 PM.` }]
      : [who, "episodeResults", ep5 - 70, "Ep 5 results are in", `ZT Survivor 51 · Reveal when you've watched. Waivers ${W("process", "close")} Wed 8:00 PM.`, `/show/${s}/tonight`],
    // (A window that opens by itself is said in the results' line above; windowMessages is only for one a commissioner opens.)
    // notifyEpisodeResults: final results at noon the day after.
    [who, "finalScores", ep5 - 16 * H, "Ep 5 final results are in", seen >= 5 ? "ZT Survivor 51 · See where you stand." : "ZT Survivor 51 · Reveal when you've watched.", `/show/${s}/tonight`],
    // notifyPoll (only to whoever's seen the episode).
    ...(seen >= 5 ? [[who, "poll", 3 * D + 20 * H, "jordan started a poll", "ZT Survivor 51 · Episode 5: Who's next to go?", `/show/${s}/tonight`]] : []),
    // notifyNewBet.
    [who, "newBet", 2 * D + 5 * H, W("New prediction", "jordan asks: Who finds the next idol?"), W("\"Who finds the next idol?\" · Lineup League", "ZT Survivor 51 · Lineup League · Make your call"), W(`/show/${s}/games`, `/show/${s}/game/LINEUP`)],
    // notifyPlanned, in the reader's zone.
    [who, "planned", 26 * H, "riley planned a watch along", "ZT Survivor 51 · Episode 6 · the live airing, Thu 8:00 PM. Are you in?", `/show/${s}/tonight`],
    // waiver-pushes.js remindWaivers, six hours before claims are due.
    seen >= 5
      ? [who, "waiverReminder", 3 * H, W("Claims due at 8:00 PM", "Replace Carter by 8:00 PM"), W("Couch Cup: you have someone to replace.", "ZT Survivor 51 · Couch Cup · Forget, and the best one free comes in"), `/show/${s}/waivers`, null, null, `wremind:zt-notes:${who}:${Date.now() + 2 * D * 60_000}`]
      : [who, "waiverReminder", 3 * H, W("Claims due at 8:00 PM", "Ep 5 waivers close at 8:00 PM"), W("Couch Cup: reveal Episode 5 before then to make any claims.", "ZT Survivor 51 · Couch Cup · Reveal Ep 5 first to claim"), `/show/${s}/waivers`, null, null, `wremind:zt-notes:${who}:${Date.now() + 2 * D * 60_000}`],
    // remind-moves.js, the commissioner's Remind everyone.
    ...(who === "alex" ? [] : [[who, "reminder", 50, W("ZT Survivor 51: you still have a move to make", "Ep 6 locks in about 3 days"), W("alex sent a reminder · Make your Couch Cup pick · Set your episode 6 lineup", "ZT Survivor 51 · alex sent a reminder · Couch Cup: make your pick · Lineup League: set your lineup"), W(`/show/${s}/tonight`, `/show/${s}/tonight?moves=pool&game=OUTLAST`), null, null, `remind:${s}:6:before:manual-zt`]]),
  ];
  if (who === "alex") {
    // notifyCouchJoined, notifyJoinRequest (alex runs the games).
    out.push([who, "couchJoined", 5 * D, "casey joined ZT Survivor 51", "Say hi, and ask them what they're watching.", "/home"]);
    out.push([who, "joinRequest", 40, "kat asked to join Lineup League", "Let them in, or not, on Manage this game.", `/show/${s}/backstage`]);
  }
  return out;
}

const WHO = ["alex", "riley", "jordan", "sam"];

async function up(pool, { read = false, words = "after" } = {}) {
  const q = async (sql, p) => (await pool.query(sql, p)).rows;
  const users = Object.fromEntries((await q(`SELECT id, username FROM "user" WHERE username = ANY($1)`, [WHO.map((w) => `zt_nd_${w}`)])).map((r) => [r.username.replace("zt_nd_", ""), r.id]));
  const [season] = await q(`SELECT ss.id FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug = 'zt-nd-survivor' AND ss.season_number = 51`);
  const games = Object.fromEntries((await q(`SELECT slug, id FROM leagues WHERE slug IN ('zt-nd-lineup', 'zt-nd-outlast') AND deleted_at IS NULL`)).map((r) => [r.slug, r.id]));
  if (!season || WHO.some((w) => !users[w])) throw new Error("notes-fixture needs new-fixture.js up first");
  await down(pool);
  let n = 0;
  for (const who of WHO) {
    if (read) await pool.query(`INSERT INTO user_settings (user_id, notes_read_at) VALUES ($1, now() - interval '5 days') ON CONFLICT (user_id) DO UPDATE SET notes_read_at = now() - interval '5 days'`, [users[who]]);
    for (const [, type, ago, title, body, raw, spoils, safe, key] of rowsFor(who, season.id, words)) {
      const link = raw.replace("LINEUP", games["zt-nd-lineup"] ?? "").replace("OUTLAST", games["zt-nd-outlast"] ?? "");
      await pool.query(
        `INSERT INTO notifications (user_id, type, key, season_id, title, body, link, spoils, safe, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - make_interval(mins => $10))`,
        [users[who], type, key ?? `zt-notes-${who}-${n++}`, season.id, title, body, link, spoils ?? null, safe ? JSON.stringify(safe) : null, ago]
      );
    }
  }
  return n;
}

async function down(pool) {
  // Its own rows, and the reminders it keyed as the real jobs do: only ever on the zt_nd couch's people.
  await pool.query(`DELETE FROM notifications WHERE key LIKE 'zt-notes-%' OR (key ~ '^w?remind:' AND user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\_nd\_%'))`);
}

module.exports = { up, down, rowsFor };

if (require.main === module) {
  (async () => {
    const { Pool } = require("pg");
    const DB = process.env.AUTH_DATABASE_URL || "";
    if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("notes-fixture runs against a local database only");
    const pool = new Pool({ connectionString: DB });
    try {
      const cmd = process.argv[2];
      const words = process.argv.find((a) => a.startsWith("--words="))?.slice(8) ?? "after";
      if (cmd === "up") console.log(`[zt] notes up: ${await up(pool, { read: process.argv.includes("--read"), words })} notices for ${WHO.join(", ")}, ${words} step 8's words`);
      else if (cmd === "down") { await down(pool); console.log("[zt] notes down"); }
      else throw new Error("usage: notes-fixture.js up [--read] | down");
    } finally {
      await pool.end();
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
