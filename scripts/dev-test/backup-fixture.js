// Dev-only test bank: linked-fixture.js's group of three leagues, filled so that every table a league backup
// holds (scripts/backup-common.js) has rows: a zt show, season and format of its own; a second person;
// cast, results, research, rule and cast changes, wiki reads and proposals; invites, a ruleset, waiver claims,
// blind picks, team notes, chat with a reaction and reads (and the couch's own chat about the season, with its
// read: step 4); settings and notification prefs; rulebooks (the season's, with a show change and a suggested fix, a
// league's own copy, a library starting point) and a line in the desk's history (step 6b part 2). Also the foreign
// key cycles (the group's favourite league, a league's ruleset, a season's and a league's rulebook) and one league outside the group that a cast
// change points at, so a --group backup has a reference to settle.
//
//   node scripts/dev-test/backup-fixture.js up      create (or refresh) it, print the group id
//   node scripts/dev-test/backup-fixture.js down    remove every row it made
//
// Also a module: `const { up, down } = require("./backup-fixture")`; `up` resolves { groupId, leagues }.
// Everything is keyed on zt- slugs, the zt-show / zt-format ids and zt_ usernames. Never run it against a
// real database (it refuses a non-local one).
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const linked = require("./linked-fixture");

const SHOW = "zt-show";
const FORMAT = "zt-format";
const ANN = "zt_bk_ann";

async function down(pool) {
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]); // seasons, cast, results, research, wiki reads go with it
  await pool.query("DELETE FROM show_formats WHERE id = $1", [FORMAT]);
  // Neither hangs off the show: the desk's history names things by id, and a library rulebook has no season.
  await pool.query("DELETE FROM admin_changes WHERE text LIKE 'zt:%'");
  await pool.query("DELETE FROM rulebooks WHERE owner_kind = 'library' AND name LIKE 'zt %'");
  await linked.down(pool); // every zt- league (zt-outside included), the group, zt_tester
  await pool.query(`DELETE FROM "user" WHERE username = $1`, [ANN]);
}

