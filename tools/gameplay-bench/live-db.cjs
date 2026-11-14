// Materializes a runtime case into the LOCAL dev database as zt-gb- rows, so the bench's frames read the REAL API
// routes (docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md §3.4). The runtime stays the source of definitions and traces;
// this module only writes its current state where the app reads it, and reads back what real writes did.
//
// Contract (from the route sweep, 2026-11-12): a league joins its season through settings.showId = shows.slug and
// settings.wikiSeason = season_number; every read restamps state.episodes[].airsAt from the season schedule, so air
// times go in season_episodes.air_at (source 'admin'), shifted so the scenario clock maps to the server's now (no route
// takes an injected clock); spoiler marks are league_memberships.results_seen_through + show_follows.seen_through
// (+ lateJoin in own-pace state); answers are game_answers rows. Every row is keyed on a zt-gb-<key> slug or a
// <name>_ztgb<key><n> username (a person's own initial on faces), so down() can only remove what up() made. Refuses a non-local database.
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local'), quiet: true });
const crypto = require('crypto');
const PASSWORD = 'zt-pass-12345';
// One pool per local database: this checkout's by default, or a worktree's when a case renders in that worktree's app.
const pools = new Map();
function pool(url = process.env.AUTH_DATABASE_URL || '') {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) throw Error('Bench live mode writes to a local database only');
  if (!pools.has(url)) { const { Pool } = require('pg'); pools.set(url, new Pool({ connectionString: url, max: 4 })); }
  return pools.get(url);
}
const keyOf = () => crypto.randomBytes(4).toString('hex');
const slugOf = (key, ...parts) => ['zt-gb', key, ...parts].join('-');
const usernameOf = (key, i, name) => ((name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'p') + '_ztgb' + key + i;
const released = e => ['partial', 'final', 'corrected'].includes(e.resultStatus);

/** The DB copy of a runtime game state: the same state, tied to its zt season. */
function stateFor(state, season, shiftMs = 0) {
  const copy = JSON.parse(JSON.stringify(state));
  copy.settings.showId = season.slug; copy.settings.wikiSeason = season.number;
  // Mid-season waivers: every moment of their weeks (opened, process and close times, the run's) shifted as the schedule is, so the
  // server's clock reads them where the runtime's did (a week's times are worked out from when it opened and the next air time).
  const shift = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? new Date(Date.parse(v) + shiftMs).toISOString() : v && typeof v === 'object' ? (Array.isArray(v) ? v.map(shift) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shift(x)]))) : v;
  if (shiftMs && copy.midSeason?.waivers) copy.midSeason.waivers = shift(copy.midSeason.waivers);
  return copy;
}

