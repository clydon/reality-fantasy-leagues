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
//   node scripts/dev-test/playtest.js run <show> <season> [--only=1,4] [--keep] [--through=N | --before=N]
//                                                 play them (all, or those numbers), episode by episode; write each replay
//                                                 to rfl-tapes\replays\<show>-<season>-<game>-<settings>-<group>.json with
//                                                 a .md beside it; then down, unless --keep (left for looks at 390:
//                                                 playtest-looks.js). --through=N stops after episode N's results,
//                                                 --before=N before them (N's games drafted and its moves made)
//                                                 [--away=favourites] [--window=merge]: a variant (habits changed from
//                                                 the whole set's), playing only the replays it changes, into
//                                                 replays\variants\<variant>\: someone away from the draft gets the room's
//                                                 favourites, not the first on the list; whoever runs an Outlast game opens
//                                                 one waiver window after the merge
//   node scripts/dev-test/playtest.js summary                       a line per replay on file, for P4 (also replays\SUMMARY.md)
//   node scripts/dev-test/playtest.js judge [--dir=variants/<v>]    P4's measures per game, all shows and each, and how much
//                                                 each week asks (taps, cards; replays\JUDGE.md)
//   node scripts/dev-test/playtest.js compare <variant>             a variant's replays beside the whole set's (COMPARE.md)
//   node scripts/dev-test/playtest.js says <episode>                on kept replays, each seat's lineup for an episode and
//                                                 what the app says to them about it (the reveal's lines)
//   node scripts/dev-test/playtest.js exits <show> <season>         who left by the quick check and by the full research, per
//                                                 episode, and where they disagree (the tape only; replays\exits-<show>-<season>.md)
//   node scripts/dev-test/playtest.js down                          take out everything a replay made (zt-pt- keyed)
//
// Players are zt_pt_<role> accounts (password zt-pass-12345), one per seat label ("Tinkerer", "Forgetter 2"): the
// tinkerer runs every game (Commissioner); a solo group is the tinkerer against three computer players (the practice
// couch's shape). Habits, deterministic (a fixed hash of the role and the episode, so a replay plays the same twice):
//   tinkerer    sets the best lineup or pick every week (the sharpest read), claims on waivers, drafts by the numbers
//   forgetter   misses the draft (whoever runs it picks for them: first on the list, or the room's favourites with
//               --away=favourites) and most weeks (remembers 1 in 3)
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
// in; waivers: on (Backstage › Waivers › Balanced, since Start a game leaves them off) or off; group: how many people (1 =
// you and three computer players). A season plays only the games its rulebook fits (dimsFor).
const DIMENSIONS = {
  game: ["outlast", "weeklyLineup", "survivalPool"],
  own: ["exclusive", "shared"],
  size: ["small", "standard", "big"],
  span: ["season", "from", "one", "merge", "through"],
  late: ["no", "yes"],
  waivers: ["on", "off"],
  group: [1, 2, 4, 8, 16],
};

/**
 * The games a season's replays play: Start a game's own offer for its rulebook (rulebook-fits.js gamesFor: the games that
 * fit and can be started now), in DIMENSIONS' order. A series (Below Deck) gets Weekly Lineup only, a competition with no
 * one going home each episode (Dancing with the Stars' rulebook) no Survival Pool. No rulebook on the tape: all three. Pure.
 */
function gamesOf(rulebook) {
  if (!rulebook || !rulebook.blocks) return [...DIMENSIONS.game];
  const fit = new Set(require("../../src/lib/game/formats/rulebook-fits.js").gamesFor(rulebook.blocks, rulebook.compiled).filter((g) => g.fits && !g.soon).map((g) => g.key));
  return DIMENSIONS.game.filter((k) => fit.has(k));
}
/** The matrix's dimensions for a season: DIMENSIONS with only the games its rulebook fits. Pure. */
const dimsFor = (rulebook) => ({ ...DIMENSIONS, game: gamesOf(rulebook) });

