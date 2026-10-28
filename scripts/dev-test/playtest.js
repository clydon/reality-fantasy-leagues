// Dev-only: replays (docs/PLAN-playtests.md step P3). A season on tape (scripts/dev-test/tapes.js) played through today's
// engine, episode by episode, by groups of players with the friend-group archetypes' habits (by role only: the repo is
// public), in games of every kind and setting, so P4 can judge whether each game is fun, makes sense and plays well.
//
// Everything goes through the app's own code, loaded with jiti as the unit tests load it (no dev server needed):
//   - the season: a zt- copy of the recorded season (show slug zt-pt-<show>, the same name, format, rulebook, cast and
//     listed episodes, moved forward whole weeks to start about a week from today, with the dates in its answers moved the
//     same: nothing has aired by the clock, so an episode closes when its results land), so neither the recorder nor the
//     lane's own copy of the season (and any league on it) is touched;
//   - each game: Start a game (start-game.ts startGame, with the couch it's for and a `now` before its first episode), its
//     settings written as Game settings writes them, everyone else in through Join (couch-joins.ts joinGame), the draft
//     through the draft room's own writes (draft.ts startDraft, pickInDraft, lockBlindFor: the forgetter's picks made for
//     them by whoever runs it, "made for someone else"), computer players seated by Start a game and played by bots.ts;
//   - each week's moves: the lineup and pick routes' own writes (validateLineup + setActiveRosterLineup, setPickEmPick)
//     under withLeagueLock, and waiver claims (waivers.js saveClaim, then the commissioner's Process now);
//   - each episode's results: the bot's own run (db/bot-research.js runJob, quick then full, with bot-results.ts botSend:
//     Autopilot), its answers from the tape (tapes.js answerer), so what reaches the games is the season sync's own.
//
//   node scripts/dev-test/playtest.js matrix <show> <season>        the replays the pairwise set picks for a season, and why
//   node scripts/dev-test/playtest.js run <show> <season> [--only=1,4] [--keep] [--through=N]
//                                                 play them (all, or those numbers), episode by episode; write each replay
//                                                 to rfl-tapes\replays\<show>-<season>-<game>-<settings>-<group>.json with
//                                                 a .md beside it; then down, unless --keep (left for looks at 390)
//   node scripts/dev-test/playtest.js summary                       a line per replay on file, for P4 (also replays\SUMMARY.md)
//   node scripts/dev-test/playtest.js down                          take out everything a replay made (zt-pt- keyed)
//
// Players are zt_pt_<role> accounts (password zt-pass-12345), one per seat label ("Tinkerer", "Forgetter 2"): the
// tinkerer runs every game (Commissioner); a solo group is the tinkerer against three computer players (the practice
// couch's shape). Habits, deterministic (a fixed hash of the role and the episode, so a replay plays the same twice):
//   tinkerer    sets the best lineup or pick every week (the sharpest read), claims on waivers, drafts by the numbers
//   forgetter   misses the draft (whoever runs it picks for them, first on the list) and most weeks (remembers 1 in 3)
//   drive-by    first on the list for everything; sets a lineup once, and again only when a starter has gone home
//   fan         picks favourites (taste over form) and backs them every other week
//   reader      reads the danger (votes, idols, numbers): a solid player, skips one week in ten
//   contrarian  goes against the room: never the obvious pick
//   steady      solid, every week, nothing fancy
// A late joiner (late=yes) is the group's last seat, joining a third of the way in through Join, live.
//
// Every row it makes is keyed: the show (slug zt-pt-<show>, and so its season, research and results with it), the games on
// it (their slugs renamed zt-pt-...), the couches (named "ZT Playtest · ..."), the zt_pt_ users. `run` brings it down
// first, and again at the end unless --keep. Refuses a database that isn't local. Needs the lane's .env.local and its
// migrations run; asks no bot (the tape answers).
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..", "..");
const PASSWORD = "zt-pass-12345";
const DAY = 86_400_000;
const SLUG = (show) => `zt-pt-${show}`;
const COUCH = "ZT Playtest";

// ---------- the matrix (pure) ----------

const NA = "-";
// Each setting and its values. game: Start a game's three for a competition; own: ownership (exclusive = a turn-based
// draft, shared = the blind draft); size: the team (Outlast) or the lineup and bench (Weekly Lineup); span: the whole
// season, from a third of the way in, one episode, from the merge, through half; late: someone joins a third of the way
// in; waivers: Start a game's own (on) or none; group: how many people (1 = you and three computer players).
const DIMENSIONS = {
  game: ["outlast", "weeklyLineup", "survivalPool"],
  own: ["exclusive", "shared"],
  size: ["small", "standard", "big"],
  span: ["season", "from", "one", "merge", "through"],
  late: ["no", "yes"],
  waivers: ["on", "off"],
  group: [1, 2, 4, 8, 16],
};

/** Which settings mean something for a config (the rest are NA): a pool has no teams, a one-episode game no late joiner. */
function applies(c, dim) {
  const pool = c.game === "survivalPool";
  if (dim === "own" || dim === "size") return !pool;
  if (dim === "waivers") return !pool && c.span !== "one";
  if (dim === "late") return c.group > 1 && c.span !== "one";
  return true;
}

/** Every config of the dimensions, settings that don't apply set to NA, each once. */
function allConfigs(dims = DIMENSIONS, season = {}) {
  const keys = Object.keys(dims);
  let out = [{}];
  for (const k of keys) out = out.flatMap((c) => dims[k].map((v) => ({ ...c, [k]: v })));
  const seen = new Set();
  const configs = [];
  for (const c of out) {
    if (c.span === "merge" && !season.merge) continue;
    const n = { ...c };
    for (const k of keys) if (!applies(c, k)) n[k] = NA;
    const key = keyOf(n);
    if (seen.has(key)) continue;
    seen.add(key);
    configs.push(n);
  }
  return configs;
}

const keyOf = (c) => Object.keys(DIMENSIONS).map((k) => `${k}=${c[k]}`).join("|");
/** The pairs of settings a config covers (two settings that both apply). */
function pairsOf(c) {
  const keys = Object.keys(DIMENSIONS).filter((k) => c[k] !== NA && c[k] !== undefined);
  const out = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) out.push(`${keys[i]}=${c[keys[i]]}&${keys[j]}=${c[keys[j]]}`);
  return out;
}

/**
 * The replays to run: a greedy pairwise set, so every pair of settings that can go together is played at least once (the
 * whole matrix is thousands). Deterministic: the config covering the most pairs not yet covered, the first such on a tie.
 * Pure.
 */
function pairwise(dims = DIMENSIONS, season = {}) {
  const configs = allConfigs(dims, season);
  const need = new Set(configs.flatMap(pairsOf));
  const picked = [];
  while (need.size) {
    let best = null;
    let bestN = 0;
    for (const c of configs) {
      const n = pairsOf(c).filter((p) => need.has(p)).length;
      if (n > bestN) {
        best = c;
        bestN = n;
      }
    }
    if (!best) break;
    picked.push(best);
    for (const p of pairsOf(best)) need.delete(p);
  }
  return { picked, pairs: new Set(configs.flatMap(pairsOf)).size, configs: configs.length };
}

/** A replay's file name: <show>-<season>-<game>-<settings>-<group>. */
function replayName(show, season, c) {
  const settings = [c.own, c.size, c.span, c.late === "yes" ? "late" : null, c.waivers === "off" ? "nowaivers" : c.waivers === "on" ? "waivers" : null]
    .filter((x) => x && x !== NA)
    .join("-");
  return `${show}-${season}-${c.game}-${settings || "default"}-${c.group === 1 ? "solo" : `g${c.group}`}`;
}

// ---------- who plays (pure) ----------

