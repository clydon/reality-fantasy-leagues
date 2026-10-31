// Dev-only check for the hub (docs/PLAN-new-design.md step 0d's port, step 8's real data), against the dev server, on
// new-fixture.js's couch plus hub-fixture.js's two finished seasons (ZT Survivor 49 and 50):
//   API, GET /api/couches/[id]/hub:
//   - power rankings are Couch points (2026-10-31, couch-points.ts): everyone on the couch, 10 for joining it, its games
//     started and joined, shows followed openly (jordan's private follow isn't), moves from each game's state (couch-moves.ts:
//     pool picks, own draft picks, lineups that bring someone in; Survivor 49's, aired last year, count from when its games were
//     made, so This year stays hidden) and from their tables; then known activity for riley (a day's 12
//     messages count 10, 7 reactions on an episode count 5, a poll vote, a rating, trivia, a marked bingo card and not an
//     unmarked one, a watch along plan answered, a game's answers once an episode, a Call it answer, a day opened and not one
//     from before she joined, a follow made private) adding up exactly, all time and this week; This year hidden till the couch
//     has something before it, then a message cap counted by Eastern day over last year's DST night (12 messages between
//     00:30 EDT and 23:30 EST one Sunday count 10: a UTC or fixed-offset day would count 12); a day stamped when alex uses the
//     app; head to head still from each season's own /games tables;
//   - the trophy shelf: titles, a plaque per finished game, Ran it back (riley won both Outlasts), the records;
//   - your games (with your place), your numbers, the couch's accolades;
//   - the guard: sam (on Episode 3 of 51) gets the standings as his /games has them at his mark, and the feed leaves out
//     what others said since an episode he hasn't seen aired (the Traitors' chat is folded for alex, who hasn't started
//     it); founders don't show as "joined"; someone off the couch gets a 404;
//   - /api/me/home: a show's results ask you to reveal (sam) or nothing (alex).
//   In a real browser as alex, at --width (390 by default):
//   - the hub in each shape (?hub=focus, grow, new); the status line and Up next lead with results to reveal once alex
//     is a week behind (and Up next's plate opens the show's Results are in); posters carry your best place and flip to
//     your games; the feed; More on the couch's rows say your place and titles, and each page opens over the hub (?page=)
//     with real data (rankings: All time and Head to head, no This year, the one-line explainer, How you earn them;
//     Commercial break; By the numbers: a headline card only for a stat with one leader, rows only for leads worth naming
//     (couch-standings.ts leadWorthNaming: one alone, or two on more than once in a field of eight or more), the rest folded
//     into a line that opens every stat; Previously on for two shows; the trophy shelf), and back closes it; the profile's
//     numbers; the grow note's lines open their pages; then four newcomers level on Couch points share a place (T5), two of
//     them level on messages make a named pair on a couch of eight (both faces in one square, never a headline card), and
//     last year's activity brings This year back; Night and Studio screenshots of both pages;
//   - every hub.* entry of the Preview registry (src/new/preview.ts) still shows somewhere; Up next plays the Tune in
//     bumper into the show; nothing wider than the screen; no page errors.
// Screenshots of each shape (a screen at a time), the sheet and every page go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-hub.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js and hub-fixture.js up and takes them down (--keep leaves them); touches zt-nd rows only;
// refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");
const hubFixture = require("./hub-fixture");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { PREVIEWS } = jiti("../../src/new/preview.ts");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-hub runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-hub.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const PAGES = ["rankings", "break", "numbers", "verdicts", "previously", "trophies"];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;
/** Where you stand in words, as couch-pages.tsx standing() says it. */
function standing(rows, me) {
  const mine = rows.find((r) => r.userId === me);
  if (!mine) return null;
  const level = rows.filter((r) => r.userId !== me && r.total === mine.total);
  if (level.length) return `You're tied ${ordinal(mine.place)} with ${level.map((r) => r.name).join(" and ")}`;
  if (mine.place === 1) return "You lead the couch";
  return `You're ${ordinal(mine.place)} · ${rows[0].total - mine.total} back of ${rows[0].name}`;
}
/** "a", "a and b", "a, b and c". */
const joinNames = (xs) => (xs.length < 2 ? xs[0] : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const EASTERN_TODAY = "(now() AT TIME ZONE 'America/New_York')::date";

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    const hx = await hubFixture.up(pool, fx);
    const sid = fx.seasonId;
    const seasons = [hx.seasons.s49, hx.seasons.s50, sid];
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [fx.users.alex]);
    const year = new Date().getFullYear();
    const markTo = async (who, n) => {
      const L = fx.leagues;
      await pool.query("UPDATE league_memberships SET results_seen_through = $2 WHERE user_id = $1 AND league_id = ANY($3::uuid[])", [fx.users[who], n, [L.outlast, L.lineup, L.pool]]);
      await pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    };

    // ---------------- the API ----------------
    const as = {};
    for (const who of ["alex", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const hubOf = async (who) => {
      const { status, body } = await as[who].call("GET", `/api/couches/${fx.couchId}/hub`);
      if (status !== 200) throw new Error(`${who}'s hub: ${status} ${JSON.stringify(body)}`);
      return body;
    };
    /** Each season's games as the viewer has them on /games (head to head and the trophy shelf are the games' results). */
    async function expected(who) {
      const tables = [];
      for (const s of seasons) {
        const { body } = await as[who].call("GET", `/api/seasons/${s}/games?couch=${fx.couchId}`);
        for (const g of body.games ?? []) tables.push({ season: s, g });
      }
      return { tables };
    }
    /** `me` against `them`, game by game, from those tables. */
    const versus = (tables, me, them) => {
      const out = { won: 0, lost: 0, tied: 0, games: 0 };
      for (const { g } of tables) {
        const a = g.table.find((r) => r.userId === me);
        const b = g.table.find((r) => r.userId === them);
        if (!a || !b || g.through < 1) continue;
        out.games++;
        if (a.place < b.place) out.won++;
        else if (a.place > b.place) out.lost++;
        else out.tied++;
      }
      return out;
    };
    const sameH2h = (h, x) => !!h && ["won", "lost", "tied", "games"].every((k) => h[k] === x[k]);

    // ---- power rankings: Couch points ----
    const alexHub = await hubOf("alex");
    const all = await expected("alex");
    const riley = fx.users.riley;
    const rowOf = (hub, who) => hub.rankings.all.find((r) => r.userId === fx.users[who]);
    const kindsOf = (hub, who) => Object.fromEntries((rowOf(hub, who)?.byKind ?? []).map((k) => [k.kind, k.points]));
    const onCouch = ["alex", "riley", "jordan", "sam"];
    check(alexHub.rankings.year === null, "power rankings: no This year while nothing on the couch is from before it", JSON.stringify(alexHub.rankings.year));
    check(
      alexHub.rankings.all.length === 4 && onCouch.every((w) => kindsOf(alexHub, w).couch === 10),
      "Couch points: everyone on the couch is on the table (casey isn't), 10 each for joining it",
      JSON.stringify(alexHub.rankings.all.map((r) => [r.name, r.total, r.byKind]))
    );
    check(
      alexHub.rankings.all.every((r, i, a) => r.total === r.byKind.reduce((n, k) => n + k.points, 0) && (i === 0 || a[i - 1].total >= r.total)),
      "each total is its kinds added up, and the table is in order"
    );
    const counted = async (sql) => new Map((await pool.query(sql, [fx.couchId])).rows.map((r) => [r.user_id, r.n]));
    const started = await counted("SELECT created_by AS user_id, count(*)::int AS n FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL AND stage_of IS NULL GROUP BY 1");
    const joined = await counted(
      "SELECT m.user_id, count(*)::int AS n FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE l.couch_id = $1 AND l.deleted_at IS NULL AND l.stage_of IS NULL GROUP BY 1"
    );
    const follows = await counted(
      "SELECT f.user_id, count(*)::int AS n FROM show_follows f JOIN couch_members m ON m.user_id = f.user_id AND m.couch_id = $1 WHERE f.following AND NOT f.private GROUP BY 1"
    );
    check(
      onCouch.every((w) => (kindsOf(alexHub, w).started ?? 0) === 10 * (started.get(fx.users[w]) ?? 0) && (kindsOf(alexHub, w).joined ?? 0) === 5 * (joined.get(fx.users[w]) ?? 0)),
      "10 for each game someone started on the couch, 5 for each they joined",
      JSON.stringify(onCouch.map((w) => [w, kindsOf(alexHub, w).started, kindsOf(alexHub, w).joined]))
    );
    const jordanPrivate = (await pool.query("SELECT count(*)::int AS n FROM show_follows WHERE user_id = $1 AND private", [fx.users.jordan])).rows[0].n;
    check(
      jordanPrivate > 0 && onCouch.every((w) => (kindsOf(alexHub, w).follow ?? 0) === 5 * (follows.get(fx.users[w]) ?? 0)),
      "5 for each show followed openly: jordan's private follow doesn't count",
      JSON.stringify(onCouch.map((w) => [w, kindsOf(alexHub, w).follow, follows.get(fx.users[w])]))
    );
    // Moves (2 each): what the games keep in their state, by the rules written out again here (couch-moves.ts: a pool pick an
    // episode; the player's own draft picks, else, before the draft log, what an exclusive draft gave them; a lineup that's their
    // first or brings someone in), plus the ones with tables (a game's answers once an episode a seat, blind picks, waiver claims).
    const couchGames = (await pool.query("SELECT id, state FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL AND stage_of IS NULL", [fx.couchId])).rows;
    const seatsOf = new Map();
    for (const r of (await pool.query("SELECT league_id, player_id, user_id FROM league_memberships WHERE league_id = ANY($1::uuid[])", [couchGames.map((g) => g.id)])).rows)
      seatsOf.set(`${r.league_id}:${r.player_id}`, [...(seatsOf.get(`${r.league_id}:${r.player_id}`) ?? []), r.user_id]);
    const movesBy = new Map();
    const credit = (league, seat) => (seatsOf.get(`${league}:${seat}`) ?? []).forEach((u) => movesBy.set(u, (movesBy.get(u) ?? 0) + 1));
    for (const { id, state } of couchGames) {
      const eps = [...(state.episodes ?? [])].sort((a, b) => a.number - b.number);
      for (const e of eps) for (const p of e.picks ?? []) credit(id, p.playerId);
      if ((state.draftLog ?? []).length) for (const d of state.draftLog) if (!d.by && !d.auto && !d.drawn && !d.filled) credit(id, d.playerId);
      if (!(state.draftLog ?? []).length && state.settings.ownershipMode !== "shared") for (const c of state.castaways ?? []) if (c.acquiredVia === "draft") (c.ownerIds ?? []).forEach((s) => credit(id, s));
      const last = new Map();
      for (const e of eps)
        for (const [s, ids] of Object.entries(e.lineups ?? {})) {
          if (last.has(s) ? ids.some((x) => !last.get(s).includes(x)) : ids.length > 0) credit(id, s);
          last.set(s, ids);
        }
    }
    const tabled = await counted(
      `SELECT user_id, count(*)::int AS n FROM (
         SELECT DISTINCT a.league_id, a.player_id, a.episode, COALESCE(a.answered_by, m.user_id) AS user_id FROM game_answers a JOIN leagues l ON l.id = a.league_id
           LEFT JOIN league_memberships m ON m.league_id = a.league_id AND m.player_id = a.player_id WHERE l.couch_id = $1 AND l.deleted_at IS NULL
         UNION ALL SELECT b.league_id, b.player_id, 0, m.user_id FROM blind_draft_picks b JOIN leagues l ON l.id = b.league_id JOIN league_memberships m ON m.league_id = b.league_id AND m.player_id = b.player_id WHERE l.couch_id = $1 AND l.deleted_at IS NULL
         UNION ALL SELECT w.league_id, w.player_id, 0, m.user_id FROM waiver_claims w JOIN leagues l ON l.id = w.league_id JOIN league_memberships m ON m.league_id = w.league_id AND m.player_id = w.player_id
          WHERE l.couch_id = $1 AND l.deleted_at IS NULL AND (w.pairs <> '[]'::jsonb OR w.pickup_ids <> '[]'::jsonb OR w.add_ids <> '[]'::jsonb)) x GROUP BY 1`
    );
    const moveWant = onCouch.map((w) => [w, 2 * ((movesBy.get(fx.users[w]) ?? 0) + (tabled.get(fx.users[w]) ?? 0))]);
    check(
      moveWant.every(([w, n]) => (kindsOf(alexHub, w).move ?? 0) === n) && moveWant.some(([, n]) => n > 0),
      "moves: pool picks, their own draft picks and lineups that bring someone in, from each game's state, 2 each",
      JSON.stringify(onCouch.map((w, i) => [w, kindsOf(alexHub, w).move ?? 0, moveWant[i][1]]))
    );
    // A day is stamped as alex uses the app (auth-helpers.ts, beside user_last_seen; fire-and-forget, so give it a moment).
    let stamped = false;
    for (let i = 0; i < 20 && !stamped; i++) {
      stamped = (await pool.query(`SELECT 1 FROM user_days WHERE user_id = $1 AND day = ${EASTERN_TODAY}`, [fx.users.alex])).rowCount === 1;
      if (!stamped) await new Promise((r) => setTimeout(r, 250));
    }
    check(stamped, "using the app stamps today (Eastern) in user_days for alex");

    // Known activity for riley, then everything taken back out.
    const seatOf = async (league, who) => (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [league, fx.users[who]])).rows[0].player_id;
    const showOf = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [sid])).rows[0].show_id;
    const undo = [];
    try {
      await pool.query("DELETE FROM user_days WHERE user_id = $1", [riley]);
      const before = await hubOf("alex");
      const k0 = kindsOf(before, "riley");
      // Twelve messages on one Eastern day this year (January 2nd, from noon): ten count.
      await pool.query(
        `INSERT INTO chat_messages (league_id, user_id, author_name, type, text, created_at)
         SELECT $1, $2, 'zt_nd_riley', 'message', 'zt-points ' || i,
                ((date_trunc('year', now() AT TIME ZONE 'America/New_York') + interval '1 day 12 hours') AT TIME ZONE 'America/New_York') + i * interval '1 minute'
           FROM generate_series(1, 12) i`,
        [fx.leagues.outlast, riley]
      );
      undo.push(["DELETE FROM chat_messages WHERE user_id = $1 AND text LIKE 'zt-points %'", [riley]]);
      // Seven reactions in one episode's watch along: five count.
      await pool.query(
        `INSERT INTO watch_reactions (season_id, episode, runtime_ms, user_id, couch_id, kind) SELECT $1, 12, 7000000 + i, $2, $3, 'fire' FROM generate_series(1, 7) i`,
        [sid, riley, fx.couchId]
      );
      undo.push(["DELETE FROM watch_reactions WHERE user_id = $1 AND runtime_ms BETWEEN 7000001 AND 7000007", [riley]]);
      const poll = (
        await pool.query(
          `INSERT INTO couch_polls (couch_id, season_id, episode, question, options, created_by, closes_at) VALUES ($1, $2, 1, 'zt points poll?', '["Yes","No"]', $3, now() - interval '1 day') RETURNING id`,
          [fx.couchId, sid, fx.users.alex]
        )
      ).rows[0].id;
      undo.push(["DELETE FROM couch_polls WHERE id = $1", [poll]]);
      await pool.query("INSERT INTO couch_poll_votes (poll_id, user_id, option) VALUES ($1, $2, 'Yes')", [poll, riley]);
      const free = async (table) =>
        (await pool.query(`SELECT n FROM generate_series(1, 13) n WHERE n NOT IN (SELECT episode FROM ${table} WHERE user_id = $1 AND season_id = $2) ORDER BY n LIMIT 2`, [riley, hx.seasons.s49])).rows.map((r) => r.n);
      const [rated] = await free("episode_ratings");
      await pool.query("INSERT INTO episode_ratings (user_id, season_id, episode, stars) VALUES ($1, $2, $3, 4)", [riley, hx.seasons.s49, rated]);
      undo.push(["DELETE FROM episode_ratings WHERE user_id = $1 AND season_id = $2 AND episode = $3", [riley, hx.seasons.s49, rated]]);
      await pool.query("INSERT INTO trivia_plays (user_id, show_id, week, score, questions, answers) VALUES ($1, $2, '2000-01-03', 3, 5, '{}')", [riley, showOf]);
      undo.push(["DELETE FROM trivia_plays WHERE user_id = $1 AND week = '2000-01-03'", [riley]]);
      const [marked, blank] = await free("bingo_cards");
      const card = async (ep) => (await pool.query(`INSERT INTO bingo_cards (user_id, season_id, episode, squares) VALUES ($1, $2, $3, '[]') RETURNING id`, [riley, hx.seasons.s49, ep])).rows[0].id;
      const markedCard = await card(marked);
      undo.push(["DELETE FROM bingo_cards WHERE id = ANY($1::uuid[])", [[markedCard, await card(blank)]]]);
      await pool.query("INSERT INTO bingo_marks (card_id, square) VALUES ($1, 4)", [markedCard]);
      const plan = (
        await pool.query(`INSERT INTO watch_plans (couch_id, season_id, episode, how, starts_at, created_by) VALUES ($1, $2, 12, 'live', now() + interval '2 days', $3) RETURNING id`, [
          fx.couchId, sid, fx.users.alex,
        ])
      ).rows[0].id;
      undo.push(["DELETE FROM watch_plans WHERE id = $1", [plan]]);
      await pool.query("INSERT INTO watch_plan_people (plan_id, user_id, answer, invited, answered_at) VALUES ($1, $2, 'in', true, now())", [plan, riley]);
      // A game's answers: two questions on Episode 3 are one move, Episode 4's (nobody named as answering) another.
      const seat = await seatOf(fx.leagues.pool, "riley");
      await pool.query(
        `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by) VALUES ($1, $2, 'zt-a', 3, '"x"', $3), ($1, $2, 'zt-b', 3, '"y"', $3), ($1, $2, 'zt-a', 4, '"z"', NULL)`,
        [fx.leagues.pool, seat, riley]
      );
      undo.push(["DELETE FROM game_answers WHERE league_id = $1 AND question LIKE 'zt-%'", [fx.leagues.pool]]);
      await pool.query("INSERT INTO episode_calls (user_id, season_id, episode, question, answer) VALUES ($1, $2, 12, 'zt points call?', 'Yes')", [riley, sid]);
      undo.push(["DELETE FROM episode_calls WHERE user_id = $1 AND question = 'zt points call?'", [riley]]);
      await pool.query(`INSERT INTO user_days (user_id, day) VALUES ($1, ${EASTERN_TODAY}), ($1, '2000-01-01')`, [riley]);
      const hid = await pool.query("UPDATE show_follows SET private = true WHERE user_id = $1 AND season_id = $2 AND following AND NOT private", [riley, sid]);
      undo.push(["UPDATE show_follows SET private = false WHERE user_id = $1 AND season_id = $2", [riley, sid]]);

      const after = await hubOf("alex");
      const k1 = kindsOf(after, "riley");
      const want = { chat: 10, reaction: 5, poll: 2, rating: 2, trivia: 5, bingo: 5, plan: 3, move: 4, call: 2, day: 1, follow: -5 };
      const got = Object.fromEntries(Object.keys(want).map((k) => [k, (k1[k] ?? 0) - (k0[k] ?? 0)]));
      check(hid.rowCount === 1 && JSON.stringify(got) === JSON.stringify(want), "riley's known activity, kind by kind: capped chat and reactions, a marked card only, one move an episode, no day before she joined, a private follow out", JSON.stringify(got));
      check(rowOf(after, "riley").total - rowOf(before, "riley").total === 34, "riley's Couch points: 34 more", `${rowOf(before, "riley").total} → ${rowOf(after, "riley").total}`);
      check(rowOf(after, "riley").week - rowOf(before, "riley").week === 24, "and 24 of them this week (January's messages aren't)", `${rowOf(before, "riley").week} → ${rowOf(after, "riley").week}`);
      check(["jordan", "sam"].every((w) => rowOf(after, w).total === rowOf(before, w).total), "nobody else's changed");
      check(after.rankings.year === null, "all of it this year: still no This year");
    } finally {
      for (const [sql, params] of undo.reverse()) await pool.query(sql, params);
    }

    // This year once something's from last year: alex's messages from 00:30 EDT to 23:30 EST on the Sunday DST ended are one
    // Eastern day of 25 hours, so ten of twelve count; by UTC, or any fixed offset, they'd be two days and all twelve.
    const lastYear = year - 1;
    const sunday = 1 + ((7 - new Date(Date.UTC(lastYear, 10, 1)).getUTCDay()) % 7);
    const dstNight = [Date.UTC(lastYear, 10, sunday, 4, 30), Date.UTC(lastYear, 10, sunday + 1, 4, 30)];
    const addLastYear = () =>
      pool.query(
        `INSERT INTO chat_messages (league_id, user_id, author_name, type, text, created_at)
         SELECT $1, $2, 'zt_nd_alex', 'message', 'zt-dst ' || i, to_timestamp((CASE WHEN i <= 6 THEN $3::bigint ELSE $4::bigint END + i * 60000) / 1000.0) FROM generate_series(1, 12) i`,
        [fx.leagues.outlast, fx.users.alex, dstNight[0], dstNight[1]]
      );
    const dropLastYear = () => pool.query("DELETE FROM chat_messages WHERE user_id = $1 AND text LIKE 'zt-dst %'", [fx.users.alex]);
    const plain = await hubOf("alex");
    try {
      await addLastYear();
      const y = await hubOf("alex");
      const yearRow = y.rankings.year?.find((r) => r.userId === fx.users.alex);
      check(!!yearRow && yearRow.total === rowOf(plain, "alex").total, "with last year's messages This year is back, alex's year as it was", JSON.stringify(yearRow && yearRow.total));
      check(rowOf(y, "alex").total - rowOf(plain, "alex").total === 10, "and all time 10 more: twelve messages on the 25-hour Eastern day DST ended, capped at ten", `${rowOf(plain, "alex").total} → ${rowOf(y, "alex").total}`);
    } finally {
      await dropLastYear();
    }

    const vsRiley = alexHub.rankings.h2h.find((h) => h.userId === riley);
    const h2h = versus(all.tables, fx.users.alex, riley);
    check(sameH2h(vsRiley, h2h), "head to head against riley stays the games, game by game", JSON.stringify([vsRiley, h2h]));

    const t = alexHub.trophies;
    const ended = all.tables.filter(({ season }) => season !== sid);
    const alexTitles = ended.filter(({ g }) => g.table.find((r) => r.userId === fx.users.alex)?.place === 1).length;
    check(!!t && t.titles === alexTitles && alexTitles === 1, "trophy shelf: alex's titles are the finished games alex won (Pool 50)", JSON.stringify(t && t.titles));
    check(t?.plaques.length === 3 && t.plaques.every((p) => p.label !== "ZT Survivor 51"), "a plaque per finished game, none for the season still going");
    const cup50 = t?.plaques.find((p) => p.leagueId === hx.leagues.cup50);
    check(!!cup50 && cup50.ranItBack && cup50.winners[0].userId === riley, "riley ran it back: Cup 49 and Cup 50");
    const rec = Object.fromEntries((t?.records ?? []).map((r) => [r.key, r]));
    check(rec.titles?.who.userId === riley && rec.titles.line === "2 titles" && rec.ranItBack?.who.userId === riley, "couch records: most titles and ran it back are riley's", JSON.stringify(t?.records));
    check(t?.leader?.who.userId === riley && t.leader.titles === 2, "riley holds the most titles");
    const g51 = alexHub.games.filter((g) => g.seasonId === sid);
    const games51 = all.tables.filter(({ season }) => season === sid).map(({ g }) => g);
    check(g51.length === 3 && g51.every((g) => !g.ended && g.rank === games51.find((x) => x.leagueId === g.leagueId)?.you?.rank), "your three games on 51, still going, with your place from /games", JSON.stringify(g51.map((g) => g.rank)));
    check(alexHub.games.filter((g) => g.ended).length === 3, "and your three finished ones");
    const meRow = alexHub.rankings.all.find((r) => r.userId === fx.users.alex);
    check(
      alexHub.you.titles === 1 && alexHub.you.points === meRow.total && alexHub.you.place === meRow.rank && alexHub.you.thisYear === false && alexHub.you.seasons === 3,
      "your numbers: a title, your Couch points and place (all time: no This year), three seasons",
      JSON.stringify(alexHub.you)
    );
    const acc = Object.fromEntries(alexHub.accolades.map((a) => [a.key, a]));
    check(acc.shows?.userId === riley && /2 shows/.test(acc.shows.line), "accolades: riley follows the most shows (jordan's private Traitors follow doesn't count)", JSON.stringify(acc.shows));
    check(acc.watched?.line === "4 of 4 watch it", "the most-watched show");
    const feed = alexHub.feed;
    check(feed.length > 0 && feed.length <= 8 && feed.every((e, i) => i === 0 || Date.parse(feed[i - 1].at) >= Date.parse(e.at)), "the feed: eight at most, newest first");
    check(feed.some((e) => e.kind === "said" && e.text === "anyone rewatching before Tuesday?"), "the feed has what jordan said this morning");
    check(!feed.some((e) => fixture.TRAITORS_CHAT.some(([, text]) => e.text === text)), "the Traitors' chat stays folded for alex, who hasn't started it");
    check(!feed.some((e) => e.kind === "joined"), "founders of the couch don't show as having joined it");

    const samHub = await hubOf("sam");
    const samAll = await expected("sam");
    const samVsAlex = versus(samAll.tables, fx.users.sam, fx.users.alex);
    check(
      sameH2h(samHub.rankings.h2h.find((h) => h.userId === fx.users.alex), samVsAlex),
      "sam's head to head is as his /games has it at Episode 3 (nothing past it)",
      JSON.stringify([samHub.rankings.h2h, samVsAlex])
    );
    // (Read again: sam's first read stamped his day as it went.)
    const tableOf = async (who) => JSON.stringify((await hubOf(who)).rankings.all.map((r) => [r.userId, r.total]));
    check((await tableOf("sam")) === (await tableOf("alex")), "and Couch points are the same table for everyone");
    const after4 = fixture.CHAT.filter(([, who, type, , n, offset]) => type === "message" && who !== "sam" && (n > 4 || (n === 4 && !offset.startsWith("-")) || n === null)).map(([, , , text]) => text);
    check(!samHub.feed.some((e) => after4.includes(e.text)), "sam's feed leaves out what others said since Episode 4 aired", JSON.stringify(samHub.feed.map((e) => e.text)));
    const samHome = await as.sam.call("GET", "/api/me/home");
    const alexHome = await as.alex.call("GET", "/api/me/home");
    const res = (home) => home.body.shows.find((s) => s.seasonId === sid)?.results;
    // With when its final results were due (final-results.js: noon the day after it aired), long past.
    const samDue = res(samHome);
    check(samDue?.reveal?.episode === 4 && samDue.reveal.stage === "final" && Date.parse(samDue.reveal.finalAt) < Date.now() && samDue.final === null, "the home tells sam Episode 4's results are in", JSON.stringify(samDue));
    check(JSON.stringify(res(alexHome)) === JSON.stringify({ reveal: null, final: null }), "and alex nothing", JSON.stringify(res(alexHome)));
    check((await as.casey.call("GET", `/api/couches/${fx.couchId}/hub`)).status === 404, "someone off the couch gets a 404");

    // ---------------- the browser ----------------
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844 });
    close = b.close;
    const { page, BASE, errors } = b;
    await page.context().addInitScript(() => {
      window.__vt = [];
      const start = Document.prototype.startViewTransition;
      if (start)
        Document.prototype.startViewTransition = function (arg) {
          const entry = { nav: document.documentElement.dataset.nav || null, anims: [] };
          window.__vt.push(entry);
          const t = start.call(this, arg);
          t.ready.then(() => (entry.anims = document.documentElement.getAnimations({ subtree: true }).map((a) => a.effect?.pseudoElement || ""))).catch(() => {});
          return t;
        };
      // Next's dev badge sits over the screen's bottom-left.
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(s);
      });
    });
    const seen = new Set();
    const collect = async () => (await page.$$eval("[data-preview]", (els) => els.map((e) => e.dataset.preview))).forEach((id) => seen.add(id));
    const text = async (sel) => ((await page.locator(sel).first().textContent({ timeout: 10_000 }).catch(() => "")) || "").replace(/\s+/g, " ").trim();
    const fits = async (where) => {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    // A screen at a time down the page (the document scrolls), or down a pushed page (it scrolls itself).
    async function shoot(name, scroller = null) {
      const height = await page.evaluate((s) => (s ? document.querySelector(s).scrollHeight : document.documentElement.scrollHeight), scroller);
      for (let k = 0, y = 0; y < height - 120 && k < 8; k++, y += 780) {
        await page.evaluate(([s, top]) => (s ? (document.querySelector(s).scrollTop = top) : window.scrollTo(0, top)), [scroller, y]);
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(out, `${name}-${k}.png`) });
      }
      await page.evaluate((s) => (s ? (document.querySelector(s).scrollTop = 0) : window.scrollTo(0, 0)), scroller);
    }
    const hubReady = async (q = "focus") => {
      // 'load', not network idle: the guide's week (/api/listings/week, step 11 part 2) is stale-while-revalidate, so the
      // browser answers from its cache and refreshes it in the background, a request Playwright never sees finish.
      await page.goto(`${BASE}/home?hub=${q}`, { waitUntil: "load" });
      await page.locator("[data-hub]").waitFor({ timeout: 30_000 });
      await page.locator("[data-feed-list] [data-feed], [data-feed-list] p").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600);
    };

    // ---- the hub, in each shape ----
    let going = false;
    for (const shape of ["focus", "grow", "new"]) {
      await hubReady(shape);
      await collect();
      if (shape === "new") going = (await page.locator("[data-get-going]").count()) === 1;
      await fits(`hub (${shape})`);
      await shoot(`hub-${shape}`);
    }
    // On now is real since step 13 part 2 (check-new-watch-along.js covers it): riley with Episode 4 open, as her watch along keeps it.
    const ws = (
      await pool.query(
        "INSERT INTO watch_sessions (season_id, episode, couch_id, started_by, mode, clock_ms, running_since) VALUES ($1, 4, $2, $3, 'stream', 60000, now()) RETURNING id",
        [sid, fx.couchId, fx.users.riley]
      )
    ).rows[0].id;
    await pool.query("INSERT INTO watch_session_people (session_id, user_id) VALUES ($1, $2)", [ws, fx.users.riley]);
    await hubReady();
    const onNowText = await text('[data-on-now="zt_nd_riley"]');
    check(/zt_nd_riley is watching ZT Survivor/.test(onNowText) && /Episode 4/.test(onNowText) && (await page.locator('[data-preview="hub.on-now"]').count()) === 0, "On now is real: riley is watching ZT Survivor, Episode 4 (no Preview)", onNowText);
    await pool.query("DELETE FROM watch_sessions WHERE id = $1", [ws]);
    await hubReady();
    check((await page.locator("[data-on-now]").count()) === 0, "with nobody on, no On now");
    // Get the couch going is real since step 9 (check-new-couches.js covers it).
    // The guide is real since step 11 part 1 (check-new-guide.js), its Also on since part 2 (check-new-listings.js).
    check((await page.locator("[data-guide]").count()) === 1 && !seen.has("hub.all-of-tv") && going, "the guide is on the hub (no Preview left in it), and a new couch gets Get the couch going");

    // ---- the status line, Up next, posters and the feed ----
    await hubReady();
    check((await page.locator("[data-hub] [data-status]").getAttribute("data-status")) === "moves", "with moves due, the status line says so", await text("[data-hub] [data-status]"));
    const poster = page.locator(`[data-poster="${sid}"]`);
    check(/Best 1st/.test(await poster.locator("[data-best]").textContent()), "Survivor 51's poster: your best place, 1st");
    check(/Best 3rd/.test((await page.locator(`[data-poster="${hx.seasons.s49}"] [data-best]`).textContent()) || ""), "Survivor 49's: where you finished, 3rd");
    await poster.scrollIntoViewIfNeeded();
    await poster.locator("[data-flip]").click();
    await page.waitForTimeout(900);
    check((await poster.locator("[data-flipped]").count()) === 1, "the corner flips it over");
    const rear = await poster.textContent();
    check(/Outlast/.test(rear) && /Weekly Lineup/.test(rear) && /Survival Pool/.test(rear), "to your three games there with your place in each", rear.replace(/\s+/g, " "));
    await page.screenshot({ path: path.join(out, "poster-flipped.png") });
    await poster.locator("[data-unflip]").click();
    await page.waitForTimeout(900);
    check((await poster.locator("[data-flipped]").count()) === 0, "and back");
    check(/anyone rewatching before Tuesday\?/.test(await text("[data-feed-list]")), "On the couch: what jordan said");
    check(!/castle looks unreal|round table was brutal|shield goes to Eli/.test(await text("[data-feed-list]")), "and nothing from a show alex hasn't started");

    // ---- More on the couch: the rows ----
    const keys = await page.$$eval("[data-more]", (els) => els.map((e) => e.dataset.more));
    check(PAGES.every((k) => keys.includes(k)), "More on the couch has all six rows (rankings: something scored; trophies: a season ended)", keys.join(","));
    const nowHub = await hubOf("alex");
    const said = standing(nowHub.rankings.all, fx.users.alex);
    check((await text('[data-more="rankings"]')).includes(said) && !/this year/i.test(await text('[data-more="rankings"]')), `the rankings row says where you stand in Couch points ("${said}"), not "this year"`, await text('[data-more="rankings"]'));
    check(/1 title · 3 seasons played/.test(await text('[data-more="trophies"]')), "the trophy shelf row says your titles", await text('[data-more="trophies"]'));

    // ---- each page ----
    const pageOpen = "[role=dialog][aria-hidden=false]";
    for (const key of PAGES) {
      const row = page.locator(`[data-more="${key}"] button`);
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await page.waitForURL(new RegExp(`page=${key}`));
      await page.locator(`[data-couch-page="${key}"]`).waitFor();
      await page.waitForTimeout(700);
      const body = `[data-couch-page="${key}"]`;
      if (key === "rankings") {
        const mine = nowHub.rankings.all.find((r) => r.userId === fx.users.alex);
        const placed = mine.rank.startsWith("T") ? mine.rank : ordinal(mine.place);
        const tabs = await page.$$eval(`${body} [data-rank-tab]`, (els) => els.map((e) => `${e.dataset.rankTab}${e.getAttribute("aria-selected") === "true" ? "*" : ""}`));
        check(tabs.join(",") === "all*,h2h", "Power rankings: All time (open) and Head to head; no This year", tabs.join(","));
        const hero = await text(`${body} [data-hero]`);
        check(hero.startsWith(placed) && /Couch points · of 4/.test(hero), `the hero: your place in Couch points, ${placed} of four`, hero);
        const ranks = await page.$$eval(`${body} [data-rank-row]`, (els) => els.map((e) => [e.dataset.rankRow, e.dataset.rank]));
        check(JSON.stringify(ranks) === JSON.stringify(nowHub.rankings.all.map((r) => [r.name, r.rank])), "a row each, ranked as the hub says", JSON.stringify(ranks));
        check(/Points for joining in, not for winning/.test(await text(`${body} [data-rank-explainer]`)), "one short line on how they're earned");
        const tiers = await page.$$eval(`${body} [data-earn]`, (els) => els.map((e) => [e.dataset.earn, e.querySelectorAll("li").length]));
        check(JSON.stringify(tiers) === JSON.stringify([["10", 2], ["5", 4], ["3", 1], ["2", 4], ["1", 3]]), "How you earn them: 10, 5, 3, 2 and 1, fourteen ways", JSON.stringify(tiers));
        check(/A chat message · up to 10 a day/.test(await text(`${body} [data-how-earn]`)) && /A watch along reaction · up to 5 an episode/.test(await text(`${body} [data-how-earn]`)), "with the caps on chat and reactions");
        await page.locator(`${body} [data-rank-tab="h2h"]`).click();
        check((await page.locator(`${body} [data-h2h]`).count()) === 3 && (await page.locator(`${body} [data-how-earn]`).count()) === 0, "Head to head: a row for each of the other three (the games), no points list");
        await page.locator(`${body} [data-rank-tab="all"]`).click();
      } else if (key === "break") {
        check((await page.locator(`${body} [data-playing]`).count()) === 3, "Commercial break: the three games you're playing (not the finished ones)");
        check((await page.locator(`${body} [data-preview]`).count()) === 0 && (await page.locator(`${body} [data-break-week]`).count()) === 1 && (await page.locator(`${body} [data-break-start]`).count()) === 1, "This week only is real (step 12), and Start a game (10 part 2b): nothing on Preview");
      } else if (key === "numbers") {
        await page.locator(`${body} [data-accolades]`).waitFor({ timeout: 20_000 });
        check((await page.locator(`${body} [data-accolade-row]`).count()) === nowHub.accolades.length, "By the numbers: the couch's accolades");
        const untied = nowHub.accolades.filter((a) => !a.tied).map((a) => a.key);
        const deckAccolades = await page.$$eval(`${body} [data-accolade]`, (els) => els.map((e) => e.dataset.accolade));
        check(deckAccolades.length >= (untied.length ? 1 : 0) && deckAccolades.every((k) => untied.includes(k)), "and one in the deck, never a tied one", JSON.stringify([deckAccolades, untied]));
        const accRows = await page.$$eval(`${body} [data-accolade-row]`, (els) => els.map((e) => ({ key: e.dataset.accoladeRow, faces: e.querySelector("[data-faces]")?.dataset.faces ?? null, text: e.textContent })));
        check(
          nowHub.accolades.every((a) => {
            const row = accRows.find((x) => x.key === a.key);
            return row && row.text.includes(a.who) && row.faces === (a.tied ? String(a.tied.length) : null);
          }),
          "each accolade row names who holds it, a tie with everyone's faces",
          JSON.stringify(accRows)
        );

        // Cast stats: each stat's lead as the stats read has it, up to where alex is.
        const statsOf = {};
        for (const s of seasons) statsOf[s] = (await as.alex.call("GET", `/api/seasons/${s}/stats?couch=${fx.couchId}`)).body;
        const leadersOf = (s, key) => {
          const board = statsOf[s].cast.map((c) => ({ c, n: key === "points" ? c.points : (c.counts[key] ?? 0) })).filter((r) => r.n > 0);
          const top = Math.max(0, ...board.map((r) => r.n));
          return { top, second: Math.max(0, ...board.filter((r) => r.n < top).map((r) => r.n)), leaders: board.filter((r) => r.n === top).map((r) => r.c.first) };
        };
        const deck = await page.$$eval(`${body} [data-deck-stat]`, (els) => els.map((e) => e.dataset.deckStat));
        for (const s of new Set(deck.map((id) => id.split(":")[0]))) statsOf[s] ??= (await as.alex.call("GET", `/api/seasons/${s}/stats?couch=${fx.couchId}`)).body;
        check(
          deck.length > 0 && deck.every((id) => {
            const [s, key] = id.split(":");
            const l = leadersOf(s, key);
            return l.leaders.length === 1 && l.top >= 2;
          }),
          "the deck's headline cards: only stats with one leader alone",
          JSON.stringify(deck.map((id) => [id, leadersOf(...id.split(":")).leaders]))
        );
        // A lead is named when one leads alone, or two share it on more than once in a cast of eight or more (couch-standings.ts
        // leadWorthNaming, the user's rule); the rest fold into "N more stats with no clear lead yet".
        const sections = await page.$$eval(`${body} [data-numbers-show]`, (els) =>
          els.map((sec) => ({
            season: sec.dataset.numbersShow,
            more: Number(sec.querySelector("[data-numbers-more]")?.dataset.numbersMore ?? 0),
            rows: [...sec.querySelectorAll("[data-numbers-row]")].map((e) => ({ key: e.dataset.numbersRow, n: Number(e.dataset.leaders), who: e.querySelector("[data-numbers-who]").textContent, faces: e.querySelector("[data-faces]")?.dataset.faces ?? null })),
          }))
        );
        let pairs = 0;
        let folded = 0;
        const off = [];
        for (const sec of sections) {
          statsOf[sec.season] ??= (await as.alex.call("GET", `/api/seasons/${sec.season}/stats?couch=${fx.couchId}`)).body;
          const field = statsOf[sec.season].cast.length;
          const leads = statsOf[sec.season].stats.filter((st) => st.key !== "points").map((st) => ({ key: st.key, ...leadersOf(sec.season, st.key) })).filter((l) => l.leaders.length);
          const named = leads.filter((l) => l.leaders.length === 1 || (l.leaders.length === 2 && l.top >= 2 && 2 <= field / 4));
          const want = named.map((l) => ({ key: l.key, n: l.leaders.length, who: l.leaders.length === 1 ? `${l.leaders[0]} leads` : `${joinNames(l.leaders)} lead`, faces: l.leaders.length === 2 ? "2" : null }));
          if (JSON.stringify(sec.rows) !== JSON.stringify(want) || sec.more !== leads.length - named.length) off.push({ season: sec.season, rows: sec.rows, want, more: sec.more });
          pairs += named.filter((l) => l.leaders.length === 2).length;
          folded += sec.more;
        }
        check(sections.length > 0 && off.length === 0, "every show's rows name only leads worth naming (one alone, or two on more than once), the rest folded into one line", JSON.stringify(off).slice(0, 600));
        check(folded > 0, `the fixture's ties on a count of one, and three or more, fold away (${folded} stats; ${pairs} named pairs)`);
        const more = page.locator(`${body} [data-numbers-show="${sid}"] [data-numbers-more]`);
        if (await more.count()) {
          await more.scrollIntoViewIfNeeded();
          await more.click();
          await page.waitForURL(/page=stats/);
          check(new URL(page.url()).searchParams.get("season") === sid, "and that line opens the show's every stat");
          await page.goBack();
          await page.waitForURL(/page=numbers/);
          await page.waitForTimeout(600);
        }
      } else if (key === "verdicts") {
        // Real since step 12 part 1 (check-new-episode-games.js has the ratings): a panel for each show alex has started.
        await page.locator(`${body} [data-verdict-show]`).first().waitFor({ timeout: 20_000 });
        check((await page.locator(`${body} [data-verdict-show]`).count()) >= 1 && (await page.locator(`${body} [data-preview]`).count()) === 0, "Couch verdicts: a panel per show alex has started, no Preview");
      } else if (key === "previously") {
        await page.locator(`${body} [data-po-last]`).first().waitFor({ timeout: 20_000 });
        const where = await page.locator(`${body} [data-previously]`).getAttribute("data-previously");
        check(where === sid || seasons.includes(where), "Previously on opens on one of your shows");
        await page.locator(`${body} [data-po="${sid}"]`).click();
        await page.locator(`${body} [data-previously="${sid}"] [data-po-last]`).first().waitFor({ timeout: 20_000 });
        check(/Up to Episode 5/.test(await text(`${body} [data-po-safe]`)), "Survivor 51: up to Episode 5, nothing past it");
        check((await page.locator(`${body} [data-po-ep]`).count()) === 5 && (await page.locator(`${body} [data-po-gone] > span`).count()) === 5, "five episodes, five gone (one a week)");
        check((await page.locator(`${body} [data-po-still]`).count()) === 1, "still in, by tribe");
        await shoot("more-previously-51", pageOpen);
        await page.locator(`${body} [data-po="${hx.seasons.s50}"]`).click();
        await page.locator(`${body} [data-previously="${hx.seasons.s50}"] [data-po-last]`).first().waitFor({ timeout: 20_000 });
        check((await page.locator(`${body} [data-po-ep]`).count()) === 13, "Survivor 50: all thirteen, to the finale");
      } else if (key === "trophies") {
        check((await page.locator(`${body} [data-plaque]`).count()) === 3 && /Ran it back/.test(await text(body)), "Trophy shelf: three plaques, Ran it back");
        check((await page.locator(`${body} [data-record]`).count()) === t.records.length && /riley holds the most, with 2/.test(await text(`${body} [data-hero]`)), "the couch's records, and who holds the most titles");
      }
      await collect();
      await fits(`More › ${key}`);
      await shoot(`more-${key}`, pageOpen);
      await page.goBack();
      await page.waitForTimeout(600);
      check(!page.url().includes("page=") && new URL(page.url()).pathname === "/home", `back closes ${key}`);
    }

    // ---- the profile sheet ----
    await page.getByRole("button", { name: "Your profile" }).click();
    await page.locator("[data-your-numbers]").waitFor();
    check(/1\s*Title/.test(await text("[data-your-numbers]")) && /3\s*Seasons played/.test(await text("[data-your-numbers]")), "the profile: your titles and seasons played", await text("[data-your-numbers]"));
    const me = nowHub.rankings.all.find((r) => r.userId === fx.users.alex);
    const placeLine = `${me.rank.startsWith("T") ? `Tied ${ordinal(me.place)}` : ordinal(me.place)} on the couch`;
    check(
      new RegExp(`${me.total}\\s*Couch points`).test(await text("[data-your-numbers]")) && new RegExp(`^${placeLine}\\s*${me.total} Couch points$`).test(await text("[data-your-place]")),
      `and your Couch points: "${placeLine} · ${me.total} Couch points", no "this year", no ranking points`,
      await text("[data-your-place]")
    );
    await collect();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, "profile.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // ---- the grow note's lines open their pages ----
    await hubReady("grow");
    check((await page.locator("[data-grow]").count()) === 3, "grows with you: rankings, By the numbers and the trophy shelf are all in, so each is a way in");
    await page.locator('[data-grow="trophies"]').click();
    await page.waitForURL(/page=trophies/);
    // (It slides in: wait for it rather than asking the instant the address changes.)
    const opened = await page.locator('[data-couch-page="trophies"]').waitFor({ state: "visible", timeout: 5000 }).then(() => true, (e) => e.message.split("\n")[0]);
    check(opened === true, "and opens its page", opened);
    if (opened !== true) await page.screenshot({ path: path.join(out, "grow-trophies-failed.png") });
    await page.goBack();
    await page.waitForTimeout(500);

    // ---- a week behind: results lead ----
    await markTo("alex", 4);
    await hubReady();
    check((await page.locator("[data-hub] [data-status]").getAttribute("data-status")) === "reveal" && /Final results are in · ZT Survivor Episode 5/.test(await text("[data-hub] [data-status]")), "a week behind: the status line leads with the results", await text("[data-hub] [data-status]"));
    check((await page.locator("[data-upnext]").getAttribute("data-upnext")) === "reveal" && /Episode 5 final results are in/i.test(await text("[data-upnext]")), "and so does Up next, with Reveal on its plate");
    await page.screenshot({ path: path.join(out, "hub-results-in.png") });
    await page.locator("[data-upnext] a.nd-press").click();
    await page.waitForURL(`**/show/${sid}/tonight`);
    await page.locator("[data-results-in='5']").waitFor({ timeout: 20_000 });
    check(true, "its plate opens the show at Results are in");
    await markTo("alex", 5);

    // ---- every hub entry showed somewhere ----
    const missing = Object.keys(PREVIEWS).filter((id) => id.startsWith("hub.") && !seen.has(id));
    check(missing.length === 0, "every hub.* Preview entry renders", missing.join(", "));

    // ---- Up next grows its art into the show bar ----
    await hubReady();
    await page.evaluate(() => (window.__vt.length = 0));
    await page.locator("[data-art-scope] h2 a").click();
    // Since 2026-10-30: the Tune in bumper (src/new/tune-in.tsx; check-tune-in.js checks it beat by beat).
    await page.locator("[data-tune-in]").waitFor({ timeout: 3000 });
    await page.waitForURL(`**/show/**/tonight`);
    await page.locator("[data-tune-in]").waitFor({ state: "detached", timeout: 8000 });
    // With no view transition under it (its snapshot froze the bumper mid-move: nav.tsx, NavMotion).
    const vts = await page.evaluate(() => window.__vt.map((v) => v.nav));
    check(vts.length === 0, "Up next: the Tune in bumper plays into the show, no view transition under it", JSON.stringify(vts));

    // ---- two newcomers level on Couch points share a place; last year's activity brings This year back; Studio ----
    const openPage = async (key) => {
      await hubReady();
      const row = page.locator(`[data-more="${key}"] button`);
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await page.waitForURL(new RegExp(`page=${key}`));
      await page.locator(`[data-couch-page="${key}"]`).waitFor();
      await page.waitForTimeout(700);
    };
    const newcomers = { kat: crypto.randomUUID(), lee: crypto.randomUUID(), mo: crypto.randomUUID(), nia: crypto.randomUUID() };
    try {
      for (const [who, id] of Object.entries(newcomers)) {
        await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, now(), now())`, [
          id, `zt_nd_${who}`, `zt_nd_${who}@example.invalid`,
        ]);
        await pool.query("INSERT INTO couch_members (couch_id, user_id) VALUES ($1, $2)", [fx.couchId, id]);
        await pool.query(`INSERT INTO user_days (user_id, day) VALUES ($1, ${EASTERN_TODAY})`, [id]);
      }
      const level = (await hubOf("alex")).rankings.all.filter((r) => Object.values(newcomers).includes(r.userId));
      check(level.length === 4 && level.every((r) => r.total === 11 && r.rank === "T5" && r.place === 5), "four newcomers, 10 for joining and 1 for today each: level, all T5", JSON.stringify(level));
      await openPage("rankings");
      const levelRows = await page.$$eval('[data-couch-page="rankings"] [data-rank-row^="zt_nd_"]', (els) => els.map((e) => [e.dataset.rankRow, e.dataset.rank]).filter(([n]) => /kat|lee|mo|nia/.test(n)));
      check(JSON.stringify(levelRows) === JSON.stringify(["kat", "lee", "mo", "nia"].map((n) => [`zt_nd_${n}`, "T5"])), "and the page shows them sharing it", JSON.stringify(levelRows));
      await shoot("rankings-ties", pageOpen);

      // A couch of eight: kat and lee level on the month's messages are a pair worth naming (two of eight, on more than one).
      for (const who of ["kat", "lee"])
        await pool.query("INSERT INTO chat_messages (league_id, user_id, author_name, type, text) SELECT $1, $2, $3, 'message', 'zt-pair ' || i FROM generate_series(1, 9) i", [
          fx.leagues.outlast, newcomers[who], `zt_nd_${who}`,
        ]);
      const pairHub = await hubOf("alex");
      const says = pairHub.accolades.find((a) => a.key === "chat");
      check(says?.who === "zt_nd_kat and zt_nd_lee" && says.tied?.length === 2, "Says the most: kat and lee, two of a couch of eight, named together", JSON.stringify(says));
      await openPage("numbers");
      await page.locator('[data-couch-page="numbers"] [data-accolades]').waitFor({ timeout: 20_000 });
      const pairRow = page.locator('[data-couch-page="numbers"] [data-accolade-row="chat"]');
      check((await pairRow.locator('[data-faces="2"]').count()) === 1 && /zt_nd_kat and zt_nd_lee · 9 messages this month/.test(await pairRow.textContent()), "and its row shows both faces in one square", await pairRow.textContent());
      check((await page.locator('[data-couch-page="numbers"] [data-accolade="chat"]').count()) === 0, "but never as a headline card");
      await pairRow.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, "numbers-pair.png") });

      await addLastYear();
      try {
        const withYear = await hubOf("alex");
        await openPage("rankings");
        const tabs = await page.$$eval('[data-couch-page="rankings"] [data-rank-tab]', (els) => els.map((e) => `${e.dataset.rankTab}${e.getAttribute("aria-selected") === "true" ? "*" : ""}`));
        check(tabs.join(",") === "year*,all,h2h" && /Couch points this year · of 8/.test(await text('[data-couch-page="rankings"] [data-hero]')), "with last year's activity: This year is back and opens first", tabs.join(","));
        await shoot("rankings-this-year", pageOpen);
        await page.goBack();
        await page.waitForTimeout(600);
        const line = standing(withYear.rankings.year, fx.users.alex);
        const want = line === "You lead the couch" ? "You lead the couch this year" : line;
        check((await text('[data-more="rankings"]')).includes(want), `and the hub's row reads this year's table ("${want}")`, await text('[data-more="rankings"]'));
      } finally {
        await dropLastYear();
      }

      await as.alex.call("PUT", "/api/me/profile", { theme: "studio" });
      await page.context().addCookies([{ name: "gys_theme", value: "studio", url: BASE }]);
      await openPage("rankings");
      await shoot("rankings-studio", pageOpen);
      await openPage("numbers");
      await page.locator('[data-couch-page="numbers"] [data-accolades]').waitFor({ timeout: 20_000 });
      await fits("By the numbers, Studio");
      await shoot("numbers-studio", pageOpen);
    } finally {
      await as.alex.call("PUT", "/api/me/profile", { theme: "night" });
      await page.context().addCookies([{ name: "gys_theme", value: "night", url: BASE }]);
      await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [Object.values(newcomers)]);
    }

    const real = errors.filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(e) && !/favicon\.ico/.test(e));
    check(real.length === 0, "no page errors", real.slice(0, 3).join(" | "));
  } catch (e) {
    failures++;
    console.log("FAIL  " + (e.stack || e));
  } finally {
    await close();
    if (!args.includes("--keep")) {
      await hubFixture.down(pool);
      await fixture.down(pool);
    }
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