/** Which settings mean something for a config (the rest are NA): a pool has no teams, a one-episode game no late joiner. */
function applies(c, dim) {
  const pool = c.game === "survivalPool";
  if (dim === "own" || dim === "size") return !pool;
  // Shared Outlast has no waivers at all (no free agents: WaiverLogic.supported), so "on" can't be played there.
  if (dim === "waivers") return !pool && c.span !== "one" && !(c.game === "outlast" && c.own === "shared");
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

/**
 * The room's favourites among `ids`, for someone away whose picks are made for them (`--away=favourites`, P4's question):
 * by what the app knows of each (bot-logic.js ratings' `value`, no taste: flat before any results), then by the room's own
 * picks (`lists`, each seat's picks or preference order, best first: a castaway's mean place in them, so the most picked
 * come first), then the app's list. Pure.
 */
function favourites(ids, { ratings, lists = [], listOrder = [] }) {
  const r = ratings || {};
  const live = ids.filter((id) => !ratings || r[id]);
  const value = new Map(live.map((id) => [id, Math.round((r[id]?.value ?? 0) * 1000) / 1000]));
  const place = new Map(live.map((id) => [id, lists.length ? lists.reduce((t, l) => t + (l.includes(id) ? l.indexOf(id) : l.length), 0) / lists.length : 0]));
  return [...live].sort((a, b) => value.get(b) - value.get(a) || place.get(a) - place.get(b) || listOrder.indexOf(a) - listOrder.indexOf(b));
}

// What a move costs in taps on a phone, counted from Tonight's card on the new design's screens: the moves sheet
// (src/new/show/dock.tsx: open it, tap each one to start or bench, Save; Save with nothing changed just closes it), the
// pool's grid (open, tap a face, Save), the waivers page (waivers.tsx: open it, then per spot Swap, tap who comes in, save),
// and Backstage › Waivers › Open a waiver window (backstage/waivers.tsx: Backstage, Waivers, Open a waiver window, a preset,
// Open window). Revealing the episode (the spoiler-safe reveal) comes before any of it and isn't counted.
const TAPS = { open: 1, save: 1, looked: 2, pick: 3, claimSpot: 3, window: 5 };
/** Taps to go from one lineup to another in the moves sheet: open, bench each leaving, start each coming in, Save. Pure. */
function lineupTaps(current, want) {
  const starts = want.filter((id) => !current.includes(id)).length;
  const benches = current.filter((id) => !want.includes(id)).length;
  return starts + benches ? TAPS.open + starts + benches + TAPS.save : TAPS.looked;
}
/** Taps for a waiver claim: open the waivers page, then each spot (a castaway to drop) Swap, tap who comes in, save. Pure. */
const claimTaps = (pairs) => {
  const spots = new Set(pairs.map((p) => p.dropId)).size;
  return spots ? TAPS.open + spots * TAPS.claimSpot : 0;
};

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
  // The season's rulebook, as a rulebook of the copy's own (the app reads a season's by its id: rulebooks.js seasonRulebook),
  // so Start a game offers the copy what it offers the real season, and its games play by the same rules. It goes with the
  // show at down (rulebooks.season_id cascades).
  const rulebook = real.rulebook_id ? await require("../../db/rulebooks.js").copyRulebook(pool, real.rulebook_id, { ownerKind: "season", seasonId: ss.id }) : null;
  const schedule = (await appCode().schedules([ss.id])).get(ss.id);
  const episodes = (schedule?.episodes ?? []).map((e) => ({ number: e.number, air_at: e.airAt }));
  const fulls = tape.files.filter((f) => f.kind === "full" && f.ok);
  // A cast the recorder staged and nobody approved (a set-up show's new season: P1's Noticed) is approved on the copy, as
  // the classic admin's Approve would, so its games have someone to draft.
  const approved = !!real.cast_approved_at;
  return { seasonId: ss.id, showId: sh.id, show, number: season, shiftDays, approved, episodes, tape, rulebook, merge: mergeOf(fulls), episodeCount: tape.season.episodeCount || episodes.length };
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
  // On: Start a game leaves them off (PLAYTEST-REPORT.md finding 7), so whoever runs it picks Balanced in Backstage › Waivers,
  // last (the recommendation reads the team and lineup sizes) and before the draft, which fits it to the teams (refit).
  if (c.waivers === "on") out.push({ how: "waivers", feel: "balanced" });
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
    const words = w.feel ? w.feel[0].toUpperCase() + w.feel.slice(1) : Object.entries(w.set).map(([k, v]) => `${k} ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ");
    try {
      if (w.how === "classic") {
        await withLeagueLock(r.leagueId, (st) => {
          for (const [k, v] of Object.entries(w.set)) S.updateSettings(st, k, v);
        });
      } else if (w.how === "settings") await backstage.settingsWrite(await scopeOf(r), r.leagueId, { set: w.set });
      else await backstage.waiverWrite(await scopeOf(r), r.leagueId, w.feel ? { action: "feel", feel: w.feel } : { action: "set", set: w.set });
      r.log.push(`${w.how === "classic" ? "League Settings" : w.how === "settings" ? "Game settings" : w.feel ? "Waivers" : "Waivers › Fine-tune"}: ${words}${w.cut ? ` (${w.cut})` : ""}`);
    } catch (e) {
      if (/doesn't use waivers/.test(e.message) && !w.feel) r.log.push(`Waivers › Fine-tune: ${e.message} (nothing to turn off)`);
      else r.problems.push(`Setting ${w.feel ? "waivers to " : ""}${words} was refused: ${e.message}`);
    }
  }
  await seatIds(r);
  if (S.getLeagueType(await stateOf(r.leagueId)).hasRoster) await draft(r);
  // After the draft: waivers are fitted to the teams once it starts (WaiverLogic.refit). A replay asked to play with them on
  // that ends up without them doesn't cover what it's named for: say so.
  const after = await stateOf(r.leagueId);
  if (r.config.waivers === "on" && !S.WaiverLogic.enabled(after)) r.problems.push("Waivers were asked on, but they're off after the draft (the recommendation for these teams has none)");
  r.settings = pickSettings(after, S);
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

/**
 * The draft, through the draft room's writes: the turn-based one turn by turn, the blind one each locking in. Each seat's
 * picks in words (r.draft: "Ann (picked for them)") and as data (r.drafted: [{ id, name, forThem }]).
 */
async function draft(r) {
  const { draft: D, S, Bots } = appCode();
  const lead = r.users[r.seats[0].username];
  const leadActor = { user: lead, membership: await memberOf(r.leagueId, lead.id) };
  let s = await D.startDraft(leadActor, r.leagueId);
  const shared = s.settings.ownershipMode === "shared";
  const picks = {};
  const drafted = {};
  // A seat's order over `ids` by its habit, and someone away's when they get the room's favourites (--away=favourites: what
  // the app knows, then `lists`, the others' own orders or locked teams).
  const orderOf = (seat, ids) => prefer(seat, ids, { ratings: Bots.ratings(s, LEVELS[ROLES[seat.role].level]), listOrder: listOrder(s), names: namesOf(s) });
  const awayOrder = (ids, lists) => favourites(ids, { ratings: Bots.ratings(s, LEVELS.solid), lists, listOrder: listOrder(s) });
  const isAway = (seat) => ROLES[seat.role].draft === "absent";
  if (!shared) {
    for (let guard = 0; guard < 600; guard++) {
      const turn = S.currentDraftTurn(s);
      if (!turn || turn.isComplete) break;
      const seat = seatOf(r, turn.playerId);
      if (!seat) break; // a computer player's turn not taken (bots.ts takes them inside each write): stop and say so
      const free = s.castaways.filter((c) => c.status === "active" && !(c.ownerIds || []).length).map((c) => c.id);
      const habit = ROLES[seat.role].draft;
      const order =
        isAway(seat) && r.opts.away === "favourites"
          ? // What the room would take next: the others' own orders over who's free.
            awayOrder(free, r.seats.filter((x) => x !== seat && pidOf(r, x) && !isAway(x)).map((x) => orderOf(x, free)))
          : orderOf(seat, free);
      if (!order.length) {
        r.problems.push(`The draft ran out of castaways at pick ${s.draftPicksMade + 1}: ${s.draftOrder.length} teams of ${S.rosterSize(s)} need ${s.draftOrder.length * S.rosterSize(s)}, and ${s.castaways.filter((c) => c.status === "active").length} are still in`);
        break;
      }
      const forgot = habit === "absent";
      const actor = forgot ? leadActor : { user: r.users[seat.username], membership: await memberOf(r.leagueId, r.users[seat.username].id) };
      ({ state: s } = await D.pickInDraft(actor, r.leagueId, order[0]));
      (picks[seat.label] ||= []).push(`${castName(s, order[0])}${forgot ? " (picked for them)" : ""}`);
      (drafted[seat.label] ||= []).push({ id: order[0], name: castName(s, order[0]), forThem: forgot });
    }
    const turn = S.currentDraftTurn(s);
    if (turn && !turn.isComplete) r.problems.push(`The draft stopped at pick ${s.draftPicksMade + 1}: nobody's turn the replay could take`);
  } else {
    const size = S.rosterSize(s);
    const active = s.castaways.filter((c) => c.status === "active").map((c) => c.id);
    const drafting = r.seats.filter((seat) => pidOf(r, seat) && seat !== r.lateSeat);
    // Each seat's team, chosen in private (nobody reads another's), then locked in, in seat order.
    const teams = new Map(drafting.map((seat) => [seat, orderOf(seat, active).slice(0, size)]));
    // --away=favourites: someone away gets the room's favourites (the app knows the others' locked teams; nobody else sees them).
    if (r.opts.away === "favourites") {
      const others = drafting.filter((x) => !isAway(x)).map((x) => teams.get(x));
      for (const seat of drafting) if (isAway(seat)) teams.set(seat, awayOrder(active, others).slice(0, size));
    }
    for (const seat of drafting) {
      const pid = pidOf(r, seat);
      const habit = ROLES[seat.role].draft;
      const ids = teams.get(seat);
      const forgot = habit === "absent";
      const actor = forgot ? leadActor : { user: r.users[seat.username], membership: await memberOf(r.leagueId, r.users[seat.username].id) };
      s = await D.lockBlindFor(actor, r.leagueId, pid, ids);
      picks[seat.label] = ids.map((id) => castName(s, id) + (forgot ? " (locked in for them)" : ""));
      drafted[seat.label] = ids.map((id) => ({ id, name: castName(s, id), forThem: forgot }));
    }
    if (!S.BlindDraftLogic.isRevealed(s)) r.problems.push("The blind draft didn't reveal once everyone had locked in");
  }
  s = await stateOf(r.leagueId);
  for (const b of r.bots) {
    const team = s.castaways.filter((c) => (c.ownerIds || []).includes(b.id));
    picks[`${b.name} (computer)`] = team.map((c) => c.name);
    drafted[`${b.name} (computer)`] = team.map((c) => ({ id: c.id, name: c.name, forThem: false }));
  }
  r.draft = picks;
  r.drafted = drafted;
}

// ---------- each week ----------

/** Who's on a seat's team still in the game, and the episode being chosen for. */
function teamOf(s, pid) {
  return s.castaways.filter((c) => c.status === "active" && (c.ownerIds || []).includes(pid)).map((c) => c.id);
}

/**
 * Every seat's move for the episode coming up, by its habit, through the routes' own writes. Each seat's move in words
 * (returned), the same as data in r.did[n] ({ kind: "lineup" | "pick", act, ids }: act set, looked, kept, carried, forgot,
 * refused, picked, notTaken, nobodyLeft or noEpisode; ids the lineup or pick it left), and in r.asks[n] what the week asked
 * of it: { kind, card (the app showed a move to make: a lineup with an open slot, a pick not made), taps (TAPS) }.
 */