// The archetypes, by role only (docs/ARCHETYPES.md; the repo is public). `every`: the share of weeks they make a move.
const ROLES = {
  tinkerer: { name: "Tinkerer", level: "sharp", every: 1, draft: "rank", moves: "best", waivers: "claim" },
  forgetter: { name: "Forgetter", level: "casual", every: 1 / 3, draft: "absent", moves: "best", waivers: "none" },
  driveby: { name: "Drive-by", level: "casual", every: 1, draft: "list", moves: "once", waivers: "owed" },
  fan: { name: "Fan", level: "casual", every: 1 / 2, draft: "taste", moves: "taste", waivers: "owed" },
  reader: { name: "Reader", level: "solid", every: 0.9, draft: "rank", moves: "best", waivers: "claim" },
  contrarian: { name: "Contrarian", level: "solid", every: 1, draft: "contrary", moves: "contrary", waivers: "owed" },
  steady: { name: "Steady", level: "solid", every: 1, draft: "rank", moves: "best", waivers: "claim" },
};
// A group's seats in order: the tinkerer runs it; bigger groups add more forgetters and drive-bys, as real ones do.
const SEAT_ORDER = ["tinkerer", "forgetter", "driveby", "fan", "reader", "contrarian", "steady", "forgetter", "driveby", "fan", "reader", "contrarian", "steady", "forgetter", "driveby", "fan"];

/** A group's seats: [{ role, label, username }], numbered when a role repeats ("Forgetter 2", zt_pt_forgetter2). */
function seatsFor(group) {
  const count = {};
  return SEAT_ORDER.slice(0, group).map((role) => {
    count[role] = (count[role] || 0) + 1;
    const n = count[role] > 1 ? count[role] : "";
    return { role, label: `${ROLES[role].name}${n ? ` ${n}` : ""}`, username: `zt_pt_${role}${n}` };
  });
}

// FNV-1a to [0, 1), then murmur3's finalizer: FNV alone gives near-identical values for "week|4" and "week|5", so a
// seat's weeks would all fall on the same side. Fixed per seat and episode, so a replay plays the same twice.
function hash01(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/**
 * Whether a seat makes its move this week: exactly its role's `every` of the weeks, spread evenly (a third: one week in
 * three), from a starting point of its own, so two forgetters don't forget the same weeks. Pure.
 */
function movesThisWeek(seat, n) {
  const every = ROLES[seat.role].every;
  if (every >= 1) return true;
  const at = n + Math.floor(hash01(`${seat.username}|weeks`) / every);
  return Math.floor(at * every) > Math.floor((at - 1) * every);
}

const LEVELS = { casual: { read: 0.4, gut: 2.5 }, solid: { read: 1, gut: 0.4 }, sharp: { read: 1.4, gut: 0.1 } };

/**
 * A seat's order of preference among castaways, by its habit: `rank` (the ratings at its level, with a little taste),
 * `taste` (favourites: taste dominates), `list` (the cast in the order the app lists it), `contrary` (the room's
 * consensus reversed, keeping out anyone out of the game). `ratings` is bot-logic.js's (what the league knows); `key` one
 * of its ratings (value, points, safety). Pure.
 */
function prefer(seat, ids, { ratings, key = "value", listOrder = [], how = null, names = null }) {
  const habit = how || ROLES[seat.role].draft;
  const lvl = LEVELS[ROLES[seat.role].level] || LEVELS.solid;
  const r = ratings || {};
  const live = ids.filter((id) => !ratings || r[id]);
  // By name where known (a castaway's id is new in every game), so a seat likes the same people every replay.
  const taste = (id) => hash01(`${seat.username}|${(names && names[id]) || id}`);
  if (habit === "list" || habit === "absent") return [...live].sort((a, b) => listOrder.indexOf(a) - listOrder.indexOf(b));
  if (habit === "taste") return [...live].sort((a, b) => taste(b) * 3 + (r[b]?.[key] ?? 0) * 0.3 - (taste(a) * 3 + (r[a]?.[key] ?? 0) * 0.3));
  const score = (id) => (r[id]?.[key] ?? 0) + taste(id) * lvl.gut;
  const best = [...live].sort((a, b) => score(b) - score(a));
  if (habit === "contrary") {
    // Not the obvious ones: skip the room's top third, then take the rest best first.
    const skip = Math.max(1, Math.floor(best.length / 3));
    return [...best.slice(skip), ...best.slice(0, skip)];
  }
  return best;
}

/** The merge, from a tape's full answers: the first episode anyone won individual immunity (null: no merge seen). Pure. */
function mergeOf(fullAnswers) {
  for (const t of [...fullAnswers].sort((a, b) => a.episode - b.episode)) {
    const cast = (t.parsed && t.parsed.castaways) || [];
    if (cast.some((c) => String(c.wonIndividualImmunity).toLowerCase() === "yes")) return t.episode;
  }
  return null;
}

/** Where a config's game starts and ends, and when a late joiner joins, for a season of `episodes`. Pure. */
function spanOf(c, episodes, merge) {
  let from = 1;
  let to = null;
  if (c.span === "from") from = Math.max(2, Math.round(episodes / 3));
  if (c.span === "one") from = to = Math.ceil(episodes / 2);
  if (c.span === "merge") from = merge;
  if (c.span === "through") to = Math.max(2, Math.floor(episodes / 2));
  const end = to ?? episodes;
  const late = c.late === "yes" ? Math.min(end, from + Math.max(1, Math.ceil((end - from) / 3))) : null;
  return { from, to, late: late && late > from ? late : null };
}

// ---------- the app (loaded on demand) ----------

let app = null;
function appCode() {
  if (app) return app;
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) throw new Error("playtest.js only runs against a local database (AUTH_DATABASE_URL)");
  const jiti = require("jiti")(__filename, { alias: { "@db": path.join(ROOT, "db"), "@": path.join(ROOT, "src"), "next/server": path.join(__dirname, "next-after-stub.js") } });
  const ts = (f) => jiti(path.join(ROOT, "src", "lib", "server", `${f}.ts`));
  const db = ts("db");
  app = {
    pool: db.pool,
    withLeagueLock: db.withLeagueLock,
    S: require("../../src/lib/game/state-logic.js"),
    Bots: require("../../src/lib/game/bot-logic.js"),
    BotResearch: require("../../db/bot-research.js"),
    Waivers: require("../../src/lib/server/waivers.js"),
    startGame: ts("start-game").startGame,
    joins: ts("couch-joins"),
    schedules: ts("schedule").seasonSchedules,
    backstage: { ...ts("backstage-games"), scope: ts("backstage").backstageScope },
    draft: ts("draft"),
    botSend: ts("bot-results").botSend,
    breakdown: jiti(path.join(ROOT, "src", "lib", "game", "team-episode-breakdown.ts")).teamEpisodeBreakdown,
    bullets: jiti(path.join(ROOT, "src", "lib", "game", "episode-team-summary.ts")).episodeTeamBullets,
  };
  return app;
}

const one = async (sql, params) => (await appCode().pool.query(sql, params)).rows[0] ?? null;

// ---------- down ----------

async function down() {
  const { pool } = appCode();
  const users = (await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_pt\\_%'`)).rows.map((r) => r.id);
  const shows = (await pool.query("SELECT id, slug FROM shows WHERE slug LIKE 'zt-pt-%'")).rows;
  const leagues = await pool.query(
    `DELETE FROM leagues WHERE slug LIKE 'zt-pt-%' OR state->'settings'->>'showId' LIKE 'zt-pt-%' OR created_by = ANY($1::text[]) RETURNING id`,
    [users]
  );
  await pool.query("DELETE FROM league_groups WHERE created_by = ANY($1::text[])", [users]);
  await pool.query(`DELETE FROM couches WHERE name LIKE '${COUCH} ·%' AND (created_by = ANY($1::text[]) OR created_by IS NULL)`, [users]);
  // The show and everything keyed on it (its season, episodes, cast, research, results, the bot's runs) go with it.
  if (shows.length) await pool.query("DELETE FROM shows WHERE id = ANY($1::uuid[])", [shows.map((s) => s.id)]);
  if (users.length) await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [users]);
  return `${leagues.rowCount} game(s), ${shows.length} show(s), ${users.length} player(s)`;
}