async function up(pool) {
  await down(pool);
  const leagues = await linked.up(pool);
  const [classic, roster, poolLeague] = leagues.map((l) => l.leagueId);
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  const { id: me, group_id: groupId } = await one(
    `SELECT u.id, l.group_id FROM "user" u JOIN leagues l ON l.created_by = u.id WHERE u.username = $1 AND l.id = $2`,
    [linked.USERNAME, classic]
  );
  const ann = (await one(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt")
    VALUES ('zt_bk_ann_id', $1, 'zt_bk_ann@example.invalid', true, $1, $1, now(), now()) RETURNING id`, [ANN])).id;
  const players = (await one("SELECT state->'players' AS p FROM leagues WHERE id = $1", [classic])).p;
  await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'member')`, [classic, ann, players[1].id]);

  // The leagues play a zt season of a zt show with a zt format.
  await pool.query(`INSERT INTO show_formats (id, name, status, proposal, created_by) VALUES ($1, 'ZT format', 'draft', '{}', $2)`, [FORMAT, me]);
  const show = (await one(`INSERT INTO shows (slug, name, format, created_by) VALUES ($1, 'ZT Show', $2, $3) RETURNING id`, [SHOW, FORMAT, me])).id;
  const season = (await one(
    `INSERT INTO show_seasons (show_id, season_number, name, status, cast_created_by_league) VALUES ($1, 1, 'ZT Show 1', 'airing', $2) RETURNING id`,
    [show, classic]
  )).id;
  await pool.query(
    `UPDATE leagues SET state = jsonb_set(jsonb_set(state, '{settings,showId}', to_jsonb($1::text)), '{settings,wikiSeason}', '1') WHERE id = ANY($2::uuid[])`,
    [SHOW, [classic, roster, poolLeague]]
  );
  const outside = (await one(
    `INSERT INTO leagues (name, slug, join_code, state, created_by) SELECT 'ZT Outside', 'zt-outside', 'ZTOUTS', state, created_by FROM leagues WHERE id = $1 RETURNING id`,
    [classic]
  )).id;

  // Season level.
  const cast = (await one(`INSERT INTO season_cast (season_id, name, tribe_name, sort_order) VALUES ($1, 'Castaway 0', 'Red', 0) RETURNING id`, [season])).id;
  await pool.query(`INSERT INTO season_cast (season_id, name, tribe_name, sort_order) VALUES ($1, 'Castaway 1', 'Blue', 1)`, [season]);
  await pool.query(
    `INSERT INTO season_cast_changes (season_id, season_cast_id, field, before, after, changed_by, by_league) VALUES ($1, $2, 'tribe_name', 'Red', 'Blue', $3, $4)`,
    [season, cast, ann, outside]
  );
  const extraction = (await one(
    `INSERT INTO wiki_extractions (show_id, season_number, kind, payload, provenance) VALUES ($1, 1, 'episodes', '{"episodes": []}', '{}') RETURNING id`,
    [show]
  )).id;
  const research = (await one(
    `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1, 1, 1, '{"exiled": ["Castaway 0"]}', '{}') RETURNING id`,
    [show]
  )).id;
  const decision = (await one(
    `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, extraction_id, research_id, sources, status, decided_by)
     VALUES ($1, 1, 'exiled', 'Castaway 0', '', '', $2, $3, ARRAY['wiki', 'research'], 'accepted', $4) RETURNING id`,
    [season, extraction, research, me]
  )).id;
  await pool.query(`INSERT INTO season_rule_changes (season_id, status, summary, proposal, created_by) VALUES ($1, 'draft', 'zt', '{}', $2)`, [season, me]);
  await pool.query(
    `INSERT INTO season_episodes (season_id, number, air_at, runtime_min, note, reported_in) VALUES ($1, 2, '2026-11-05T01:00:00Z', 120, 'zt: a week off', 1)`,
    [season]
  );
  await pool.query(
    `INSERT INTO episode_research_items (league_id, research_id, episode_number, kind, castaway_name, sources, decided_by) VALUES ($1, $2, 1, 'exiled', 'Castaway 0', ARRAY['zt'], $3)`,
    [classic, research, me]
  );
  await pool.query(`INSERT INTO league_applied_decisions (league_id, decision_id, decided_at, detail) VALUES ($1, $2, now(), '{"zt": true}')`, [classic, decision]);
  await pool.query(`INSERT INTO wiki_proposals (league_id, kind, payload, provenance) VALUES ($1, 'eliminations', '{}', '{}')`, [classic]);
  await pool.query(
    `INSERT INTO wiki_proposal_items (league_id, extraction_id, episode_number, kind, castaway_name, method, event_type, decided_by) VALUES ($1, $2, 1, 'exiled', 'Castaway 0', '', '', $3)`,
    [classic, extraction, me]
  );

  // League level, both cycles included.
  const ruleset = (await one(`INSERT INTO league_rulesets (league_id, name, data, parent_kind, created_by) VALUES ($1, 'ZT rules', '{}', 'none', $2) RETURNING id`, [roster, me])).id;
  await pool.query("UPDATE leagues SET ruleset_id = $1 WHERE id = $2", [ruleset, roster]);
  await pool.query("UPDATE league_groups SET favorite_league_id = $1, name = 'ZT couch' WHERE id = $2", [poolLeague, groupId]);
  await pool.query(`INSERT INTO league_invites (league_id, invited_by, identifier, player_id) VALUES ($1, $2, 'zt_someone', $3)`, [classic, me, players[2].id]);
  await pool.query(`INSERT INTO waiver_claims (league_id, period_id, player_id, pairs, updated_by) VALUES ($1, 'zt-p1', $2, '[]', $3)`, [roster, players[0].id, me]);
  await pool.query(`INSERT INTO blind_draft_picks (league_id, player_id, castaway_ids, locked_at) VALUES ($1, $2, '["k1", "k2"]', now())`, [classic, players[0].id]);
  await pool.query(`INSERT INTO episode_team_notes (league_id, episode_number, player_id, why_text) VALUES ($1, 1, $2, 'zt: why')`, [classic, players[0].id]);
  const msg = (await one(`INSERT INTO chat_messages (league_id, user_id, author_name, type, text) VALUES ($1, $2, $3, 'message', 'zt hi') RETURNING id`, [classic, me, linked.USERNAME])).id;
  await pool.query(`INSERT INTO chat_messages (league_id, user_id, author_name, type, text, edited_at) VALUES ($1, $2, $3, 'message', 'zt hey', now())`, [poolLeague, ann, ANN]);
  await pool.query(`INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES ($1, $2, '🔥')`, [msg, ann]);
  await pool.query(`INSERT INTO chat_reads (league_id, user_id, last_read_at) VALUES ($1, $2, now())`, [classic, me]);
  await pool.query(`INSERT INTO user_settings (user_id, show_results_immediately) VALUES ($1, true) ON CONFLICT (user_id) DO NOTHING`, [me]);
  await pool.query(`INSERT INTO notification_prefs (user_id, disabled) VALUES ($1, '["chat"]')`, [ann]);
  // Couches and follows (step 0b): the group is one couch, with an invite code, and both people follow the season.
  const couch = (await one(`INSERT INTO couches (name, created_by) VALUES ('ZT couch', $1) RETURNING id`, [me])).id;
  await pool.query("UPDATE leagues SET couch_id = $1 WHERE id = ANY($2::uuid[])", [couch, [classic, roster, poolLeague]]);
  await pool.query(`INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [couch, me, ann]);
  await pool.query(`INSERT INTO couch_invites (code, couch_id, created_by) VALUES ('ZTCOUCH1', $1, $2)`, [couch, me]);
  await pool.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 4), ($3, $2, 0)`, [me, season, ann]);
  // The couch's own chat about the season (step 4, migration 0110: no league), with a reaction, and how far it's read.
  const couchMsg = (await one(`INSERT INTO chat_messages (couch_id, season_id, user_id, author_name, type, text) VALUES ($1, $2, $3, $4, 'message', 'zt couch hi') RETURNING id`, [
    couch, season, ann, ANN,
  ])).id;
  await pool.query(`INSERT INTO chat_reactions (message_id, user_id, emoji) VALUES ($1, $2, '👍')`, [couchMsg, me]);
  await pool.query(`INSERT INTO couch_chat_reads (couch_id, season_id, user_id, last_read_at) VALUES ($1, $2, $3, now())`, [couch, season, me]);
  // A line in Recent changes (0111), with its undo.
  await pool.query(
    `INSERT INTO league_changes (batch, league_id, user_id, kind, tier, episode, text, undo, undo_until)
     VALUES (gen_random_uuid(), $1, $2, 'settings', 1, NULL, 'zt changed a setting', '{"type":"settings","field":"zt","before":1,"after":2}', now() + interval '1 day')`,
    [classic, me]
  );
  // Results from everyone (0112): a couch's submission sourcing the season's result, a flag on it, and a house ruling.
  const sent = (await one(
    `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source, submitted_by, couch_id, covers)
     VALUES ($1, 1, 1, '{"facts": []}', '{}', 'paste', $2, $3, '{"people": ["Castaway 0"], "kinds": null}') RETURNING id`,
    [show, ann, couch]
  )).id;
  await pool.query(`INSERT INTO fact_sources (decision_id, research_id, method, confidence) VALUES ($1, $2, '', 'high')`, [decision, sent]);
  await pool.query(`INSERT INTO fact_disputes (season_id, episode_number, decision_id, user_id, couch_id, reason, note) VALUES ($1, 1, $2, $3, $4, 'didnt-happen', 'zt: it was the other one')`, [
    season, decision, ann, couch,
  ]);
  await pool.query(`INSERT INTO league_rulings (league_id, decision_id, keeps, ruled_by) VALUES ($1, $2, '{"kind": "exiled"}', $3)`, [classic, decision, me]);
  // Rulebooks (0107; backed up since step 6b part 2) and the desk (0113): the season's, edited, which the season points
  // back at; a league's own copy, which the league points back at; a starting point in the library; a show change, a
  // suggested fix, and the desk's line for the change.
  const book = (await one(`INSERT INTO rulebooks (name, owner_kind, season_id, status, blocks, version) VALUES ('ZT rulebook', 'season', $1, 'in_force', '{"kind": "competition"}', 2) RETURNING id`, [season])).id;
  await pool.query("UPDATE show_seasons SET rulebook_id = $1 WHERE id = $2", [book, season]);
  const own = (await one(
    `INSERT INTO rulebooks (name, owner_kind, league_id, season_id, status, blocks, parent_kind, parent_id) VALUES ('ZT own copy', 'league', $1, $2, 'in_force', '{"kind": "competition"}', 'rulebook', $3) RETURNING id`,
    [classic, season, book]
  )).id;
  await pool.query("UPDATE leagues SET rulebook_id = $1 WHERE id = $2", [own, classic]);
  await pool.query(`INSERT INTO rulebooks (name, owner_kind, is_template, status, blocks) VALUES ('zt starting point', 'library', true, 'in_force', '{"kind": "competition"}')`);
  await pool.query(`INSERT INTO rulebook_edits (rulebook_id, kind, from_episode, status, summary, base_version, created_by) VALUES ($1, 'show_changed', 3, 'in_force', 'zt: a new twist', 1, $2)`, [book, me]);
  await pool.query(`INSERT INTO rulebook_suggestions (rulebook_id, season_id, user_id, couch_id, about, note) VALUES ($1, $2, $3, $4, 'segment', 'zt: reward is only some weeks')`, [
    book, season, ann, couch,
  ]);
  await pool.query(`INSERT INTO admin_changes (entity, entity_id, action, text, undo, user_id) VALUES ('rulebook', $1, 'showChanged', 'zt: the show changed from Episode 3', '{"type": "rulebookEdit"}', $2)`, [book, me]);

  console.log(`[zt] backup fixture up: group ${groupId}, ${leagues.length} linked leagues + zt-outside, every backed-up table filled`);
  return { groupId, leagues };
}

module.exports = { up, down };

if (require.main === module) {
  const url = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) throw new Error("backup-fixture runs against a local database only");
  const pool = new Pool({ connectionString: url });
  const cmd = process.argv[2];
  (cmd === "up" ? up(pool) : cmd === "down" ? down(pool).then(() => console.log("[zt] backup fixture down")) : Promise.reject(new Error("usage: up | down")))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