async function moves(r, n) {
  const { S, Bots, withLeagueLock } = appCode();
  const week = {};
  const asks = ((r.asks ||= {})[n] = {});
  const did = ((r.did ||= {})[n] = {});
  // A seat's move, in words and as data.
  const say = (label, words, kind, act, ids = []) => {
    week[label] = words;
    did[label] = { kind, act, ids };
  };
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
      say(seat.label, "no episode to choose for", null, "noEpisode");
      continue;
    }
    // Outlast: nothing to do between episodes.
    if (!type.hasActiveRoster && !type.hasWeeklyPicks) asks[seat.label] = { kind: "none", card: false, taps: 0 };
    if (type.hasActiveRoster) {
      const mine = teamOf(s, pid);
      const slots = S.ActiveRosterLogic.activeSlots(s);
      const current = S.ActiveRosterLogic.lineupFor(s, episode.id, pid) || [];
      const carried = S.ActiveRosterLogic.lineupIsCarried(s, episode.id, pid);
      const ratings = Bots.ratings(s, LEVELS[role.level]);
      // Tonight's "Set your lineup" card: no lineup yet, or a slot opened (someone on it went home: the app took them out).
      const ask = (asks[seat.label] = { kind: "lineup", card: current.length < Math.min(slots, mine.length), taps: 0 });
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
        if (current.length) say(seat.label, `kept ${carried ? "last week's lineup (carried)" : "its lineup"}: ${current.map((id) => castName(s, id)).join(", ")}`, "lineup", carried ? "carried" : "kept", current);
        else say(seat.label, "no lineup (forgot)", "lineup", "forgot");
        continue;
      }
      ask.taps = lineupTaps(current, want);
      if (current.length && !carried && want.length === current.length && want.every((id) => current.includes(id))) {
        say(seat.label, `looked, kept ${want.map((id) => castName(s, id)).join(", ")}`, "lineup", "looked", want);
        continue;
      }
      try {
        await withLeagueLock(r.leagueId, (st) => {
          const problem = S.ActiveRosterLogic.validateLineup(st, episode.id, pid, want);
          if (problem) throw new Error(problem);
          S.setActiveRosterLineup(st, episode.id, pid, want);
        });
        say(seat.label, `set ${want.map((id) => castName(s, id)).join(", ")}`, "lineup", "set", want);
      } catch (e) {
        say(seat.label, `couldn't set a lineup: ${e.message}`, "lineup", "refused", current);
        r.problems.push(`Episode ${n}: ${seat.label}'s lineup refused: ${e.message}`);
      }
    } else if (type.hasWeeklyPicks) {
      const { available } = S.PickEmLogic.eligibility(s, episode.id, pid);
      const existing = S.PickEmLogic.pickFor(s, episode.id, pid);
      // Tonight's "Pick who survives" card: every episode, until a pick is in.
      const ask = (asks[seat.label] = { kind: "pick", card: !existing && available.length > 0, taps: 0 });
      const kept = () => say(seat.label, `kept ${castName(s, existing.castawayId)}`, "pick", "kept", [existing.castawayId]);
      if (!available.length) {
        if (existing) kept();
        else say(seat.label, "nobody left to pick", "pick", "nobodyLeft");
        continue;
      }
      const lazy = role.moves === "once";
      if (!on && !lazy) {
        if (existing) kept();
        else say(seat.label, "no pick (forgot)", "pick", "forgot");
        continue;
      }
      const ratings = Bots.ratings(s, LEVELS[role.level]);
      const pick = prefer(seat, available, { ratings, key: "safety", how: lazy ? "list" : role.moves === "best" ? "rank" : role.moves, listOrder: listOrder(s), names: namesOf(s) })[0];
      ask.taps = TAPS.pick;
      try {
        await withLeagueLock(r.leagueId, (st) => {
          S.setPickEmPick(st, episode.id, pid, pick);
        });
        const now = S.PickEmLogic.pickFor(await stateOf(r.leagueId), episode.id, pid);
        if (now && now.castawayId === pick) say(seat.label, `picked ${castName(s, pick)}`, "pick", "picked", [pick]);
        else say(seat.label, `tried ${castName(s, pick)}, not taken`, "pick", "notTaken", now ? [now.castawayId] : []);
      } catch (e) {
        say(seat.label, `couldn't pick: ${e.message}`, "pick", "refused", existing ? [existing.castawayId] : []);
        r.problems.push(`Episode ${n}: ${seat.label}'s pick refused: ${e.message}`);
      }
    }
  }
  return week;
}

/** Seats (by label) whose team has nobody left in the game. */
const wipedOut = (r, s) => r.seats.filter((x) => pidOf(r, x) && s.castaways.some((c) => (c.ownerIds || []).includes(pidOf(r, x))) && !teamOf(s, pidOf(r, x)).length).map((x) => x.label);

/**
 * A waiver week that's open: each seat's claim by habit (the forgetter none: autofill decides), then Process now. Also what
 * it asked of each seat (`asks`: the "Pick who comes in" card when a replacement's owed, the claim's taps) and the teams
 * with nobody left before and after it ran (`backIn`: who got someone back). The claims and what ran in words (`claims`,
 * `ran`) and as data beside them (`pairs`: each seat's claim, { addId, dropId }; `moved`: { seat, addId, dropId, via }).
 */
async function waivers(r, n) {
  const { S, Bots, Waivers, withLeagueLock } = appCode();
  const s = await stateOf(r.leagueId);
  const W = S.WaiverLogic;
  const period = W.current(s);
  if (!period || period.phase !== "open") return null;
  const out = { episode: period.episode, window: !!period.window, byHand: period.openedBy === "commissioner", claims: {}, pairs: {}, asks: {}, wiped: wipedOut(r, s) };
  for (const seat of r.seats) {
    const pid = pidOf(r, seat);
    if (!pid) continue;
    const habit = ROLES[seat.role].waivers;
    const owed = W.replacementsOwed(s, pid, period);
    out.asks[seat.label] = { card: owed.count > 0, taps: 0 };
    if (habit === "none") {
      out.claims[seat.label] = "no claim";
      continue;
    }
    const claim = Bots.waiverClaim(s, pid, period);
    const pairs = habit === "claim" ? claim.pairs : claim.pairs.filter((p) => owed.outIds.includes(p.dropId));
    if (!pairs.length) {
      out.claims[seat.label] = "nothing to claim";
      continue;
    }
    out.asks[seat.label].taps = claimTaps(pairs);
    try {
      await withLeagueLock(r.leagueId, async (st, client) => {
        const res = await Waivers.saveClaim(client, r.leagueId, st, pid, { pairs }, r.users[seat.username].id);
        if (res.error) throw new Error(res.error);
      });
      out.claims[seat.label] = pairs.map((p) => `${castName(s, p.addId)} for ${castName(s, p.dropId)}`).join("; ");
      out.pairs[seat.label] = pairs.map((p) => ({ addId: p.addId, dropId: p.dropId }));
    } catch (e) {
      out.claims[seat.label] = `refused: ${e.message}`;
    }
  }
  await appCode()
    .backstage.waiverWrite(await scopeOf(r), r.leagueId, { action: "run" })
    .catch((e) => r.problems.push(`Episode ${n}: Waivers › Run now refused: ${e.message}`));
  const after = await stateOf(r.leagueId);
  const log = (after.midSeason?.log || []).filter((x) => x.periodId === period.id || x.episode === n);
  out.ran = log.map((x) => `${nameIn(after, x.playerId)}: ${x.addedCastawayId ? `+${castName(after, x.addedCastawayId)}` : ""}${x.droppedCastawayId ? ` -${castName(after, x.droppedCastawayId)}` : ""}${x.via ? ` (${x.via})` : ""}`);
  out.moved = log.map((x) => ({ seat: seatOf(r, x.playerId)?.label ?? nameIn(after, x.playerId), addId: x.addedCastawayId || null, dropId: x.droppedCastawayId || null, via: x.via || null }));
  const still = wipedOut(r, after);
  out.backIn = out.wiped.filter((label) => !still.includes(label));
  return out;
}

/**
 * --window=merge: whoever runs an Outlast game opens one waiver window after the merge (a season with none: after its middle
 * episode), Backstage › Waivers › Open a waiver window › "Swap anyone" (replace who's out and swap any of the rest, the
 * preset the sheet suggests after the merge). Report finding 7's direction, tried as a habit: does it get wiped teams back in?
 */