// ---------- up: the season's copy, the players ----------

/** A zt- copy of a recorded season: the show (same name and format), the season (moved to start next week), its episodes and cast. */
async function copySeason(show, season) {
  const { pool } = appCode();
  const Tapes = require("./tapes");
  const tape = Tapes.readTape(show, season);
  if (!tape.season || !tape.season.seasonId) throw new Error(`${show} ${season} has no tape (tapes.js status)`);
  const realId = tape.season.seasonId;
  const real = await one("SELECT ss.*, s.id AS sid FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [realId]);
  if (!real) throw new Error(`${show} ${season}: the tape's season isn't in this database (tapes.js load ${show} ${season})`);
  const sh = await one(
    `INSERT INTO shows (slug, name, castaway_term, tribe_term, wiki_api_url, cast_section_heading, research_domains, format, kind, set_up_at, listing, episode_term, art_off)
     SELECT $2, name, castaway_term, tribe_term, wiki_api_url, cast_section_heading, research_domains, format, kind, set_up_at, listing, episode_term, true
       FROM shows WHERE id = $1 RETURNING id`,
    [real.sid, SLUG(show)]
  );
  // The real season moved forward a whole number of weeks, to start about a week from today (weekdays and same-night
  // double episodes kept): every episode is still to air by the clock, so its lineups and picks stay open until its results
  // land (results close an episode whatever the clock says), a waiver week runs until whoever runs it says Run now, and
  // Start a game's `now` (an hour before an episode's airing) starts a game with any episode. Airing, not completed: a
  // finished season is closed to Start a game. Every date in the recorded answers moves by the same shift (shiftAnswer).
  const realSchedule = (await appCode().schedules([realId])).get(realId);
  const firstAir = realSchedule?.episodes.find((e) => e.airAt)?.airAt ?? real.premiere_date;
  const shiftDays = 7 * Math.max(1, Math.ceil((Date.now() + 7 * DAY - new Date(firstAir).getTime()) / (7 * DAY)));
  const ss = await one(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, cast_size, cast_approved_at, tribes_from_episode, air_tz,
                               episode_count, cast_tribes_confirmed, episode_minutes, release, drop_at, rulebook_id, rulebook_live, results_by,
                               results_admin_since)
     SELECT $2, season_number, name, 'airing', premiere_date + $3::int, air_time, cast_size, COALESCE(cast_approved_at, now()), tribes_from_episode,
            air_tz, episode_count, cast_tribes_confirmed, episode_minutes, release, drop_at + make_interval(days => $3::int), rulebook_id, rulebook_live,
            results_by, results_admin_since
       FROM show_seasons WHERE id = $1 RETURNING id`,
    [realId, sh.id, shiftDays]
  );
  await pool.query(
    `INSERT INTO season_episodes (season_id, number, air_at, runtime_min, note, source, title)
     SELECT $2, number, air_at + make_interval(days => $3::int), runtime_min, note, source, title FROM season_episodes WHERE season_id = $1`,
    [realId, ss.id, shiftDays]
  );
  await pool.query(
    `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order, locked_at, role, provider_ids, shown_from)
     SELECT $2, name, tribe_name, photo_url, sort_order, locked_at, role, provider_ids, shown_from FROM season_cast WHERE season_id = $1`,
    [realId, ss.id]
  );
  const schedule = (await appCode().schedules([ss.id])).get(ss.id);
  const episodes = (schedule?.episodes ?? []).map((e) => ({ number: e.number, air_at: e.airAt }));
  const fulls = tape.files.filter((f) => f.kind === "full" && f.ok);
  // A cast the recorder staged and nobody approved (a set-up show's new season: P1's Noticed) is approved on the copy, as
  // the classic admin's Approve would, so its games have someone to draft.
  const approved = !!real.cast_approved_at;
  return { seasonId: ss.id, showId: sh.id, show, number: season, shiftDays, approved, episodes, tape, merge: mergeOf(fulls), episodeCount: tape.season.episodeCount || episodes.length };
}

/** The zt_pt_ account for a seat (made once): SessionUser's shape. */
async function userFor(seat) {
  const { pool } = appCode();
  const found = await one(`SELECT * FROM "user" WHERE username = $1`, [seat.username]);
  if (found) return found;
  const { hashPassword } = await import("better-auth/crypto");
  const id = `zt-pt-${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, $4, $2, 'user', true, now(), now())`,
    [id, seat.label, `${seat.username}@example.invalid`, seat.username]
  );
  await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
    crypto.randomUUID(),
    id,
    await hashPassword(PASSWORD),
  ]);
  await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);
  return one(`SELECT * FROM "user" WHERE id = $1`, [id]);
}

/** A couch for one replay: its seats on it (the tinkerer owns it), each following the season. */
async function couchFor(n, seats, users, seasonId) {
  const { pool } = appCode();
  const lead = users[seats[0].username];
  const couch = await one("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [`${COUCH} · ${n}`, lead.id]);
  for (const s of seats) {
    const u = users[s.username];
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [couch.id, u.id, u.id === lead.id ? "owner" : "member"]);
    await pool.query(
      `INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 0) ON CONFLICT (user_id, season_id) DO UPDATE SET following = true, private = false`,
      [u.id, seasonId]
    );
  }
  return couch.id;
}

// ---------- a game ----------

const memberOf = async (leagueId, userId) => {
  const m = await one("SELECT role, player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
  return m ? { role: m.role, playerId: m.player_id } : null;
};
/** Backstage as whoever runs a replay's game sees it (the tinkerer). */
const scopeOf = (r) => appCode().backstage.scope(r.users[r.seats[0].username], r.seasonId, r.couchId);
const stateOf = async (leagueId) => (await one("SELECT state FROM leagues WHERE id = $1", [leagueId])).state;

/**
 * A config's settings as a person would make them: ownership through classic's League Settings (the new design has no
 * choice for it), the team or lineup through Backstage's Game settings (settingsWrite, with its own checks), and waivers
 * off through Backstage's Waivers Fine-tune (waiverWrite). "standard" is whatever Start a game gave. small and big are
 * what someone sensible picks: big on an exclusive game is cut to what the cast still in can fill, and says so.
 * Returns [{ how, set }] in order.
 */
function settingsFor(c, s) {
  const out = [];
  const lineup = c.game === "weeklyLineup";
  if (c.own !== NA && s.settings.ownershipMode !== c.own) out.push({ how: "classic", set: { ownershipMode: c.own } });
  const stillIn = s.castaways.filter((x) => x.status === "active").length;
  const teams = s.players.filter((p) => p.active !== false).length || 1;
  const fits = c.own === "shared" ? stillIn : Math.floor(stillIn / Math.max(1, teams));
  const cut = (want) => Math.max(1, Math.min(want, fits));
  if (lineup && c.size !== "standard" && c.size !== NA) {
    let [a, b] = c.size === "small" ? [2, 1] : [4, 2];
    while (a + b > fits && b > 0) b--;
    while (a + b > fits && a > 1) a--;
    out.push({ how: "settings", set: { activeSlots: a, benchSlots: b }, ...(c.size === "big" && a + b < 6 ? { cut: `big cut to ${a}+${b}: ${stillIn} still in for ${teams} teams` } : {}) });
  }
  if (c.game === "outlast" && c.size === "small") out.push({ how: "settings", set: { teamSize: cut(2) } });
  if (c.game === "outlast" && c.size === "big") {
    const want = (s.settings.teamSize || 3) + 2;
    out.push({ how: "settings", set: { teamSize: cut(want) }, ...(cut(want) < want ? { cut: `big cut to ${cut(want)}: ${stillIn} still in for ${teams} teams` } : {}) });
  }
  if (c.waivers === "off") out.push({ how: "waivers", set: { replaceRule: "never", waiverWindows: { schedule: "manual", every: 3, swaps: 0 } } });
  return out;
}

/**
 * Someone on the couch joins a game, as Join does: straight in where Who can join is Anyone on the couch; where it's Ask me
 * first (an exclusive game's default), they ask and whoever runs it lets them in, then they join.
 */
async function join(r, seat, body = {}) {
  const { joins } = appCode();
  const user = r.users[seat.username];
  try {
    return await joins.joinGame(user, r.couchId, r.leagueId, body);
  } catch (e) {
    if (!/Ask to join first/.test(e.message)) throw e;
    await joins.askToJoin(user, r.couchId, r.leagueId);
    const req = await one("SELECT id FROM game_join_requests WHERE league_id = $1 AND user_id = $2 AND decided_at IS NULL", [r.leagueId, user.id]);
    await joins.answerRequest(r.users[r.seats[0].username], r.couchId, req.id, true);
    r.asked = (r.asked || 0) + 1;
    return joins.joinGame(user, r.couchId, r.leagueId, body);
  }
}

/** A late joiner's Join: live, where Join offers (joinOptions' live start), with a team from its pool, picked by habit. */
async function lateTeam(r, seat, planned) {
  const { joins, Bots } = appCode();
  const user = r.users[seat.username];
  const offered = await joins.joinOptions(user, r.couchId, r.leagueId, null);
  const start = offered.starts ? offered.starts.live : planned;
  if (start !== planned) r.problems.push(`${seat.label} meant to join from episode ${planned}; Join offers ${start} (the episodes before have no results)`);
  const o = await joins.joinOptions(user, r.couchId, r.leagueId, start);
  if (!o.team || !o.pool.length) return { start };
  const s = await stateOf(r.leagueId);
  const ids = prefer(seat, o.pool.map((c) => c.id), { ratings: Bots.ratings(s, LEVELS[ROLES[seat.role].level]), listOrder: o.pool.map((c) => c.id), names: namesOf(s) });
  const team = ids.slice(0, o.team);
  r.log.push(`${seat.label}'s team on joining (${o.team} from ${o.pool.length} offered): ${team.map((id) => castName(s, id)).join(", ")}`);
  return { start, team };
}