/** Create identity rows for a case. `snap` is runtime session.snapshot(); `document` its input. */
async function up(snap, document, dbUrl, onLease) {
  const db = pool(dbUrl || undefined), key = keyOf(), one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const { hashPassword } = await import('better-auth/crypto');
  const hash = await hashPassword(PASSWORD);
  const ids = { key, db: dbUrl || null, users: {}, seasons: {}, leagues: {}, couchId: null, groups: {} };
  if (onLease) onLease(key);
  try {
    for (const [i, p] of snap.people.entries()) {
      const id = crypto.randomUUID().replace(/-/g, ''), username = usernameOf(key, i + 1, p.name);
      // Sign-in needs the zt_ username; faces and names in the app read the display name, so it is the person's own.
      await db.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $4, $2, now(), now())`, [id, p.name, username + '@example.invalid', username]);
      await db.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
      ids.users[p.id] = { id, username };
    }
    const owner = ids.users[snap.people[0].id].id;
    ids.couchId = (await one(`INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id`, ['ZT Bench ' + key, owner])).id;
    for (const [i, p] of snap.people.entries()) await db.query(`INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, $3, 'couch')`, [ids.couchId, ids.users[p.id].id, i ? 'member' : 'owner']);
    for (const [ci, [contextId, world]] of Object.entries(snap.contexts).entries()) {
      const slug = slugOf(key, ci + 1), format = world.context.format?.id || 'survivor';
      const show = (await one(`INSERT INTO shows (slug, name, format, created_by) VALUES ($1, $2, $3, $4) RETURNING id`, [slug, 'ZT Bench ' + (world.context.label || contextId), format, owner])).id;
      const season = (await one(`INSERT INTO show_seasons (show_id, season_number, name, status, air_tz, episode_count, episode_minutes, cast_approved_at) VALUES ($1, 1, $2, 'airing', 'America/New_York', $3, 60, now()) RETURNING id`, [show, 'ZT Bench ' + key, world.events.length])).id;
      ids.seasons[contextId] = { id: season, slug, number: 1 };
      ids.groups[contextId] = (await one(`INSERT INTO league_groups (created_by) VALUES ($1) RETURNING id`, [owner])).id;
      for (const [i, c] of world.participants.entries()) await db.query(`INSERT INTO season_cast (season_id, name, photo_url, sort_order) VALUES ($1, $2, $3, $4)`, [season, c.name, c.photoUrl || null, i]);
    }
    for (const [gi, game] of document.games.entries()) {
      const state = snap.games[game.id].state, season = ids.seasons[game.contextId], slug = slugOf(key, 'g' + (gi + 1));
      const id = (await one(`INSERT INTO leagues (name, slug, join_code, state, created_by, group_id, group_position, couch_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [game.name || state.settings.leagueTypeId || game.id, slug, ('G' + key + gi).toUpperCase().slice(0, 12), JSON.stringify(stateFor(state, season)), owner, ids.groups[game.contextId], gi, ids.couchId])).id;
      ids.leagues[game.id] = id;
      // A stage of a game in stages (stages.cjs: its own game in the definition, after its parent): a league of its own tied to the
      // game's (leagues.stage_of, stage_key), as engine-lab.ts makeStages makes one; the game's seats and memberships under the same
      // player ids (below), as stages.ts mirrors them. The server reads the game's table from them (answer-points.ts stageWalk).
      if (game.stageOf !== undefined) await db.query(`UPDATE leagues SET stage_of = $2, stage_key = $3 WHERE id = $1`, [id, ids.leagues[game.stageOf], game.stageKey]);
      for (const [i, p] of state.players.entries()) await db.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, 0)`, [id, ids.users[p.id].id, p.id, (Object.values(game.roles || {}).includes('commissioner') ? game.roles[p.id] === 'commissioner' : !i) ? 'commissioner' : 'member']); // (the commissioner the definition's roles name, else the first seat: the runtime's runsGame)
    }
    return ids;
  } catch (error) { await down(key, dbUrl).catch(() => {}); throw error; }
}

/** Write the runtime's mutable state: game states, schedule (shifted to now), marks, answers, accepted results. */
// The season's confirmed phase starts (a world with context.phaseStarts), as the desk confirms them: its rulebook made as the
// season's own (db/rulebooks.js ensureSeasonRulebook; the format's template already exists) and each start set the desk's way
// (setPhaseStart), a start not yet confirmed cleared. The server reads them back (phase-starts.ts leaguePhases).
async function syncPhases(db, seasonId, world) {
  if (!world.context.phaseStarts) return;
  const Rb = require('../../db/rulebooks.js'), made = await Rb.ensureSeasonRulebook(db, seasonId);
  if (!made?.row) throw Error('No season rulebook for the phase starts');
  for (const p of require('./explorer/runtime-data.cjs').phaseList(world).filter(x => !x.first)) {
    const r = await Rb.setPhaseStart(db, made.row.id, p.id, p.from);
    if (r?.refused) throw Error('Phase start refused: ' + JSON.stringify(r.refused));
  }
}
async function sync(ids, snap, document, shiftMs) {
  const db = pool(ids.db || undefined), client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const [contextId, world] of Object.entries(snap.contexts)) {
      const season = ids.seasons[contextId];
      await syncPhases(client, season.id, world);
      await client.query(`DELETE FROM season_episodes WHERE season_id = $1`, [season.id]);
      const who = new Map(world.participants.map(p => [p.id, p.name]));
      for (const e of world.events) {
        // A finale's recap names the winner (as a real one leads with), not the whole field; recaps fit the column's 1000 characters.
        const exits = released(e) ? world.facts.find(f => f.eventId === e.id)?.data.events || [] : [], out = exits.map(x => who.get(x.castawayId));
        const won = exits.find(x => x.method === require('../../src/lib/game/formats').formatFor(world.context.format.id).winnerExitMethod);
        const summary = released(e) ? ('Synthetic recap of episode ' + e.number + (won ? ': ' + who.get(won.castawayId) + ' won the season.' : out.length ? ': ' + out.join(' and ') + ' went home.' : ': nobody went home.')).slice(0, 1000) : null;
        await client.query(`INSERT INTO season_episodes (season_id, number, air_at, runtime_min, source, title, summary, summary_at) VALUES ($1, $2, $3, 60, 'admin', $4, $5, CASE WHEN $5::text IS NULL THEN NULL ELSE now() END)`, [season.id, e.number, e.airAt ? new Date(Date.parse(e.airAt) + shiftMs).toISOString() : null, e.title || null, summary]);
      }
      const first = world.events.find(e => e.airAt);
      if (first) await client.query(`UPDATE show_seasons SET premiere_date = ($2::timestamptz AT TIME ZONE air_tz)::date, air_time = ($2::timestamptz AT TIME ZONE air_tz)::time WHERE id = $1`, [season.id, new Date(Date.parse(first.airAt) + shiftMs).toISOString()]);
      // The season's accepted results, from the shared facts (stats, calls and the not-playing fallback read these).
      await client.query(`DELETE FROM season_decisions WHERE season_id = $1`, [season.id]);
      const name = new Map(world.participants.map(p => [p.id, p.name]));
      for (const f of world.facts) {
        const e = world.events.find(x => x.id === f.eventId);
        if (!e || !['final', 'corrected'].includes(e.resultStatus)) continue;
        for (const out of f.data.events || []) await client.query(`INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at) VALUES ($1, $2, 'elimination', $3, $4, '', 'accepted', true, now())`, [season.id, e.number, name.get(out.castawayId), out.method]);
        for (const m of f.data.scoringEvents || []) await client.query(`INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at) VALUES ($1, $2, 'event', $3, '', $4, 'accepted', true, now())`, [season.id, e.number, name.get(m.castawayId), m.type]);
      }
      // Who voted for whom (a bounty's record) and the pairs the show forms (group slots' format timeline): the season's stored research answer, source 'combined', as vote-records.ts reads it
      // on every read and write (runtime-data.cjs researchOf: the same payload the runtime reads). The zt show's own rows only.
      const showId = (await client.query(`SELECT show_id FROM show_seasons WHERE id = $1`, [season.id])).rows[0].show_id;
      await client.query(`DELETE FROM episode_research WHERE show_id = $1`, [showId]);
      for (const f of world.facts) {
        const e = world.events.find(x => x.id === f.eventId), payload = e && released(e) ? require('./explorer/runtime-data.cjs').researchOf(world, f.data, e.number) : null;
        if (payload) await client.query(`INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source) VALUES ($1, $2, $3, $4, $5, 'combined')`, [showId, season.number, e.number, JSON.stringify(payload), JSON.stringify({ source: 'zt-gameplay-bench' })]);
      }
      for (const m of world.marks) {
        const user = ids.users[m.personId].id;
        await client.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3) ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = EXCLUDED.seen_through, early_seen = NULL, early_night = NULL`, [user, season.id, m.through]);
        await client.query(`UPDATE league_memberships SET results_seen_through = $3 WHERE user_id = $1 AND league_id = ANY($2::uuid[])`, [user, document.games.filter(g => g.contextId === contextId).map(g => ids.leagues[g.id]), m.through]);
      }
      // Weekly Calls: each person's calls (episode_calls, the runtime's calls store), a cast call by its season_cast id (the
      // materialized cast, matched by name). Removing the season or the user removes them (both cascade).
      if (snap.stores.calls?.[contextId]) {
        await client.query(`DELETE FROM episode_calls WHERE season_id = $1`, [season.id]);
        const castId = new Map((await client.query(`SELECT id, name FROM season_cast WHERE season_id = $1`, [season.id])).rows.map(r => [r.name, r.id]));
        for (const c of snap.stores.calls[contextId]) {
          const answer = c.question === 'out' ? castId.get(name.get(c.answer)) : c.answer;
          if (!answer) throw Error('A call names someone not in the materialized cast: ' + c.answer);
          await client.query(`INSERT INTO episode_calls (user_id, season_id, episode, question, answer) VALUES ($1, $2, $3, $4, $5)`, [ids.users[c.personId].id, season.id, c.episode, c.question, answer]);
        }
      }
    }
    for (const game of document.games) {
      const league = ids.leagues[game.id];
      await client.query(`UPDATE leagues SET state = $2, updated_at = now() WHERE id = $1`, [league, JSON.stringify(stateFor(snap.games[game.id].state, ids.seasons[game.contextId], shiftMs))]);
      // Mid-season waivers: the week's private claims (waiver_claims), the runtime's store, in its order (updated_at a step apart).
      await client.query(`DELETE FROM waiver_claims WHERE league_id = $1`, [league]);
      for (const [periodId, week] of Object.entries(snap.stores.waivers?.[game.id]?.weeks || {})) for (const [playerId, x] of Object.entries(week).sort(([, a], [, b]) => a.seq - b.seq))
        await client.query(`INSERT INTO waiver_claims (league_id, period_id, player_id, pairs, pickup_ids, drop_id, add_ids, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb, now() + make_interval(secs => $8))`, [league, periodId, playerId, JSON.stringify(x.claim.pairs), JSON.stringify(x.claim.pickupIds || []), x.claim.dropId || null, JSON.stringify(x.claim.addIds || []), x.seq / 1000]);
      await client.query(`DELETE FROM game_answers WHERE league_id = $1`, [league]);
      for (const r of snap.stores.answers[game.id] || []) await client.query(`INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by) VALUES ($1, $2, $3, $4, $5, $6)`, [league, r.playerId, r.question, r.episode, JSON.stringify(r.answer), ids.users[r.playerId]?.id || null]);
      // Secret roles: the deal (secret_role_deals), the runtime's (seeded from the game's id), replacing any the server made on a read
      // (its seed is random); none yet, none. The stamps travel with the state. Cascades with the league.
      if (snap.stores.roles && game.id in snap.stores.roles) {
        await client.query(`DELETE FROM secret_role_deals WHERE league_id = $1`, [league]);
        const d = snap.stores.roles[game.id];
        if (d) await client.query(`INSERT INTO secret_role_deals (league_id, seed, seats, holders, role) VALUES ($1, $2, $3, $4, $5)`, [league, d.seed, JSON.stringify(d.seats), JSON.stringify(d.holders), d.role]);
      }
      // The top scorer's twist: each episode's choice, open or filed (twist_choices), the runtime's twists store; the filed ones are
      // stamped on the state's episodes already (as twists.ts stamps them). Cascades with the league.
      if (snap.stores.twists?.[game.id]) {
        await client.query(`DELETE FROM twist_choices WHERE league_id = $1`, [league]);
        for (const [n, r] of Object.entries(snap.stores.twists[game.id])) await client.query(`INSERT INTO twist_choices (league_id, episode, player_id, twist, filed, how) VALUES ($1, $2, $3, $4, $5, $6)`, [league, Number(n), r.playerId, r.twist, !!r.filed, r.how]);
      }
      // Beat the bot: its calls (bot_calls, filed as a stand-in's: never production's), the runtime's bot store. Cascades with the league.
      if (snap.stores.bot?.[game.id]) {
        await client.query(`DELETE FROM bot_calls WHERE league_id = $1`, [league]);
        for (const r of snap.stores.bot[game.id]) await client.query(`INSERT INTO bot_calls (league_id, question, episode, answer, made_by) VALUES ($1, $2, $3, $4, 'stand-in')`, [league, r.question, r.episode, JSON.stringify(r.answer)]);
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

/**
 * Social setup the runtime doesn't model (chat, reactions, reveal lines, GIFs), seeded once so host pages such as
 * Tonight have their recap/discussion sections. Timed from each episode's shifted air time. The after-air message names
 * who went home on purpose: it exercises the app's hiding for people who are behind. GIF URLs are placeholders on an
 * allowed host (the app only accepts KLIPY/GIPHY media); real GIF art needs a cached-asset decision (docs/VISUAL-ASSETS.md).
 */
async function seedSocial(ids, snap, document, shiftMs) {
  const db = pool(ids.db || undefined), people = snap.people, user = id => ids.users[id].id, name = new Map(people.map(p => [p.id, p.name]));
  for (const [contextId, world] of Object.entries(snap.contexts)) {
    const season = ids.seasons[contextId].id, league = ids.leagues[document.games.find(g => g.contextId === contextId)?.id];
    const who = new Map(world.participants.map(p => [p.id, p.name])), markOf = id => world.marks.find(m => m.personId === id).through;
    const at = (e, minutes) => new Date(Date.parse(e.airAt) + shiftMs + minutes * 60000).toISOString();
    const say = async (row) => (await db.query(`INSERT INTO chat_messages (league_id, couch_id, season_id, user_id, author_name, type, text, created_at, author_seen) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, row)).rows[0].id;
    for (const e of world.events.filter(released)) {
      // The after-air line is written by someone who has seen the episode (nobody posts about an exit they haven't watched).
      const a = people[e.number % people.length], seenIt = people.filter(p => markOf(p.id) >= e.number), b = seenIt[e.number % Math.max(1, seenIt.length)];
      if (league) {
        await say([league, null, null, user(a.id), a.name, 'message', 'Who are we all starting for episode ' + e.number + '?', at(e, -60), e.number - 1]);
        const out = (world.facts.find(f => f.eventId === e.id)?.data.events || []).map(x => who.get(x.castawayId));
        if (b) {
          const after = await say([league, null, null, user(b.id), b.name, 'message', out.length ? 'Cannot believe ' + out[0] + ' went home' : 'Nobody went home?!', at(e, 70), e.number]);
          await db.query(`INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`, [after, user(a.id), '😮']);
        }
        for (const p of people.filter(p => markOf(p.id) >= e.number)) await say([league, null, null, user(p.id), p.name, 'reveal', p.name + ' revealed episode ' + e.number, at(e, 180 + people.indexOf(p) * 7), e.number]);
      }
      for (const p of people.filter(p => markOf(p.id) >= e.number)) await db.query(`INSERT INTO episode_gifs (user_id, season_id, episode, gif) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [user(p.id), season, e.number, JSON.stringify({ id: 'ztgb' + e.number + people.indexOf(p), url: 'https://static.klipy.com/zt-bench/' + e.number + '-' + people.indexOf(p) + '.gif', w: 200, h: 150, title: name.get(p.id) + ' on episode ' + e.number })]);
    }
    const next = world.events.find(e => !released(e) && e.airAt);
    if (next) await say([null, ids.couchId, season, user(people[0].id), people[0].name, 'message', 'Anyone watching episode ' + next.number + ' live?', at(next, -120), markOf(people[0].id)]);
  }
}

/** What the app's real writes left: per-game state, per-person marks, answers. */
async function read(ids) {
  const db = pool(ids.db || undefined), leagues = Object.values(ids.leagues), users = Object.values(ids.users).map(u => u.id);
  const states = (await db.query(`SELECT id, state FROM leagues WHERE id = ANY($1::uuid[])`, [leagues])).rows;
  const members = (await db.query(`SELECT league_id, player_id, results_seen_through FROM league_memberships WHERE league_id = ANY($1::uuid[])`, [leagues])).rows;
  const follows = (await db.query(`SELECT user_id, season_id, seen_through FROM show_follows WHERE user_id = ANY($1::text[])`, [users])).rows;
  const answers = (await db.query(`SELECT league_id, player_id, question, episode, answer FROM game_answers WHERE league_id = ANY($1::uuid[])`, [leagues])).rows;
  // Weekly Calls: each person's calls, a cast call named (its season_cast row), as the runtime compares them by name.
  const calls = (await db.query(`SELECT c.user_id, c.season_id, c.episode, c.question, c.answer, sc.name AS cast_name FROM episode_calls c LEFT JOIN season_cast sc ON sc.season_id = c.season_id AND sc.id::text = c.answer WHERE c.user_id = ANY($1::text[])`, [users])).rows;
  // The top scorer's twist: each game's choices by episode, open or filed.
  const twists = (await db.query(`SELECT league_id, episode, player_id, twist, filed, how FROM twist_choices WHERE league_id = ANY($1::uuid[])`, [leagues])).rows;
  // Mid-season waivers: each week's private claims, in the order "who has claims in" lists them.
  const claims = (await db.query(`SELECT league_id, period_id, player_id, pairs FROM waiver_claims WHERE league_id = ANY($1::uuid[]) ORDER BY updated_at, player_id`, [leagues])).rows;
  return { states: new Map(states.map(r => [r.id, r.state])), members, follows, answers, calls, twists, claims };
}

/** A materialized season's cast, season_cast id -> name (a call names someone by their season_cast id). */
async function castNames(ids, seasonId) {
  const db = pool(ids.db || undefined);
  return new Map((await db.query(`SELECT id, name FROM season_cast WHERE season_id = $1`, [seasonId])).rows.map(r => [r.id, r.name]));
}

async function down(key, dbUrl) {
  if (!/^[0-9a-f]{8}$/.test(key)) throw Error('Unexpected bench case key');
  const db = pool(dbUrl || undefined), like = slugOf(key, '%');
  const users = (await db.query(`SELECT id FROM "user" WHERE username LIKE $1`, ['%\\_ztgb' + key + '_%'])).rows.map(r => r.id);
  const groups = (await db.query(`SELECT DISTINCT group_id FROM leagues WHERE slug LIKE $1 AND group_id IS NOT NULL`, [like])).rows.map(r => r.group_id);
  await db.query(`DELETE FROM leagues WHERE slug LIKE $1`, [like]);
  if (groups.length) await db.query(`DELETE FROM league_groups WHERE id = ANY($1::uuid[])`, [groups]);
  await db.query(`DELETE FROM couches WHERE name = $1 AND created_by = ANY($2::text[])`, ['ZT Bench ' + key, users]);
  await db.query(`DELETE FROM shows WHERE slug LIKE $1`, [like]);
  if (users.length) await db.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [users]);
}
/** Remove every bench case's rows (after a crash or an Atlas restart). */
async function downAll(dbUrl) {
  const db = pool(dbUrl || undefined);
  const keys = new Set((await db.query(`SELECT username FROM "user" WHERE username ~ '_ztgb[0-9a-f]{8}[0-9]{1,2}$' OR username LIKE 'zt\\_gb\\_%'`)).rows.map(r => (r.username.match(/_ztgb([0-9a-f]{8})\d+$/) || r.username.match(/^zt_gb_([0-9a-f]{8})_/) || [])[1]).filter(Boolean));
  for (const slug of (await db.query(`SELECT slug FROM shows WHERE slug LIKE 'zt-gb-%'`)).rows.map(r => r.slug)) keys.add(slug.split('-')[2]);
  for (const key of keys) if (/^[0-9a-f]{8}$/.test(key)) await down(key, dbUrl);
  return [...keys];
}
const close = async () => { const all = [...pools.values()]; pools.clear(); await Promise.all(all.map(p => p.end())); };
module.exports = { up, sync, seedSocial, read, castNames, down, downAll, close, PASSWORD, released };

if (require.main === module) {
  // down-all: this checkout's database and every worktree's (cases may have rendered in a worktree's app).
  const all = async () => { let n = 0; for (const w of require('./worktrees.cjs').worktreeApps()) n += (await downAll(w.main ? undefined : w.db)).length; return n; };
  (process.argv[2] === 'down-all' ? all().then(n => console.log('[zt-gb] removed', n, 'bench case(s)')) : Promise.reject(Error('usage: node tools/gameplay-bench/live-db.cjs down-all')))
    .catch(e => { console.error(e.message); process.exitCode = 1; }).finally(close);
}