async function openWindow(r, n) {
  const { S, backstage } = appCode();
  const s = await stateOf(r.leagueId);
  const swaps = S.rosterSize(s);
  try {
    await backstage.waiverWrite(await scopeOf(r), r.leagueId, { action: "window", swaps, replace: true });
    r.log.push(`Waivers: ${r.seats[0].label} opened a window after episode ${n} (Swap anyone: replace who's out, up to ${swaps} swaps each), with ${wipedOut(r, s).length} team(s) wiped out`);
    return true;
  } catch (e) {
    r.problems.push(`Episode ${n}: opening a waiver window was refused: ${e.message}`);
    return false;
  }
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

/**
 * One episode in one game: standings, points and why, who went home, teams with nobody left, the lead, ties. Each in
 * words for reading (`out`, a line's `started`, `bench`, `says`, `pick`, `team`) and, for the measures, as data beside
 * them (`left`, a line's `starters`, `benched`, `saysKinds`, `picked`, `members`: ids, points, flags).
 */
function look(r, s, n, prev) {
  const { S, breakdown, bullets } = appCode();
  const view = S.SpoilerLogic.viewThrough(s, n);
  // Seats by their role's label ("Forgetter 2"), computer players by their own names.
  const label = (name) => r.seats.find((x) => x.username === name)?.label ?? name;
  const table = standings(view, S).map((x) => ({ ...x, name: label(x.name) }));
  const before = prev ? new Map(prev.table.map((x) => [x.playerId, x])) : new Map();
  const ep = s.episodes.find((e) => e.number === n);
  const gone = ep ? s.castaways.filter((c) => c.exitEpisodeId === ep.id) : [];
  const out = gone.map((c) => `${c.name} (${c.exitMethod || "out"})`);
  const top = table.length ? rankKey(table[0]) : 0;
  const leaders = table.filter((x) => rankKey(x) === top).map((x) => x.name);
  const type = S.getLeagueType(s);
  const why = {};
  for (const x of table) {
    const gained = Math.round((x.total - (before.get(x.playerId)?.total ?? 0)) * 10) / 10;
    const line = { gained };
    if (ep && type.hasActiveRoster) {
      const b = breakdown(view, ep.id, x.playerId);
      const said = bullets(view, ep.id, x.playerId);
      line.started = b.started.map((l) => `${l.c.name} ${l.points}${l.items.length ? ` (${l.items.map((i) => `${i.label} ${i.points}`).join(", ")})` : ""}`);
      line.bench = b.benched.filter((l) => l.points).map((l) => `${l.c.name} would have scored ${l.points}`);
      line.says = said.map((b2) => b2.text);
      line.starters = b.started.map((l) => ({ id: l.c.id, name: l.c.name, points: l.points, items: l.items.map((i) => ({ label: i.label, points: i.points })) }));
      // Everyone on the bench, those who'd have scored nothing too (the words list only those who would have).
      line.benched = b.benched.map((l) => ({ id: l.c.id, name: l.c.name, points: l.points }));
      line.saysKinds = said.map((b2) => b2.kind);
    } else if (ep && type.hasWeeklyPicks) {
      const pick = S.PickEmLogic.pickFor(view, ep.id, x.playerId);
      line.pick = pick ? `${castName(s, pick.castawayId)}${pick.correct === false ? " (went home)" : pick.correct === true ? " (survived)" : ""}` : "none";
      line.picked = pick ? { id: pick.castawayId, name: castName(s, pick.castawayId), correct: pick.correct ?? null } : null;
    } else {
      const team = view.castaways.filter((c) => (c.ownerIds || []).includes(x.playerId));
      line.team = team.map((c) => `${c.name}${c.status === "eliminated" ? " (out)" : ""}`);
      line.members = team.map((c) => ({ id: c.id, name: c.name, out: c.status === "eliminated" }));
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
    left: gone.map((c) => ({ id: c.id, name: c.name, method: c.exitMethod || null })),
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
  if (opts.before !== undefined && opts.through !== undefined) throw new Error("--before or --through, not both");
  console.log(`(first) removed ${await down()}`);
  const copy = await copySeason(show, season);
  const E = copy.episodeCount;
  const through = Math.min(E, Number(opts.through) || E);
  if (opts.before !== undefined && !(Number.isInteger(Number(opts.before)) && Number(opts.before) >= 1 && Number(opts.before) <= E)) {
    await down();
    throw new Error(`--before needs an episode from 1 to ${E}`);
  }
  // What Start a game offers the copy: its own rulebook (the real season's, copied), else the tape's.
  const dims = dimsFor(copy.rulebook || copy.tape.season.rulebook);
  const set = pairwise(dims, { merge: copy.merge }).picked;
  const v = variantOf(opts);
  const windowAt = copy.merge ?? Math.ceil(E / 2);
  // A variant plays only the replays it changes (the matrix's numbers stay the same as the whole set's).
  const only = opts.only ? String(opts.only).split(",").map(Number) : null;
  const plays = (c, i) => (!only || only.includes(i + 1)) && changedBy(v, c, spanOf(c, E, copy.merge), windowAt);
  if (!set.some(plays)) {
    console.log(`No replay to play: ${!dims.game.length ? "Start a game offers none of Outlast, Weekly Lineup or Survival Pool here" : only ? `--only=${opts.only} names none of the ${set.length}${v.name ? ` that ${v.name} changes` : ""}` : `${v.name} changes none of the ${set.length}`}`);
    console.log(`removed ${await down()}`);
    return;
  }
  const answer = Tapes.answerer(show, season);
  const users = {};
  const replays = [];
  for (const [i, config] of set.entries()) {
    const n = i + 1;
    if (!plays(config, i)) continue;
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
      log: v.name ? [`Variant ${v.name}: ${v.says}`] : [],
      problems: [],
      episodes: [],
      weeks: {},
      did: {},
      asks: {},
      waivers: [],
      opts: v,
    });
    const r = replays[replays.length - 1];
    if (span.late) r.lateSeat = r.seats[r.seats.length - 1];
  }
  console.log(`${show} ${season}: ${E} episodes${copy.merge ? `, the merge at ${copy.merge}` : ", no merge"}; ${dims.game.join(", ")}; ${replays.length} replay(s) on ${SLUG(show)}`);
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
    // --before=N: stop with episode N's games started, drafted and its moves made, before it airs (a look after the draft).
    if (Number(opts.before) === ep) break;
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
      e.did = r.did[ep] || {};
      e.results = { quick: filed.quick.message, full: filed.full.message };
      e.stillInIt = stillInIt(e, [...r.episodes, e], (s.settings.endEpisode ?? E) - ep);
      e.asks = r.asks[ep] || {};
      r.episodes.push(e);
      try {
        // --window=merge: the window opens after the merge's results, while the game has episodes left to play.
        const opened = v.window && ep === windowAt && ep < (s.settings.endEpisode ?? E) && (await openWindow(r, ep));
        if (opened) (e.asks[r.seats[0].label] ||= { kind: "none", card: false, taps: 0 }).taps += TAPS.window;
        const w = await waivers(r, ep);
        if (w) {
          e.waivers = w;
          r.waivers.push(w);
          // The week after this episode: a replacement owed is a card, a claim is taps.
          for (const [label, a] of Object.entries(w.asks)) {
            const x = (e.asks[label] ||= { kind: "none", card: false, taps: 0 });
            x.card = x.card || a.card;
            x.taps += a.taps;
          }
        }
      } catch (e2) {
        r.problems.push(`Episode ${ep}: waivers failed: ${e2.message}`);
      }
    }
  }
  // A part of a season (--through, --before: for looks) goes beside the whole ones, never over them or into the summary.
  // A variant's replays go in a folder of their own (replays\variants\<variant>\), beside the whole set's, for `compare`.
  const partial = opts.before ? `before${opts.before}` : through < E ? `through${through}` : null;
  const home = v.name ? path.join(Tapes.TAPES, "replays", "variants", v.name) : path.join(Tapes.TAPES, "replays");
  const dir = partial ? path.join(home, "partial") : home;
  fs.mkdirSync(dir, { recursive: true });
  for (const r of replays) {
    const s = r.leagueId ? await stateOf(r.leagueId) : null;
    const file = path.join(dir, partial ? `${r.name}-${partial}` : r.name);
    const record = summarize(r, s, show, season, copy, results);
    fs.writeFileSync(`${file}.json`, JSON.stringify(record, null, 2) + "\n", "utf8");
    fs.writeFileSync(`${file}.md`, markdown(record), "utf8");
    console.log(`  ${r.n}. ${r.name}: ${record.final ? `${record.final.winner} ${partial ? "leads" : "won"}${record.final.over ? "" : " (not over)"}` : r.leagueId ? "started, no results yet" : "no game"}${r.problems.length ? `, ${r.problems.length} problem(s)` : ""}`);
    for (const p of r.problems.slice(0, 5)) console.log(`       ! ${p}`);
  }
  // The pushes the results sent run after their writes (next-after-stub.js): let them finish before the rows go.
  await new Promise((done) => setTimeout(done, 3000));
  if (!opts.keep) console.log(`removed ${await down()}`);
  else {
    // Kept for looks: the copy's clock set to the moment it stopped, so the show space reads as it would that night (the
    // replay ran with every episode still to air). --before=N: N airs in two hours; else the last played aired 12 hours ago.
    const stop = Number(opts.before) || Math.min(through, E);
    // The episode's time as the app works it out (a listed row, else from the ones before it or the premiere).
    const airAtOf = async () => (await appCode().schedules([copy.seasonId])).get(copy.seasonId)?.episodes.find((e) => e.number === stop)?.airAt;
    const at = await airAtOf();
    if (at) {
      const want = Date.now() + (opts.before ? 2 : -12) * 3600_000;
      const secs = Math.round((want - new Date(at).getTime()) / 1000);
      // Everything the schedule reads moves together: the listed rows and a drop to the second, the premiere (a date) by
      // whole days. A season with no listed rows (Survivor 49's copy) has its times from the premiere and its air time, so
      // its days are the ones that keep the episode at least two hours ahead (--before: within a day) or two hours aired
      // (--through), never a rounding (or a clock change) that puts it on the wrong side of now (aired, so locked, when the
      // look is before it).
      const listed = (await one("SELECT count(*)::int AS n FROM season_episodes WHERE season_id = $1", [copy.seasonId])).n > 0;
      const late = (Date.now() - new Date(at).getTime()) / DAY;
      const days = listed ? Math.round(secs / 86400) : opts.before ? Math.ceil(late + 2 / 24) : Math.floor(late - 2 / 24);
      await appCode().pool.query("UPDATE season_episodes SET air_at = air_at + make_interval(secs => $2) WHERE season_id = $1", [copy.seasonId, secs]);
      await appCode().pool.query("UPDATE show_seasons SET premiere_date = premiere_date + ($2::int), drop_at = drop_at + make_interval(secs => $3) WHERE id = $1", [
        copy.seasonId,
        days,
        listed ? secs : days * 86400,
      ]);
      const now = await airAtOf();
      const hours = now ? Math.round((new Date(now).getTime() - Date.now()) / 360_000) / 10 : null;
      console.log(`the copy's clock: episode ${stop} ${hours === null ? "(no time)" : hours >= 0 ? `airs in ${hours} hours` : `aired ${-hours} hours ago`}`);
    } else console.log(`the copy's clock wasn't moved: the schedule has no time for episode ${stop}, so the looks read every episode as still to come`);
    console.log(`kept: the games are on ${SLUG(show)} ${season}, season ${copy.seasonId} (sign in as zt_pt_tinkerer, ${PASSWORD}); down when done`);
    for (const r of replays) console.log(`  couch ${r.couchId}: ${r.n}. ${r.name}`);
  }
}