/** Start a game for a config on its couch, at `now` (just before its first episode airs), with its settings and players. */
async function startOne(r, season) {
  const { startGame, withLeagueLock, S, pool, backstage } = appCode();
  const lead = r.users[r.seats[0].username];
  const firstAir = season.episodes.find((e) => e.number === r.span.from)?.air_at;
  const now = new Date((firstAir ? new Date(firstAir).getTime() : Date.now()) - 60 * 60 * 1000);
  const body = { game: r.config.game, tell: false, ...(r.span.to != null ? { to: r.span.to } : {}), ...(r.config.group === 1 ? { bots: 3, level: "normal" } : {}) };
  const started = await startGame(lead, season.seasonId, r.couchId, body, now);
  r.leagueId = started.leagueId;
  if (started.from !== r.span.from) r.problems.push(`Start a game began with episode ${started.from}, not ${r.span.from} as the span planned`);
  r.log.push(`Start a game: ${started.gameName} from episode ${started.from}${started.to ? ` to ${started.to}` : ""}${body.bots ? `, ${body.bots} computer players` : ""}`);
  await pool.query("UPDATE leagues SET slug = $2 WHERE id = $1", [r.leagueId, `zt-pt-${r.n}-${r.leagueId.slice(0, 8)}`]);
  // Everyone else joins before the draft (the latecomer later).
  for (const seat of r.seats.slice(1)) {
    if (seat === r.lateSeat) continue;
    await join(r, seat);
  }
  if (r.asked) r.log.push(`Who can join is Ask me first: ${r.asked} asked to join and were let in by whoever runs it`);
  const writes = settingsFor(r.config, await stateOf(r.leagueId));
  for (const w of writes) {
    const words = Object.entries(w.set).map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ");
    try {
      if (w.how === "classic") {
        await withLeagueLock(r.leagueId, (st) => {
          for (const [k, v] of Object.entries(w.set)) S.updateSettings(st, k, v);
        });
      } else if (w.how === "settings") await backstage.settingsWrite(await scopeOf(r), r.leagueId, { set: w.set });
      else await backstage.waiverWrite(await scopeOf(r), r.leagueId, { action: "set", set: w.set });
      r.log.push(`${w.how === "classic" ? "League Settings" : w.how === "settings" ? "Game settings" : "Waivers › Fine-tune"}: ${words}${w.cut ? ` (${w.cut})` : ""}`);
    } catch (e) {
      if (/doesn't use waivers/.test(e.message)) r.log.push(`Waivers › Fine-tune: ${e.message} (nothing to turn off)`);
      else r.problems.push(`Setting ${words} was refused: ${e.message}`);
    }
  }
  await seatIds(r);
  if (S.getLeagueType(await stateOf(r.leagueId)).hasRoster) await draft(r);
  // After the draft: waivers are fitted to the teams once it starts (WaiverLogic.refit).
  r.settings = pickSettings(await stateOf(r.leagueId), S);
}

const pickSettings = (s, S) => ({
  type: s.settings.leagueTypeId,
  ownership: s.settings.ownershipMode,
  teamSize: S.rosterSize(s),
  activeSlots: s.settings.activeSlots,
  benchSlots: s.settings.benchSlots,
  startEpisode: s.settings.startEpisode ?? 1,
  endEpisode: s.settings.endEpisode ?? null,
  waivers: S.WaiverLogic.enabled(s) ? S.WaiverLogic.config(s) : "off",
  players: s.players.length,
});

/** Each seat's player id in the game (and the computer players'). */
async function seatIds(r) {
  const s = await stateOf(r.leagueId);
  for (const seat of r.seats) {
    const m = await memberOf(r.leagueId, r.users[seat.username].id);
    if (m) seat.playerIds = { ...(seat.playerIds || {}), [r.n]: m.playerId };
  }
  r.bots = s.players.filter((p) => p.automated).map((p) => ({ id: p.id, name: p.name }));
}
const pidOf = (r, seat) => seat.playerIds && seat.playerIds[r.n];
const seatOf = (r, pid) => r.seats.find((x) => pidOf(r, x) === pid) || null;
const nameIn = (s, pid) => s.players.find((p) => p.id === pid)?.name ?? pid;
const castName = (s, id) => s.castaways.find((c) => c.id === id)?.name ?? id;
const listOrder = (s) => s.castaways.map((c) => c.id);
const namesOf = (s) => Object.fromEntries(s.castaways.map((c) => [c.id, c.name]));

/** The draft, through the draft room's writes: the turn-based one turn by turn, the blind one each locking in. */
async function draft(r) {
  const { draft: D, S, Bots } = appCode();
  const lead = r.users[r.seats[0].username];
  const leadActor = { user: lead, membership: await memberOf(r.leagueId, lead.id) };
  let s = await D.startDraft(leadActor, r.leagueId);
  const shared = s.settings.ownershipMode === "shared";
  const picks = {};
  if (!shared) {
    for (let guard = 0; guard < 600; guard++) {
      const turn = S.currentDraftTurn(s);
      if (!turn || turn.isComplete) break;
      const seat = seatOf(r, turn.playerId);
      if (!seat) break; // a computer player's turn not taken (bots.ts takes them inside each write): stop and say so
      const free = s.castaways.filter((c) => c.status === "active" && !(c.ownerIds || []).length).map((c) => c.id);
      const habit = ROLES[seat.role].draft;
      const order = prefer(seat, free, { ratings: Bots.ratings(s, LEVELS[ROLES[seat.role].level]), listOrder: listOrder(s), names: namesOf(s) });
      if (!order.length) {
        r.problems.push(`The draft ran out of castaways at pick ${s.draftPicksMade + 1}: ${s.draftOrder.length} teams of ${S.rosterSize(s)} need ${s.draftOrder.length * S.rosterSize(s)}, and ${s.castaways.filter((c) => c.status === "active").length} are still in`);
        break;
      }
      const forgot = habit === "absent";
      const actor = forgot ? leadActor : { user: r.users[seat.username], membership: await memberOf(r.leagueId, r.users[seat.username].id) };
      ({ state: s } = await D.pickInDraft(actor, r.leagueId, order[0]));
      (picks[seat.label] ||= []).push(`${castName(s, order[0])}${forgot ? " (picked for them)" : ""}`);
    }
    const turn = S.currentDraftTurn(s);
    if (turn && !turn.isComplete) r.problems.push(`The draft stopped at pick ${s.draftPicksMade + 1}: nobody's turn the replay could take`);
  } else {
    const size = S.rosterSize(s);
    const active = s.castaways.filter((c) => c.status === "active").map((c) => c.id);
    for (const seat of r.seats) {
      const pid = pidOf(r, seat);
      if (!pid || seat === r.lateSeat) continue;
      const habit = ROLES[seat.role].draft;
      const ids = prefer(seat, active, { ratings: Bots.ratings(s, LEVELS[ROLES[seat.role].level]), listOrder: listOrder(s), names: namesOf(s) }).slice(0, size);
      const forgot = habit === "absent";
      const actor = forgot ? leadActor : { user: r.users[seat.username], membership: await memberOf(r.leagueId, r.users[seat.username].id) };
      s = await D.lockBlindFor(actor, r.leagueId, pid, ids);
      picks[seat.label] = ids.map((id) => castName(s, id) + (forgot ? " (locked in for them)" : ""));
    }
    if (!S.BlindDraftLogic.isRevealed(s)) r.problems.push("The blind draft didn't reveal once everyone had locked in");
  }
  s = await stateOf(r.leagueId);
  for (const b of r.bots) picks[`${b.name} (computer)`] = s.castaways.filter((c) => (c.ownerIds || []).includes(b.id)).map((c) => c.name);
  r.draft = picks;
}

// ---------- each week ----------

/** Who's on a seat's team still in the game, and the episode being chosen for. */
function teamOf(s, pid) {
  return s.castaways.filter((c) => c.status === "active" && (c.ownerIds || []).includes(pid)).map((c) => c.id);
}

/** Every seat's move for the episode coming up, by its habit, through the routes' own writes. */
async function moves(r, n) {
  const { S, Bots, withLeagueLock } = appCode();
  const week = {};
  let s = await stateOf(r.leagueId);
  if (!S.inPlay(s, n)) return week;
  const type = S.getLeagueType(s);
  for (const seat of r.seats) {
    const pid = pidOf(r, seat);
    if (!pid) continue;
    const role = ROLES[seat.role];
    const on = movesThisWeek(seat, n);
    s = await stateOf(r.leagueId);
    const episode = s.episodes.find((e) => e.number === n);
    if (!episode) {
      week[seat.label] = "no episode to choose for";
      continue;
    }
    if (type.hasActiveRoster) {
      const mine = teamOf(s, pid);
      const slots = S.ActiveRosterLogic.activeSlots(s);
      const current = S.ActiveRosterLogic.lineupFor(s, episode.id, pid) || [];
      const carried = S.ActiveRosterLogic.lineupIsCarried(s, episode.id, pid);
      const ratings = Bots.ratings(s, LEVELS[role.level]);
      let want = null;
      if (role.moves === "once") {
        // Set once, then only when the lineup is short: someone on it went home (the app takes them out of it).
        const kept = current.filter((id) => mine.includes(id));
        if (!current.length) want = prefer(seat, mine, { how: "list", listOrder: listOrder(s), names: namesOf(s) }).slice(0, slots);
        else if (kept.length < Math.min(slots, mine.length)) want = [...kept, ...mine.filter((id) => !kept.includes(id))].slice(0, slots);
      } else if (on) {
        want = prefer(seat, mine, { ratings, key: "points", how: role.moves === "best" ? "rank" : role.moves, listOrder: listOrder(s), names: namesOf(s) }).slice(0, slots);
      }
      if (!want) {
        week[seat.label] = current.length ? `kept ${carried ? "last week's lineup (carried)" : "its lineup"}: ${current.map((id) => castName(s, id)).join(", ")}` : "no lineup (forgot)";
        continue;
      }
      if (current.length && !carried && want.length === current.length && want.every((id) => current.includes(id))) {
        week[seat.label] = `looked, kept ${want.map((id) => castName(s, id)).join(", ")}`;
        continue;
      }
      try {
        await withLeagueLock(r.leagueId, (st) => {
          const problem = S.ActiveRosterLogic.validateLineup(st, episode.id, pid, want);
          if (problem) throw new Error(problem);
          S.setActiveRosterLineup(st, episode.id, pid, want);
        });
        week[seat.label] = `set ${want.map((id) => castName(s, id)).join(", ")}`;
      } catch (e) {
        week[seat.label] = `couldn't set a lineup: ${e.message}`;
        r.problems.push(`Episode ${n}: ${seat.label}'s lineup refused: ${e.message}`);
      }
    } else if (type.hasWeeklyPicks) {
      const { available } = S.PickEmLogic.eligibility(s, episode.id, pid);
      const existing = S.PickEmLogic.pickFor(s, episode.id, pid);
      if (!available.length) {
        week[seat.label] = existing ? `kept ${castName(s, existing.castawayId)}` : "nobody left to pick";
        continue;
      }
      const lazy = role.moves === "once";
      if (!on && !lazy) {
        week[seat.label] = existing ? `kept ${castName(s, existing.castawayId)}` : "no pick (forgot)";
        continue;
      }
      const ratings = Bots.ratings(s, LEVELS[role.level]);
      const pick = prefer(seat, available, { ratings, key: "safety", how: lazy ? "list" : role.moves === "best" ? "rank" : role.moves, listOrder: listOrder(s), names: namesOf(s) })[0];
      try {
        await withLeagueLock(r.leagueId, (st) => {
          S.setPickEmPick(st, episode.id, pid, pick);
        });
        const now = S.PickEmLogic.pickFor(await stateOf(r.leagueId), episode.id, pid);
        week[seat.label] = now && now.castawayId === pick ? `picked ${castName(s, pick)}` : `tried ${castName(s, pick)}, not taken`;
      } catch (e) {
        week[seat.label] = `couldn't pick: ${e.message}`;
        r.problems.push(`Episode ${n}: ${seat.label}'s pick refused: ${e.message}`);
      }
    }
  }
  return week;
}

/** A waiver week that's open: each seat's claim by habit (the forgetter none: autofill decides), then Process now. */
async function waivers(r, n) {
  const { S, Bots, Waivers, withLeagueLock } = appCode();
  const s = await stateOf(r.leagueId);
  const W = S.WaiverLogic;
  const period = W.current(s);
  if (!period || period.phase !== "open") return null;
  const out = { episode: period.episode, claims: {} };
  for (const seat of r.seats) {
    const pid = pidOf(r, seat);
    if (!pid) continue;
    const habit = ROLES[seat.role].waivers;
    if (habit === "none") {
      out.claims[seat.label] = "no claim";
      continue;
    }
    const claim = Bots.waiverClaim(s, pid, period);
    const owed = W.replacementsOwed(s, pid, period);
    const pairs = habit === "claim" ? claim.pairs : claim.pairs.filter((p) => owed.outIds.includes(p.dropId));
    if (!pairs.length) {
      out.claims[seat.label] = "nothing to claim";
      continue;
    }
    try {
      await withLeagueLock(r.leagueId, async (st, client) => {
        const res = await Waivers.saveClaim(client, r.leagueId, st, pid, { pairs }, r.users[seat.username].id);
        if (res.error) throw new Error(res.error);
      });
      out.claims[seat.label] = pairs.map((p) => `${castName(s, p.addId)} for ${castName(s, p.dropId)}`).join("; ");
    } catch (e) {
      out.claims[seat.label] = `refused: ${e.message}`;
    }
  }
  await appCode()
    .backstage.waiverWrite(await scopeOf(r), r.leagueId, { action: "run" })
    .catch((e) => r.problems.push(`Episode ${n}: Waivers › Run now refused: ${e.message}`));
  const after = await stateOf(r.leagueId);
  const log = (after.midSeason?.log || []).filter((x) => x.periodId === period.id || x.episode === n);
  out.ran = log.map((x) => `${nameIn(after, x.playerId)}: ${x.addId ? `+${castName(after, x.addId)}` : ""}${x.dropId ? ` -${castName(after, x.dropId)}` : ""}${x.via ? ` (${x.via})` : ""}`);
  return out;
}

// ---------- results, from the tape, through the bot's own run ----------

/**
 * An answer researched before the tapes (Survivor 49's, stored as pasted under an older prompt) in today's shape: every
 * field today's schema has that it lacks (sourcesRead, nextEpisode, rulesNote, a castaway's newGroup...) added empty, so
 * the app's own parse reads it; nothing it said is changed. Null when it isn't JSON. `schema` is episode-research.js
 * researchSchemaFor's. Pure.
 */
/** A recorded answer's JSON object, as the app's research reads one (extractJsonObject), or null. */
function answerJson(text) {
  const { extractJsonObject } = require("../../db/episode-research.js");
  try {
    const raw = JSON.parse(extractJsonObject(String(text ?? "")) || "");
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}

function upgradeStored(text, schema) {
  const raw = answerJson(text);
  if (!raw) return null;
  const isArray = (t) => !!t && ((t._zod && t._zod.def && t._zod.def.type === "array") || (t._def && t._def.typeName === "ZodArray"));
  const shapeOf = (t) => (t && (t.shape || (t._def && typeof t._def.shape === "function" ? t._def.shape() : t._def && t._def.shape))) || {};
  const fill = (obj, shape) => {
    for (const [k, t] of Object.entries(shape)) if (!(k in obj)) obj[k] = isArray(t) ? [] : null;
  };
  const shape = shapeOf(schema);
  fill(raw, shape);
  const entry = shape.castaways && ((shape.castaways._zod && shape.castaways._zod.def.element) || (shape.castaways._def && shape.castaways._def.type) || shape.castaways.element);
  if (entry && Array.isArray(raw.castaways)) for (const c of raw.castaways) if (c && typeof c === "object") fill(c, shapeOf(entry));
  return JSON.stringify(raw);
}

/**
 * A recorded full answer moved forward `days` with the copy (copySeason): its printed air date ("January 8, 2026") and its
 * next episode's start (nextEpisode.airsAt, ISO), so the bot's own checks (an answer dated the night its episode aired, the
 * next episode's time) read it against the copy's schedule. Nothing else changes; an answer that isn't JSON is left as is.
 * Pure.
 */
function shiftAnswer(text, days) {
  const raw = answerJson(text);
  if (!raw) return text;
  // Read as the app reads it back (air-schedule.js parseAirDate: "January 8, 2026", "8 January 2026", "2026-01-08"), moved
  // in whole calendar days in UTC, so the machine's time zone can't move it a day.
  const day = require("../../src/lib/game/air-schedule.js").parseAirDate(raw.airDate);
  if (day) {
    const [y, m, d] = day.split("-").map(Number);
    raw.airDate = new Date(Date.UTC(y, m - 1, d + days)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  const next = raw.nextEpisode && Date.parse(raw.nextEpisode.airsAt);
  if (next && !Number.isNaN(next)) raw.nextEpisode = { ...raw.nextEpisode, airsAt: new Date(next + days * DAY).toISOString() };
  return JSON.stringify(raw);
}

async function fileResults(season, n, answer) {
  const { BotResearch, botSend, pool } = appCode();
  const Research = require("../../db/episode-research.js");
  const { kindOf } = require("./fake-bot");
  const job = await BotResearch.loadSeasonForJob(pool, season.seasonId);
  const asked = [];
  const stored = season.tape.files.find((f) => f.kind === "full" && f.episode === n && f.ok && f.source === "stored");
  const ask = async (prompt) => {
    const kind = kindOf(prompt);
    let a = answer(prompt, kind);
    if (kind === "full" && stored) {
      const ctx = await Research.resolveSeasonResearchContext(pool, SLUG(season.show), season.number, n);
      a = upgradeStored(stored.answer, Research.researchSchemaFor(ctx.format)) || a;
    }
    if (kind === "full") a = shiftAnswer(a, season.shiftDays);
    asked.push({ kind, found: a !== "{}", ...(kind === "full" && stored ? { stored: true } : {}) });
    return { answer: a, seconds: 0 };
  };
  const out = {};
  for (const kind of ["quick", "full"]) {
    const has = season.tape.files.some((f) => f.kind === kind && f.episode === n && f.ok);
    if (!has) {
      out[kind] = { ok: false, message: "not on tape" };
      continue;
    }
    const res = await BotResearch.runJob(pool, { season: job, episode: n, kind }, { ask, send: botSend });
    out[kind] = { ok: res.ok, message: res.message };
  }
  out.asked = asked;
  return out;
}

// ---------- what each episode looked like ----------

function standings(s, S) {
  const pool = !!S.getLeagueType(s).hasWeeklyPicks;
  return S.computeScores(s).map((x) => ({ playerId: x.playerId, name: x.name, total: Math.round(x.total * 10) / 10, ...(pool ? { streak: x.longestStreak ?? 0, current: x.currentStreak ?? 0 } : {}) }));
}
const rankKey = (x) => (x.streak !== undefined ? x.streak * 1000 + x.total : x.total);

/** One episode in one game: standings, points and why, who went home, teams with nobody left, the lead, ties. */
function look(r, s, n, prev) {
  const { S, breakdown, bullets } = appCode();
  const view = S.SpoilerLogic.viewThrough(s, n);
  // Seats by their role's label ("Forgetter 2"), computer players by their own names.
  const label = (name) => r.seats.find((x) => x.username === name)?.label ?? name;
  const table = standings(view, S).map((x) => ({ ...x, name: label(x.name) }));
  const before = prev ? new Map(prev.table.map((x) => [x.playerId, x])) : new Map();
  const ep = s.episodes.find((e) => e.number === n);
  const out = ep ? s.castaways.filter((c) => c.exitEpisodeId === ep.id).map((c) => `${c.name} (${c.exitMethod || "out"})`) : [];
  const top = table.length ? rankKey(table[0]) : 0;
  const leaders = table.filter((x) => rankKey(x) === top).map((x) => x.name);
  const type = S.getLeagueType(s);
  const why = {};
  for (const x of table) {
    const gained = Math.round((x.total - (before.get(x.playerId)?.total ?? 0)) * 10) / 10;
    const line = { gained };
    if (ep && type.hasActiveRoster) {
      const b = breakdown(view, ep.id, x.playerId);
      line.started = b.started.map((l) => `${l.c.name} ${l.points}${l.items.length ? ` (${l.items.map((i) => `${i.label} ${i.points}`).join(", ")})` : ""}`);
      line.bench = b.benched.filter((l) => l.points).map((l) => `${l.c.name} would have scored ${l.points}`);
      line.says = bullets(view, ep.id, x.playerId).map((b2) => b2.text);
    } else if (ep && type.hasWeeklyPicks) {
      const pick = S.PickEmLogic.pickFor(view, ep.id, x.playerId);
      line.pick = pick ? `${castName(s, pick.castawayId)}${pick.correct === false ? " (went home)" : pick.correct === true ? " (survived)" : ""}` : "none";
    } else {
      const team = view.castaways.filter((c) => (c.ownerIds || []).includes(x.playerId));
      line.team = team.map((c) => `${c.name}${c.status === "eliminated" ? " (out)" : ""}`);
    }
    why[x.name] = line;
  }
  const hasTeams = type.hasRoster;
  const empty = hasTeams ? table.filter((x) => !teamOf(view, x.playerId).length).map((x) => x.name) : [];
  const totals = table.map(rankKey);
  const tied = [...new Set(totals.filter((t, i) => totals.indexOf(t) !== i))];
  const ties = tied.map((t) => table.filter((x) => rankKey(x) === t).map((x) => x.name));
  return {
    n,
    out,
    table,
    leaders,
    leadChange: !!prev && prev.leaders.join("|") !== leaders.join("|"),
    ties,
    teamsWithNobodyLeft: empty,
    why,
  };
}

/** Who could still win after an episode: within reach of the leader at the best week anyone has had so far. Rough. */
function stillInIt(e, history, episodesLeft) {
  const best = Math.max(0, ...history.flatMap((h) => Object.values(h.why).map((w) => w.gained || 0)));
  const lead = e.table.length ? e.table[0].total : 0;
  // A pool: only the current streak can still grow, to the leader's longest.
  if (e.table[0] && e.table[0].streak !== undefined) return e.table.filter((x) => Math.max(x.streak, x.current + episodesLeft) >= e.table[0].streak).length;
  return e.table.filter((x) => x.total + best * episodesLeft >= lead).length;
}

// ---------- the run ----------

async function run(show, season, opts) {
  const Tapes = require("./tapes");
  const { S } = appCode();
  console.log(`(first) removed ${await down()}`);
  const copy = await copySeason(show, season);
  const E = copy.episodeCount;
  const through = Math.min(E, Number(opts.through) || E);
  const set = pairwise(DIMENSIONS, { merge: copy.merge }).picked;
  const only = opts.only ? String(opts.only).split(",").map(Number) : null;
  const answer = Tapes.answerer(show, season);
  const users = {};
  const replays = [];
  for (const [i, config] of set.entries()) {
    const n = i + 1;
    if (only && !only.includes(n)) continue;
    const seats = seatsFor(config.group);
    for (const seat of seats) users[seat.username] ||= await userFor(seat);
    const span = spanOf(config, E, copy.merge);
    replays.push({
      n,
      config,
      name: replayName(show, season, config),
      seats: seats.map((x) => ({ ...x })),
      users,
      span,
      lateSeat: null,
      seasonId: copy.seasonId,
      couchId: await couchFor(n, seats, users, copy.seasonId),
      log: [],
      problems: [],
      episodes: [],
      weeks: {},
      waivers: [],
    });
    const r = replays[replays.length - 1];
    if (span.late) r.lateSeat = r.seats[r.seats.length - 1];
  }
  console.log(`${show} ${season}: ${E} episodes${copy.merge ? `, the merge at ${copy.merge}` : ", no merge"}; ${replays.length} replay(s) on ${SLUG(show)}`);
  if (!copy.approved) {
    console.log(`  (its cast was staged and never approved: approved on the copy, as the classic admin's Approve would)`);
    for (const r of replays) r.log.push("The season's cast was staged, not approved: approved on the copy (as classic's admin would) so there's a cast to draft");
  }
  const results = [];
  for (let ep = 1; ep <= through; ep++) {
    // Games that start with this episode, and anyone joining late now.
    for (const r of replays) {
      try {
        if (r.span.from === ep) await startOne(r, copy);
        if (r.leagueId && r.span.late === ep && r.lateSeat) {
          const joined = await join(r, r.lateSeat, await lateTeam(r, r.lateSeat, ep));
          r.log.push(`${r.lateSeat.label} joined late, from episode ${joined.start}${joined.catchingUp ? " (catching up)" : ""}`);
          await seatIds(r);
        }
      } catch (e) {
        r.problems.push(`Episode ${ep}: ${r.span.from === ep ? "starting the game" : "a late join"} failed: ${e.message}`);
        if (!r.leagueId) r.dead = true;
      }
    }
    for (const r of replays.filter((x) => x.leagueId && !x.dead)) {
      try {
        r.weeks[ep] = await moves(r, ep);
      } catch (e) {
        r.problems.push(`Episode ${ep}: moves failed: ${e.message}`);
      }
    }
    // Everyone watched it.
    await appCode().pool.query("UPDATE show_follows SET seen_through = $2 WHERE season_id = $1", [copy.seasonId, ep]);
    const filed = await fileResults(copy, ep, answer);
    // A safety net: an air time the shift missed (one not in nextEpisode's shape) is a real date, before now, while every
    // one of the copy's lies ahead; laid over the copy's clock (season_episodes.air_at, through the season_air_dates view)
    // it would close the episodes after it at once, so it moves with the rest.
    await appCode().pool.query(
      "UPDATE season_episodes SET air_at = air_at + make_interval(days => $2::int) WHERE season_id = $1 AND air_at < now()",
      [copy.seasonId, copy.shiftDays]
    );
    results.push({ episode: ep, ...filed });
    console.log(`  episode ${ep}: quick ${filed.quick.ok ? "ok" : "no"} (${filed.quick.message}); full ${filed.full.ok ? "ok" : "no"} (${filed.full.message})`);
    for (const r of replays.filter((x) => x.leagueId && !x.dead)) {
      const s = await stateOf(r.leagueId);
      if (!S.inPlay(s, ep) && ep < (s.settings.startEpisode ?? 1)) continue;
      if (ep > (s.settings.endEpisode ?? Infinity)) continue;
      const prev = r.episodes[r.episodes.length - 1] || null;
      const e = look(r, s, ep, prev);
      e.moves = r.weeks[ep] || {};
      e.results = { quick: filed.quick.message, full: filed.full.message };
      e.stillInIt = stillInIt(e, [...r.episodes, e], (s.settings.endEpisode ?? E) - ep);
      r.episodes.push(e);
      try {
        const w = await waivers(r, ep);
        if (w) {
          e.waivers = w;
          r.waivers.push(w);
        }
      } catch (e2) {
        r.problems.push(`Episode ${ep}: waivers failed: ${e2.message}`);
      }
    }
  }
  fs.mkdirSync(path.join(Tapes.TAPES, "replays"), { recursive: true });
  for (const r of replays) {
    const s = r.leagueId ? await stateOf(r.leagueId) : null;
    const file = path.join(Tapes.TAPES, "replays", r.name);
    const record = summarize(r, s, show, season, copy, results);
    fs.writeFileSync(`${file}.json`, JSON.stringify(record, null, 2) + "\n", "utf8");
    fs.writeFileSync(`${file}.md`, markdown(record), "utf8");
    console.log(`  ${r.n}. ${r.name}: ${record.final ? `${record.final.winner} won${record.final.over ? "" : " (not over)"}` : "no game"}${r.problems.length ? `, ${r.problems.length} problem(s)` : ""}`);
    for (const p of r.problems.slice(0, 5)) console.log(`       ! ${p}`);
  }
  // The pushes the results sent run after their writes (next-after-stub.js): let them finish before the rows go.
  await new Promise((done) => setTimeout(done, 3000));
  if (!opts.keep) console.log(`removed ${await down()}`);
  else console.log(`kept: the games are on ${SLUG(show)} ${season} (sign in as zt_pt_tinkerer, ${PASSWORD}); down when done`);
}

function summarize(r, s, show, season, copy, results) {
  const { S } = appCode();
  const last = r.episodes[r.episodes.length - 1];
  const final = s && last ? { winner: last.leaders.join(" & "), table: last.table, over: S.gameOver(s), settledAt: settledAt(r.episodes), leadChanges: r.episodes.filter((e) => e.leadChange).length } : null;
  return {
    replay: r.name,
    show,
    season,
    config: r.config,
    span: r.span,
    seats: r.seats.map((x) => ({ label: x.label, role: x.role, late: x === r.lateSeat })),
    computer: r.bots || [],
    settings: r.settings || null,
    draft: r.draft || null,
    log: r.log,
    problems: r.problems,
    episodes: r.episodes,
    final,
    tape: { merge: copy.merge, episodes: copy.episodeCount, results: results.map((x) => ({ episode: x.episode, quick: x.quick, full: x.full })) },
    at: new Date().toISOString(),
  };
}

/** The episode after which the winner never left first place (null: no games). */
function settledAt(episodes) {
  if (!episodes.length) return null;
  const winner = episodes[episodes.length - 1].leaders.join("|");
  let at = episodes[episodes.length - 1].n;
  for (let i = episodes.length - 1; i >= 0; i--) {
    if (episodes[i].leaders.join("|") !== winner) break;
    at = episodes[i].n;
  }
  return at;
}

function markdown(x) {
  const lines = [`# ${x.replay}`, ``, `${x.show} ${x.season}: ${Object.entries(x.config).filter(([, v]) => v !== NA).map(([k, v]) => `${k} ${v}`).join(", ")}.`, ``];
  if (x.settings) lines.push(`Settings: ${x.settings.type}, ${x.settings.ownership}, teams of ${x.settings.teamSize}${x.settings.type === "active-roster" ? ` (${x.settings.activeSlots} start, ${x.settings.benchSlots} bench)` : ""}, episodes ${x.settings.startEpisode}–${x.settings.endEpisode ?? "end"}, waivers ${x.settings.waivers === "off" ? "off" : `${x.settings.waivers.replaceRule}, ${x.settings.waivers.waiverWindows.schedule}`}; ${x.settings.players} players.`, ``);
  lines.push(`Seats: ${x.seats.map((s) => `${s.label}${s.late ? " (late)" : ""}`).join(", ")}${x.computer.length ? `; computer: ${x.computer.map((b) => b.name).join(", ")}` : ""}.`, ``);
  if (x.log.length) lines.push(...x.log.map((l) => `- ${l}`), ``);
  if (x.problems.length) lines.push(`**Problems:**`, ...x.problems.map((p) => `- ${p}`), ``);
  if (x.draft) lines.push(`**Draft:**`, ...Object.entries(x.draft).map(([k, v]) => `- ${k}: ${v.join(", ")}`), ``);
  if (x.final) lines.push(`**Final:** ${x.final.winner}${x.final.over ? "" : " (the game doesn't say it's over)"}; settled after episode ${x.final.settledAt}; ${x.final.leadChanges} lead change(s).`, ``);
  lines.push(`| Ep | Out | Leader | Table | In it |`, `|---|---|---|---|---|`);
  for (const e of x.episodes) {
    const t = e.table.map((r) => `${r.name} ${r.streak !== undefined ? `${r.streak}/${r.total}` : r.total}`).join(", ");
    lines.push(`| ${e.n} | ${e.out.join(", ") || "nobody"} | ${e.leaders.join(" & ")}${e.leadChange ? " (new)" : ""} | ${t} | ${e.stillInIt} |`);
  }
  lines.push(``);
  return lines.join("\n");
}

// ---------- the summary (the replay files only) ----------

/**
 * One line per replay, for P4: who won, whether the game says it's over, when the winner was settled, lead changes, how
 * many could still win at the halfway mark, a tie at the top, where the forgetter finished, and problems. Pure.
 */
function summaryLine(x) {
  const eps = x.episodes || [];
  const last = eps[eps.length - 1];
  const half = eps[Math.floor((eps.length - 1) / 2)];
  const place = (label) => {
    if (!last) return null;
    const i = last.table.findIndex((t) => t.name === label);
    return i < 0 ? null : `${i + 1} of ${last.table.length}`;
  };
  const forgetter = x.seats.find((s) => s.role === "forgetter");
  return {
    replay: x.replay,
    winner: x.final ? x.final.winner : "no game",
    over: !!(x.final && x.final.over),
    settledAt: x.final ? x.final.settledAt : null,
    episodes: eps.length,
    leadChanges: x.final ? x.final.leadChanges : 0,
    inItAtHalf: half ? `${half.stillInIt} of ${half.table.length}` : null,
    tiedTop: last ? last.leaders.length > 1 : false,
    forgetter: forgetter ? place(forgetter.label) : null,
    problems: (x.problems || []).length,
  };
}

function summary() {
  const Tapes = require("./tapes");
  const dir = path.join(Tapes.TAPES, "replays");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  const rows = files.map((f) => summaryLine(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));
  const lines = [
    `# Replays: a line each`,
    ``,
    `${rows.length} replay(s) in ${dir}, written by playtest.js summary. Settled: the episode after which the winner never left first place. In it at half: who could still win at the middle episode (within the best week anyone had, times the episodes left; a pool: a streak that could still catch the leader's).`,
    ``,
    `| Replay | Winner | Over | Settled | Eps | Lead changes | In it at half | Tied top | Forgetter | Problems |`,
    `|---|---|---|---|---|---|---|---|---|---|`,
    ...rows.map((r) => `| ${r.replay} | ${r.winner} | ${r.over ? "yes" : "no"} | ${r.settledAt ?? ""} | ${r.episodes} | ${r.leadChanges} | ${r.inItAtHalf ?? ""} | ${r.tiedTop ? "yes" : ""} | ${r.forgetter ?? ""} | ${r.problems || ""} |`),
    ``,
  ];
  fs.writeFileSync(path.join(dir, "SUMMARY.md"), lines.join("\n"), "utf8");
  console.log(lines.join("\n"));
}

// ---------- the command line ----------

function argsOf(argv) {
  const flags = {};
  const rest = [];
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
    else rest.push(a);
  }
  return { flags, rest };
}

async function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  const { flags, rest } = argsOf(argv);
  if (cmd === "matrix") {
    const Tapes = require("./tapes");
    const tape = Tapes.readTape(rest[0], Number(rest[1]));
    const merge = mergeOf(tape.files.filter((f) => f.kind === "full" && f.ok));
    const E = (tape.season && tape.season.episodeCount) || 13;
    const { picked, pairs, configs } = pairwise(DIMENSIONS, { merge });
    console.log(`${configs} configs, ${pairs} pairs of settings; ${picked.length} replays cover every pair${merge ? ` (the merge at ${merge})` : " (no merge)"}:`);
    for (const [i, c] of picked.entries()) {
      const sp = spanOf(c, E, merge);
      console.log(`  ${String(i + 1).padStart(2)}. ${replayName(rest[0], rest[1], c)}  (episodes ${sp.from}-${sp.to ?? E}${sp.late ? `, late at ${sp.late}` : ""})`);
    }
    return;
  }
  if (cmd === "run") return run(rest[0], Number(rest[1]), flags);
  if (cmd === "down") return console.log(`removed ${await down()}`);
  if (cmd === "summary") return summary();
  console.log("Usage: node scripts/dev-test/playtest.js matrix|run|summary|down <show> <season> (see the header comment)");
}

module.exports = { summaryLine, upgradeStored, shiftAnswer, DIMENSIONS, NA, applies, allConfigs, pairsOf, pairwise, replayName, ROLES, seatsFor, hash01, movesThisWeek, prefer, mergeOf, spanOf, settledAt };

if (require.main === module) {
  main()
    .then(async () => {
      if (app) await app.pool.end().catch(() => {});
      process.exit(process.exitCode || 0);
    })
    .catch(async (e) => {
      console.error(e && e.stack ? e.stack : e);
      if (app) await app.pool.end().catch(() => {});
      process.exit(1);
    });
}