/**
 * A run's variant (its habits changed from the whole set's), from its flags: --away=favourites (someone away from the draft
 * gets the room's favourites, not the first on the list) and --window=merge (an Outlast game's runner opens a waiver window
 * after the merge). { name: "" } is the whole set. Pure.
 */
function variantOf(opts = {}) {
  const away = opts.away === undefined || opts.away === "list" ? null : opts.away;
  const window = opts.window === undefined ? null : opts.window;
  if (away && away !== "favourites") throw new Error(`--away is list or favourites, not ${away}`);
  if (window && window !== "merge") throw new Error(`--window is merge, not ${window}`);
  const name = [away && `away-${away}`, window && `window-${window}`].filter(Boolean).join("-");
  const says = [
    away && "whoever's away from the draft gets the room's favourites (by what the app knows, then the others' own picks), not the first on the list",
    window && "whoever runs an Outlast game opens one waiver window after the merge (or the middle episode), Swap anyone",
  ].filter(Boolean).join("; ");
  return { name, says, away: away || "list", window: !!window };
}

/** Whether a variant changes a config's replay, by any of its parts: away needs a draft someone's away from (a game with a
 *  draft, not a pool, and a forgetter who isn't the late joiner: a late seat joins after it); the window an exclusive
 *  Outlast with waivers on whose span plays on after `windowAt`. The whole set: every one. Pure. */
function changedBy(v, c, span, windowAt) {
  if (v.away !== "favourites" && !v.window) return true;
  const seats = seatsFor(c.group);
  const away = v.away === "favourites" && c.game !== "survivalPool" && seats.some((s, i) => s.role === "forgetter" && !(c.late === "yes" && i === seats.length - 1));
  const window = v.window && c.game === "outlast" && c.own === "exclusive" && c.waivers === "on" && span.from <= windowAt && (span.to ?? Infinity) > windowAt;
  return !!(away || window);
}

function summarize(r, s, show, season, copy, results) {
  const { S } = appCode();
  const last = r.episodes[r.episodes.length - 1];
  const final = s && last ? { winner: last.leaders.join(" & "), table: last.table, over: S.gameOver(s), settledAt: settledAt(r.episodes), leadChanges: r.episodes.filter((e) => e.leadChange).length } : null;
  return {
    replay: r.name,
    variant: r.opts.name || null,
    show,
    season,
    config: r.config,
    span: r.span,
    seats: r.seats.map((x) => ({ label: x.label, role: x.role, late: x === r.lateSeat })),
    computer: r.bots || [],
    settings: r.settings || null,
    draft: r.draft || null,
    drafted: r.drafted || null,
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

// ---------- P4's measures, across replays (the replay files only) ----------

const median = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const share = (xs) => (xs.length ? xs.filter(Boolean).length / xs.length : null);
/** A name as a replay wrote it, without its bracket: "Ann Lee (Voted out)" → "Ann Lee". */
const bare = (text) => String(text).replace(/ \([^)]*\)$/, "");

// ---------- a replay's facts, for the measures: its data, else (a file from before it had any) its words ----------
// Since P5, look, moves, the draft and waivers record ids, points and flags beside their words (an episode's `left` and
// `did`, a line's `starters`, `benched`, `saysKinds`, `picked`, `members`, the record's `drafted`). A file from before has
// only the words, read as they were. Either way a castaway is a key: its id from the data, else its name from the words
// (a file is all one or all the other). Pure.

/** Who left in an episode, as keys. */
const leftKeys = (e) => (e.left ? e.left.map((c) => c.id) : (e.out || []).map(bare));
/** A lineup line's starters: [{ key, points, explained (it came with the moments that scored) }]. */
function startersOf(w) {
  if (!w) return [];
  if (w.starters) return w.starters.map((l) => ({ key: l.id, points: l.points, explained: l.items.length > 0 }));
  // As look() writes one: "Name 3.5 (Perfect score 3, Performed multiple dances 0.5)", the brackets only with moments.
  return (w.started || []).map((t) => /^(.*?) (-?\d+(?:\.\d+)?)( \(.*\))?$/.exec(t)).filter(Boolean).map((m) => ({ key: m[1], points: Number(m[2]), explained: !!m[3] }));
}
/** A lineup line's bench: Map key → what they'd have scored (the words list only those who'd have scored something). */
function benchOf(w) {
  if (!w) return new Map();
  if (w.benched) return new Map(w.benched.map((l) => [l.id, l.points]));
  return new Map((w.bench || []).map((b) => /^(.*) would have scored (-?\d+(?:\.\d+)?)$/.exec(b)).filter(Boolean).map((m) => [m[1], Number(m[2])]));
}
/** A pool line's pick: { key, name } or null (none). */
function pickOf(w) {
  if (!w) return null;
  if ("picked" in w) return w.picked ? { key: w.picked.id, name: w.picked.name } : null;
  return w.pick && w.pick !== "none" ? { key: bare(w.pick), name: bare(w.pick) } : null;
}
/** An Outlast line's team: how many of them are still in. */
const stillInOf = (w) => (!w ? 0 : w.members ? w.members.filter((c) => !c.out).length : (w.team || []).filter((t) => !/ \(out\)$/.test(t)).length);
/** Whether the app praised a lineup line's calls ("Good call benching ...", "Perfect lineup"). */
const praisedOf = (w) => !!w && (w.saysKinds ? w.saysKinds.some((k) => k === "benchSaved" || k === "perfect") : (w.says || []).some((t) => /^(Good call benching|Perfect lineup)/.test(t)));
/**
 * A pool seat's move in an episode: { pick (a key, or null), forgot }, or null (no move that week). The data's pick is the
 * one that stands (a refused or not-taken new pick leaves the old one in `ids`); the words read only "picked" and "kept".
 * An episode with data is read only from it, so its keys are ids throughout.
 */
function poolMoveOf(e, label) {
  if (e.did) {
    const d = e.did[label];
    return d ? { pick: d.ids[0] ?? null, forgot: d.act === "forgot" } : null;
  }
  const move = (e.moves || {})[label];
  if (!move) return null;
  const m = /^(?:picked|kept) (.*)$/.exec(move);
  return { pick: m ? m[1] : null, forgot: move === "no pick (forgot)" };
}
/** Whether a seat set no lineup for an episode (forgot). */
function forgotLineup(e, label) {
  if (e.did) return !!e.did[label] && e.did[label].kind === "lineup" && e.did[label].act === "forgot";
  return (e.moves || {})[label] === "no lineup (forgot)";
}
/** A seat's draft, as keys in the order picked, or null (no draft for them). */
function draftedOf(x, label) {
  if (x.drafted) return x.drafted[label] ? x.drafted[label].map((d) => d.id) : null;
  return x.draft && x.draft[label] ? x.draft[label].map((n) => n.replace(/ \((picked|locked in) for them\)$/, "")) : null;
}

/**
 * A Weekly Lineup replay's forgetter with a default lineup (the report's direction: the draft's first picks start until you
 * choose, and an open slot fills itself), worked out from the replay alone: each week their lineup was short (none set, or
 * someone on it went home and they didn't come back to fill it), the open slots go to the first of their draft still in and
 * not starting, scoring what the replay says they'd have scored on the bench. { weeks (short ones), extra, place, placeWith }
 * (place 0 first, 1 last, ties counted as level), or null (not a Weekly Lineup, no forgetter, no draft for them). Pure.
 */
function defaultLineupOf(x) {
  const seat = x.seats.find((s) => s.role === "forgetter");
  const last = x.episodes[x.episodes.length - 1];
  const drafted = seat && draftedOf(x, seat.label);
  if (!x.config || x.config.game !== "weeklyLineup" || !seat || !last || !drafted || last.table.length < 2) return null;
  const slots = (x.settings && x.settings.activeSlots) || 3;
  const outAt = new Map();
  for (const e of x.episodes) for (const k of leftKeys(e)) if (!outAt.has(k)) outAt.set(k, e.n);
  let weeks = 0;
  let extra = 0;
  for (const e of x.episodes) {
    const why = (e.why || {})[seat.label];
    if (!why) continue;
    const started = startersOf(why).map((l) => l.key);
    const open = slots - started.length;
    if (open <= 0) continue;
    const bench = benchOf(why);
    // The draft first, then anyone else on the bench (a waiver pickup; an older file's bench lists only those who'd have scored).
    const fill = [...drafted.filter((n) => !(outAt.get(n) < e.n)), ...[...bench.keys()].filter((n) => !drafted.includes(n))].filter((n) => !started.includes(n)).slice(0, open);
    if (!fill.length) continue;
    weeks++;
    extra += fill.reduce((t, n) => t + (bench.get(n) || 0), 0);
  }
  const mine = last.table.find((t) => t.name === seat.label);
  if (!mine) return null;
  const rank = (total) => last.table.filter((t) => t.name !== seat.label && t.total > total).length / (last.table.length - 1);
  return { weeks, extra: Math.round(extra * 10) / 10, place: rank(mine.total), placeWith: rank(mine.total + extra) };
}

/**
 * A Survival Pool replay's forgetter with a pick made for them (the report's direction: a missed week gets a pick, so it
 * doesn't end a season), worked out from the replay alone: each week they made no pick, the one the most others picked that
 * week (then the first such by name) that they haven't used; it survives unless it left that episode. Streaks and totals
 * worked out again for them, as the app ranks a pool (longest streak, then picks survived). Also `frozen`: a missed week
 * that neither ends nor adds to a streak (the gentler direction). { weeks, played, covered, frozen ({ streak, total }:
 * `played` is the replay's own, to check against its table), place, placeWith, placeFrozen } (0 first, 1 last, ties
 * level), or null (not a pool, no forgetter). Pure.
 */
function poolFallbackOf(x) {
  const seat = x.seats.find((s) => s.role === "forgetter");
  const last = x.episodes[x.episodes.length - 1];
  if (!x.config || x.config.game !== "survivalPool" || !seat || !last || last.table.length < 2 || !last.table.some((t) => t.name === seat.label)) return null;
  // Who the covered run has used (their own picks and the ones made for them): nobody twice.
  const used = new Set();
  // frozen: a missed week neither ends nor adds to a streak (the week left out).
  const runs = { played: [], covered: [], frozen: [] };
  let weeks = 0;
  // The room's pick that week: the most picked by the others, then by name, that the covered run hasn't used.
  const roomPick = (e) => {
    const count = new Map();
    for (const [label, w] of Object.entries(e.why || {})) {
      const p = pickOf(w);
      if (label === seat.label || !p || used.has(p.key)) continue;
      const c = count.get(p.key) || { name: p.name, n: 0 };
      c.n++;
      count.set(p.key, c);
    }
    return [...count].sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name))[0]?.[0] ?? null;
  };
  for (const e of x.episodes) {
    const move = poolMoveOf(e, seat.label);
    if (!move) continue;
    const out = new Set(leftKeys(e));
    const { pick, forgot } = move;
    runs.played.push(!!pick && !out.has(pick));
    if (!forgot) runs.frozen.push(!!pick && !out.has(pick));
    // Covered: their own pick, unless one made for them earlier used it (then the room's, as they'd have had to pick again).
    let cover = pick && !used.has(pick) ? pick : null;
    if (!cover && (pick || forgot)) {
      cover = roomPick(e);
      if (cover && forgot) weeks++;
    }
    if (cover) used.add(cover);
    runs.covered.push(!!cover && !out.has(cover));
  }
  const score = (run) => {
    let longest = 0;
    let now = 0;
    for (const ok of run) {
      now = ok ? now + 1 : 0;
      longest = Math.max(longest, now);
    }
    return { streak: longest, total: run.filter(Boolean).length };
  };
  const others = last.table.filter((t) => t.name !== seat.label);
  const rank = ({ streak, total }) => others.filter((t) => (t.streak ?? 0) > streak || ((t.streak ?? 0) === streak && t.total > total)).length / others.length;
  const played = score(runs.played);
  const covered = score(runs.covered);
  const frozen = score(runs.frozen);
  return { weeks, played, covered, frozen, place: rank(played), placeWith: rank(covered), placeFrozen: rank(frozen) };
}

/**
 * An Outlast replay's end with ties at the top broken by who has the most people still in (the report's direction for
 * short spans), from its last episode's teams. { tied (as played), tiedStill (after the break) }, or null (not Outlast). Pure.
 */
function stillInBreakOf(x) {
  const last = x.episodes[x.episodes.length - 1];
  if (!x.config || x.config.game !== "outlast" || !last) return null;
  const tied = last.leaders.length > 1;
  const left = (name) => stillInOf((last.why || {})[name]);
  const most = Math.max(...last.leaders.map(left));
  return { tied, tiedStill: tied && last.leaders.filter((n) => left(n) === most).length > 1 };
}

/** Where a role's (first) seat finished in a replay, by table order: { at (1 first), of }, or null. Pure. */
function finishOf(x, role) {
  const last = x && x.episodes[x.episodes.length - 1];
  const seat = x && x.seats.find((s) => s.role === role);
  if (!last || !seat) return null;
  const i = last.table.findIndex((t) => t.name === seat.label);
  return i < 0 ? null : { at: i + 1, of: last.table.length };
}

/**
 * P4's questions, measured over a set of replays of one game (docs/PLAN-playtests.md P4), each a fraction or a median:
 *   Fun          over (the game says it's over), leadChanges, settled (how far in the winner took first place for good,
 *                0 the first episode, 1 the last), tiedTop (the end level at the top), quiet (episodes where nobody's
 *                points or streak moved), wiped (replays where someone's team had nobody left before the end)
 *   Plays well   tinkerer and forgetter (where they finished: 0 first, 1 last), problems (replays with any)
 *   Makes sense  silent (Weekly Lineup starters who scored with no reason to show: the reveal lists each starter's points with
 *                its moments, episode-view.ts `why`, so a score with none can't be explained)
 * And the directions tried on the files (defaultLineupOf, poolFallbackOf, stillInBreakOf): forgetterCovered, tiedStill.
 * Pure.
 */
function judgeOf(records) {
  const place = (x, role) => {
    const f = finishOf(x, role);
    return f && f.of > 1 ? (f.at - 1) / (f.of - 1) : null;
  };
  const defaults = records.map(defaultLineupOf).filter(Boolean);
  const fallbacks = records.map(poolFallbackOf).filter(Boolean);
  const breaks = records.filter((x) => x.episodes.length).map(stillInBreakOf).filter(Boolean);
  const quietOf = (x) =>
    x.episodes.map((e, i) => {
      const before = i ? new Map(x.episodes[i - 1].table.map((t) => [t.playerId, t])) : null;
      return e.table.every((t) => {
        const b = before ? before.get(t.playerId) : null;
        return b ? b.total === t.total && (b.streak ?? 0) === (t.streak ?? 0) : !t.total && !t.streak;
      });
    });
  // Every starter who scored (startersOf), and whether their points came with the moments that scored them.
  const scored = records.flatMap((x) => x.episodes.flatMap((e) => Object.values(e.why || {}).flatMap((w) => startersOf(w).filter((l) => l.points !== 0))));
  const played = records.filter((x) => x.episodes.length);
  return {
    replays: records.length,
    over: share(played.map((x) => !!(x.final && x.final.over))),
    leadChanges: median(played.map((x) => (x.final ? x.final.leadChanges : null))),
    settled: median(
      played.map((x) => {
        const i = x.final && x.episodes.length > 1 ? x.episodes.findIndex((e) => e.n === x.final.settledAt) : -1;
        return i < 0 ? null : i / (x.episodes.length - 1);
      })
    ),
    tiedTop: share(played.map((x) => x.episodes[x.episodes.length - 1].leaders.length > 1)),
    quiet: share(played.flatMap(quietOf)),
    wiped: share(played.map((x) => x.episodes.slice(0, -1).some((e) => (e.teamsWithNobodyLeft || []).length))),
    tinkerer: median(played.map((x) => place(x, "tinkerer"))),
    forgetter: median(played.map((x) => place(x, "forgetter"))),
    problems: share(records.map((x) => (x.problems || []).length > 0)),
    silent: scored.length ? share(scored.map((l) => !l.explained)) : null,
    // The forgetter's median place (ties level) as played and covered while away: Weekly Lineup's open slots filled
    // (defaultLineupOf), a pool's missed picks made (poolFallbackOf).
    forgetterCovered: (() => {
      const xs = [...defaults, ...fallbacks];
      return xs.length ? { from: median(xs.map((d) => d.place)), to: median(xs.map((d) => d.placeWith)), frozen: fallbacks.length ? median(fallbacks.map((d) => d.placeFrozen)) : null, replays: xs.length } : null;
    })(),
    // Outlast: still tied at the top once the most people still in breaks it (stillInBreakOf), beside `tiedTop`.
    tiedStill: breaks.length ? share(breaks.map((b) => b.tiedStill)) : null,
  };
}

const mean = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/**
 * How much each week asks (P4's Plays well), over replays with `asks` on their episodes (moves' and waivers'): per person
 * and week the game is in play, the taps their move took (TAPS) and whether the app showed a move to make (a card on
 * Tonight). weeks: person-weeks; taps: mean taps a week; card: the share of weeks with a card; byRole: the same for the
 * tinkerer, the drive-by and the forgetter, with `season` their median taps over a whole-season game; most: the most anyone
 * tapped in one week. idlePraise: weeks someone set no lineup (forgot) and the app still said something about their calls
 * ("Good call benching ...", "Perfect lineup"), of `forgot` such weeks. Pure.
 */
function asksOf(records) {
  const rows = [];
  const perSeason = {};
  let forgot = 0;
  let idlePraise = 0;
  for (const x of records) {
    const sums = {};
    for (const e of x.episodes || []) {
      for (const [label, a] of Object.entries(e.asks || {})) {
        const seat = x.seats.find((s) => s.label === label);
        if (!seat) continue;
        rows.push({ role: seat.role, taps: a.taps, card: !!a.card });
        sums[label] = { role: seat.role, taps: (sums[label]?.taps ?? 0) + a.taps };
      }
      for (const label of new Set([...Object.keys(e.did || {}), ...Object.keys(e.moves || {})])) {
        if (!forgotLineup(e, label)) continue;
        forgot++;
        if (praisedOf((e.why || {})[label])) idlePraise++;
      }
    }
    // A whole season's taps: only from games that run the whole season (a one-episode game's would pull it down).
    if (x.config && x.config.span === "season") for (const s of Object.values(sums)) (perSeason[s.role] ||= []).push(s.taps);
  }
  const of = (xs) => ({ weeks: xs.length, taps: mean(xs.map((r) => r.taps)), card: share(xs.map((r) => r.card)) });
  const byRole = {};
  for (const role of ["tinkerer", "driveby", "forgetter"]) byRole[role] = { ...of(rows.filter((r) => r.role === role)), season: median(perSeason[role] || []) };
  return { ...of(rows), byRole, most: rows.length ? Math.max(...rows.map((r) => r.taps)) : null, forgot, idlePraise };
}

/** The replays in rfl-tapes\replays (or a folder under it: `variants\<variant>`), as their records. */
function replaysIn(sub) {
  const Tapes = require("./tapes");
  const dir = path.join(Tapes.TAPES, "replays", ...(sub ? String(sub).split(/[\\/]/) : []));
  const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) : [];
  return { dir, all };
}

function judge(sub) {
  if (sub !== undefined && typeof sub !== "string") throw new Error("--dir needs a folder under rfl-tapes\\replays, e.g. --dir=variants/away-favourites");
  const { dir, all } = replaysIn(sub);
  if (!all.length) throw new Error(`No replays in ${dir}`);
  const groups = new Map();
  for (const x of all) {
    for (const key of [`${x.config.game} · all`, `${x.config.game} · ${x.show} ${x.season}`]) (groups.get(key) || groups.set(key, []).get(key)).push(x);
  }
  const pct = (v) => (v === null ? "" : `${Math.round(v * 100)}%`);
  const num = (v) => (v === null ? "" : String(Math.round(v * 10) / 10));
  const lines = [
    `# Replays judged: P4's measures`,
    ``,
    `${all.length} replay(s) in ${dir}, written by playtest.js judge. Over: the game says it's over at the end. Settled: how far in the winner took first place for good (0% the first episode). Tied top: level at the top at the end. Quiet: episodes where nobody's points or streak moved. Wiped: someone's team had nobody left before the end. Tinkerer, Forgetter: median finish (0% first, 100% last). Silent: Weekly Lineup starters who scored with no reason to show. Tied top, most still in breaks it: Outlast's ends still level at the top once the most people still in wins. Forgetter, covered while away: the forgetter's median place (ties level) as played → with each Weekly Lineup open slot (no lineup, or someone on it gone home) filled from the bench in draft order, or each missed pool pick made for them (the room's most picked they hadn't used; frozen: a missed week neither ends nor adds to a streak instead); worked out from the replay's own bench and picks.`,
    ``,
    `| Game | Replays | Over | Lead changes | Settled | Tied top | Quiet | Wiped | Tinkerer | Forgetter | Problems | Silent | Tied top, most still in breaks it | Forgetter, covered while away |`,
    `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`,
  ];
  for (const [key, xs] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const j = judgeOf(xs);
    lines.push(`| ${key} | ${j.replays} | ${pct(j.over)} | ${num(j.leadChanges)} | ${pct(j.settled)} | ${pct(j.tiedTop)} | ${pct(j.quiet)} | ${pct(j.wiped)} | ${pct(j.tinkerer)} | ${pct(j.forgetter)} | ${pct(j.problems)} | ${pct(j.silent)} | ${pct(j.tiedStill)} | ${j.forgetterCovered ? `${pct(j.forgetterCovered.from)} → ${pct(j.forgetterCovered.to)}${j.forgetterCovered.frozen !== null ? ` (frozen ${pct(j.forgetterCovered.frozen)})` : ""}` : ""} |`);
  }
  lines.push(
    ``,
    `## How much each week asks`,
    ``,
    `Per person and week in play (the moves before an episode and the waiver claims after it), from replays that recorded it. Taps: the mean a week, counted from Tonight on the new design's screens (playtest.js TAPS: a lineup is open, a tap per start or bench, Save; looking and keeping it 2; a pool pick 3; a waiver claim 1 + 3 a spot; opening a window 5); the reveal before them isn't counted. Card: weeks the app showed a move to make. Season: the median taps over a whole-season game, for that role. Idle praise: weeks someone set no lineup and the app still praised their calls, of the weeks they forgot.`,
    ``,
    `| Game | Person-weeks | Taps a week | Card | Tinkerer (taps, card, season) | Drive-by | Forgetter | Most in a week | Idle praise |`,
    `|---|---|---|---|---|---|---|---|---|`
  );
  const role = (b) => (b.weeks ? `${num(b.taps)}, ${pct(b.card)}, ${num(b.season)}` : "");
  for (const [key, xs] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const a = asksOf(xs);
    if (!a.weeks) continue;
    lines.push(`| ${key} | ${a.weeks} | ${num(a.taps)} | ${pct(a.card)} | ${role(a.byRole.tinkerer)} | ${role(a.byRole.driveby)} | ${role(a.byRole.forgetter)} | ${a.most} | ${a.forgot ? `${a.idlePraise} of ${a.forgot}` : ""} |`);
  }
  lines.push(``);
  fs.writeFileSync(path.join(dir, "JUDGE.md"), lines.join("\n"), "utf8");
  console.log(lines.join("\n"));
}

/**
 * A variant's replays beside the whole set's, by name (`compare <variant>`): who won, where the forgetter finished, the
 * teams wiped out at the end, and what a window got back. Pure over the two sets of records.
 */
function compareOf(base, variant) {
  const byName = new Map(base.map((x) => [x.replay, x]));
  const wipedAtEnd = (x) => {
    const last = x && x.episodes[x.episodes.length - 1];
    return last ? (last.teamsWithNobodyLeft || []).length : null;
  };
  return variant.map((v) => {
    const b = byName.get(v.replay) || null;
    // Only a window someone opened (--window), not the windows a schedule opens: `byHand`, or for a record from before it,
    // the episode the log says it was opened after.
    const logged = (v.log || []).map((l) => /opened a window after episode (\d+)/.exec(l)).filter(Boolean).map((m) => Number(m[1]));
    const windows = (v.episodes || []).flatMap((e) => (e.waivers && e.waivers.window && (e.waivers.byHand ?? logged.includes(e.waivers.episode)) ? [e.waivers] : []));
    return {
      replay: v.replay,
      base: !!b,
      winner: { base: b && b.final ? b.final.winner : null, variant: v.final ? v.final.winner : null },
      forgetter: { base: finishOf(b, "forgetter"), variant: finishOf(v, "forgetter") },
      wipedAtEnd: { base: wipedAtEnd(b), variant: wipedAtEnd(v) },
      window: windows.length ? { at: windows[0].episode, wiped: windows[0].wiped.length, backIn: windows[0].backIn.length, ran: windows[0].ran.length } : null,
    };
  });
}

function compare(name) {
  if (!name) throw new Error("compare <variant>: a folder in rfl-tapes\\replays\\variants (away-favourites, window-merge)");
  const base = replaysIn().all;
  const { dir, all } = replaysIn(path.join("variants", name));
  if (!all.length) throw new Error(`No replays in ${dir}: run <show> <season> with the variant's flags first`);
  const rows = compareOf(base, all);
  const place = (p) => (p ? `${p.at} of ${p.of}` : "");
  const lines = [
    `# ${name} against the whole set`,
    ``,
    `${rows.length} replay(s) in ${dir}, each beside the replay of the same name in rfl-tapes\\replays (written by playtest.js compare).`,
    ``,
    `| Replay | Winner (whole set → variant) | Forgetter | Wiped at the end | Window: after ep, wiped, back in, moves |`,
    `|---|---|---|---|---|`,
    ...rows.map(
      (r) =>
        `| ${r.replay} | ${r.winner.base ?? "(none)"} → ${r.winner.variant ?? "(none)"} | ${place(r.forgetter.base)} → ${place(r.forgetter.variant)} | ${r.wipedAtEnd.base ?? ""} → ${r.wipedAtEnd.variant ?? ""} | ${r.window ? `${r.window.at}, ${r.window.wiped}, ${r.window.backIn}, ${r.window.ran}` : ""} |`
    ),
    ``,
  ];
  fs.writeFileSync(path.join(dir, "COMPARE.md"), lines.join("\n"), "utf8");
  console.log(lines.join("\n"));
}

// ---------- who left, by the quick check and by the full research (the tape only) ----------

/**
 * Per episode on a tape, who left by the bot's quick check (`left`) and by its full research (`leftTheGame: yes`), each
 * answer's episode title, and where they disagree; then each person both name, with the episode each says they left in.
 * What reaches a game on Autopilot is the full answer's (it files after the quick and replaces it), so a disagreement is a
 * result some game gets wrong. `files` is tapes.js readTape's; `cast` the season's names, matched as the app matches a
 * name to the cast (state-logic.js findCastawayByName: punctuation, accents, a first name), so a spelling isn't a
 * disagreement. Pure.
 */
function exitsOf(files, cast = []) {
  const { Core } = require("../../src/lib/game/state-logic.js");
  const roster = { castaways: cast.map((name, i) => ({ id: `c${i}`, name })) };
  const fold = (name) =>
    String(name || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const personKey = (name) => fold(Core.findCastawayByName(roster, name).castaway?.name ?? name);
  const byEp = new Map();
  const at = (n) => byEp.get(n) || byEp.set(n, { n, quick: null, full: null }).get(n);
  for (const f of files) {
    if (!f.ok || f.episode == null) continue;
    if (f.kind === "quick" && f.parsed) at(f.episode).quick = { title: f.parsed.episodeTitle || null, left: (f.parsed.left || []).map((x) => `${x.name}${x.how ? ` (${x.how})` : ""}`), names: (f.parsed.left || []).map((x) => x.name), headline: f.parsed.headline || "" };
    // The parse the recorder kept (parsed.parsed), or a stored answer's own JSON (Survivor 49's, kept as filed).
    const full = f.kind === "full" && f.parsed ? (f.parsed.parsed || (Array.isArray(f.parsed.castaways) ? f.parsed : null)) : null;
    if (full) {
      const gone = (full.castaways || []).filter((c) => String(c.leftTheGame).toLowerCase() === "yes");
      at(f.episode).full = { title: full.episodeTitle || null, left: gone.map((c) => `${c.name}${c.exitMethod ? ` (${c.exitMethod})` : ""}`), names: gone.map((c) => c.name) };
    }
  }
  const episodes = [...byEp.values()].sort((a, b) => a.n - b.n);
  const people = new Map();
  for (const e of episodes) {
    for (const [side, ans] of [["quick", e.quick], ["full", e.full]]) {
      for (const name of (ans && ans.names) || []) {
        const p = people.get(personKey(name)) || people.set(personKey(name), { name, quick: null, full: null }).get(personKey(name));
        if (p[side] === null) p[side] = e.n;
      }
    }
    const q = new Set(((e.quick && e.quick.names) || []).map(personKey));
    const f = new Set(((e.full && e.full.names) || []).map(personKey));
    // null: only one of them is on tape yet.
    e.agree = e.quick && e.full ? q.size === f.size && [...q].every((k) => f.has(k)) : null;
  }
  // Only where both were asked: an episode with one answer on tape so far says nothing either way.
  const both = new Set(episodes.filter((e) => e.agree !== null).map((e) => e.n));
  const differ = [...people.values()].filter((p) => p.quick !== p.full && (both.has(p.quick) || both.has(p.full)));
  return { episodes, differ };
}

function exitsMarkdown(show, season, x) {
  const lines = [`# Who left: ${show} ${season}, the quick check against the full research`, ``, `| Ep | Quick: who left | Full: who left | Agree | Titles |`, `|---|---|---|---|---|`];
  for (const e of x.episodes) {
    const titles = e.quick && e.full && e.quick.title !== e.full.title ? `${e.quick.title} / ${e.full.title}` : (e.quick || e.full || {}).title || "";
    lines.push(`| ${e.n} | ${e.quick ? e.quick.left.join(", ") || "nobody" : "(not asked)"} | ${e.full ? e.full.left.join(", ") || "nobody" : "(not asked)"} | ${e.agree === null ? "" : e.agree ? "yes" : "**no**"} | ${titles} |`);
  }
  lines.push(``, `People the two put in different episodes (or only one names):`, ``);
  for (const p of x.differ) lines.push(`- ${p.name}: quick ${p.quick ?? "never"}, full ${p.full ?? "never"}`);
  return lines.join("\n") + "\n";
}

// ---------- what the app says to each seat (kept replays) ----------

/**
 * `says <episode>`: on the replays kept with run --keep, each seat's lineup for an episode and the lines the app shows them
 * about it (episode-team-summary.ts episodeTeamBullets, the reveal's), for Weekly Lineup games. A repro for what a player
 * reads (PLAYTEST-REPORT.md finding 11).
 */
async function says(n) {
  const { pool, S, bullets } = appCode();
  const { rows } = await pool.query(
    `SELECT l.slug, l.state, m.player_id, u.username FROM leagues l JOIN league_memberships m ON m.league_id = l.id JOIN "user" u ON u.id = m.user_id
      WHERE l.slug LIKE 'zt-pt-%' AND u.username LIKE 'zt\\_pt\\_%' ORDER BY l.slug, u.username`
  );
  if (!rows.length) return console.log("No kept replays: run <show> <season> --keep first");
  for (const { slug, state, player_id: pid, username } of rows) {
    if (!S.getLeagueType(state).hasActiveRoster) continue;
    // As the replay's look() reads it: the game through that episode, nothing after.
    const view = S.SpoilerLogic.viewThrough(state, n);
    const ep = view.episodes.find((e) => e.number === n);
    if (!ep) continue;
    const lineup = (S.ActiveRosterLogic.lineupFor(view, ep.id, pid) || []).map((id) => castName(view, id));
    console.log(`${slug} ${username}, episode ${n}: lineup ${lineup.length ? lineup.join(", ") : "none"}; says ${JSON.stringify(bullets(view, ep.id, pid).map((b) => b.text))}`);
  }
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
    const dims = dimsFor(tape.season && tape.season.rulebook);
    const { picked, pairs, configs } = pairwise(dims, { merge });
    console.log(`${dims.game.join(", ")} (what Start a game offers); ${configs} configs, ${pairs} pairs of settings; ${picked.length} replays cover every pair${merge ? ` (the merge at ${merge})` : " (no merge)"}:`);
    for (const [i, c] of picked.entries()) {
      const sp = spanOf(c, E, merge);
      console.log(`  ${String(i + 1).padStart(2)}. ${replayName(rest[0], rest[1], c)}  (episodes ${sp.from}-${sp.to ?? E}${sp.late ? `, late at ${sp.late}` : ""})`);
    }
    return;
  }
  if (cmd === "exits") {
    const Tapes = require("./tapes");
    const tape = rest.length === 2 ? Tapes.readTape(rest[0], Number(rest[1])) : null;
    if (!tape || !tape.files.some((f) => f.kind === "quick" || f.kind === "full")) {
      process.exitCode = 1;
      return console.log(`No quick or full answers on tape for ${rest.join(" ") || "(no show)"}: node scripts/dev-test/playtest.js exits <show> <season>`);
    }
    const text = exitsMarkdown(rest[0], rest[1], exitsOf(tape.files, ((tape.season && tape.season.cast) || []).map((c) => c.name)));
    fs.mkdirSync(path.join(Tapes.TAPES, "replays"), { recursive: true });
    fs.writeFileSync(path.join(Tapes.TAPES, "replays", `exits-${rest[0]}-${rest[1]}.md`), text, "utf8");
    return console.log(text);
  }
  if (cmd === "run") return run(rest[0], Number(rest[1]), flags);
  if (cmd === "down") return console.log(`removed ${await down()}`);
  if (cmd === "summary") return summary();
  if (cmd === "judge") return judge(flags.dir);
  if (cmd === "compare") return compare(rest[0]);
  if (cmd === "says") {
    if (!(Number(rest[0]) >= 1)) throw new Error("says <episode>: an episode number");
    return says(Number(rest[0]));
  }
  console.log("Usage: node scripts/dev-test/playtest.js matrix|run|exits|summary|judge|compare|says|down <show> <season> (see the header comment)");
}

module.exports = { summaryLine, judgeOf, defaultLineupOf, poolFallbackOf, stillInBreakOf, asksOf, compareOf, variantOf, changedBy, favourites, lineupTaps, claimTaps, TAPS, upgradeStored, shiftAnswer, exitsOf, DIMENSIONS, NA, gamesOf, dimsFor, applies, allConfigs, pairsOf, pairwise, replayName, ROLES, seatsFor, hash01, movesThisWeek, prefer, mergeOf, spanOf, settledAt };

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
