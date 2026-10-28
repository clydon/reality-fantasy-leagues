// Dev-only test bank (docs/PLAN-new-design.md step R3, plan T-30): leagues on every kind of rules a league can have
// today, for checking rulebooks against them -- the flag on and off (check-rulebook-flag.js), and later the editors'
// pushes and own copies (step 6b).
//
//   node scripts/dev-test/rulebook-fixture.js up [--copies=1]
//   node scripts/dev-test/rulebook-fixture.js down
//
// Seasons named "zt-rulebooks", numbered 994, on the real Survivor, The Traitors (US) and The Challenge shows, and a
// throwaway show zt-rb-show (season 994) on a stored format zt-rb-format (Survivor's data under its own id, with its
// own points, approved). Survivor 994 has an approved season rule change from episode 3 (a ztBonus event research
// awards). On each season, a league of each type (Weekly Lineup, Outlast draft, Survival Pool), `--copies` times,
// each played through 6 episodes from buildDemoState. Most leave points to the rules (no settings.eventPoints), so a
// wrong catalog shows in the scores; the drafts keep their own. On Survivor 994, besides:
//   zt-rb-own       its own ruleset copy (league_rulesets, other points)
//   zt-rb-adopted   adopted the season's rule change, and scored its ztBonus from episode 3
//   zt-rb-legacy    no settings.showFormat (a league from before formats: Survivor's by default)
//   zt-rb-stale     settings.showFormat 'traitors' on a Survivor season (a cache out of step)
//   zt-rb-noseason  Survivor season 9994, which isn't in the catalog
// The built-in shows' 994 seasons start with the rulebook every season made before docs/PLAN-start-a-game-gpt.md S2 got,
// frozen from its format (compiled_source 'legacy', its family's reader: what Survivor 51 plays). Season 995 of Survivor
// and The Traitors are made today, with no rulebook yet, and a Weekly Lineup each (zt-rb-fresh-survivor, -traitors): a
// built-in whose blocks stand alone (Survivor's) is compiled from them, never frozen again.
//
// Every league slug starts zt-rb-, every season is named zt-rulebooks, and `down` removes those (their rulebooks,
// edits and rule changes cascade), the zt show, its format and the format's library template. No users. Local only.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const S = require("../../src/lib/game/state-logic.js");
const Formats = require("../../src/lib/game/formats/index.js");
const R = require("../../db/rulebooks.js");

const SEASON = 994;
const FRESH = 995;
const FRESH_SHOWS = [["survivor", "survivor"], ["the-traitors-us", "traitors"]];
const SEASON_NAME = "zt-rulebooks";
const EPISODES = 6;
const SHOW_SLUG = "zt-rb-show";
const FORMAT_ID = "zt-rb-format";
const TYPES = ["active-roster", "classic-draft", "pickem"];
const SHOWS = [
  ["survivor", "survivor"],
  ["the-traitors-us", "traitors"],
  ["the-challenge", "challenge"],
  [SHOW_SLUG, FORMAT_ID],
];

// Survivor's rules under the stored format's own id, every point moved, so nothing scores like the built-in.
const storedData = () => {
  const d = JSON.parse(JSON.stringify(Formats.FORMATS.survivor.data));
  d.id = FORMAT_ID;
  d.name = "zt Stored Survivor";
  for (const e of d.events) if (typeof e.defaultPoints === "number") e.defaultPoints += 1;
  return d;
};
// A commissioner's own copy of Survivor's rules: the same events, other points (forkLeagueRuleset keeps the id).
const ownData = () => {
  const d = JSON.parse(JSON.stringify(Formats.FORMATS.survivor.data));
  d.name = "Our Survivor";
  for (const e of d.events) if (typeof e.defaultPoints === "number") e.defaultPoints *= 2;
  return d;
};
const CHANGE = {
  effectiveEpisode: 3,
  summary: "zt: a bonus research awards from episode 3",
  delta: {
    addCategories: [{ id: "ztTwist", label: "zt twist" }],
    addEvents: [{ id: "ztBonus", label: "zt bonus", defaultPoints: 4, category: "ztTwist" }],
    addQuestions: [{ key: "ztBonus", type: "answer", description: "Got the zt bonus this episode?", note: "zt bonus" }],
    addRules: { research: [{ when: { answer: "ztBonus", is: "yes" }, award: "ztBonus" }] },
  },
};

/** A league played through EPISODES on format `formatId`'s family (a stored one plays Survivor's demo). */
function demoState(formatId, type) {
  const family = Formats.isBuiltInFormat(formatId) ? formatId : "survivor";
  const f = Formats.FORMATS[family];
  const winner = f.winnerExitMethod;
  const finalist = f.endgameExitMethods.find((m) => m !== winner);
  const out = f.exitMethods.filter((m) => m !== "Other" && !f.endgameExitMethods.includes(m));
  const n = 10;
  const data = {
    id: `zt-rb-${family}`, showId: family, showName: family, seasonName: SEASON_NAME, episodeCount: EPISODES,
    players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#888" })),
    castaways: Array.from({ length: n }, (_, i) => ({
      key: `k${i}`, name: `Castaway ${String.fromCharCode(65 + i)}`, placement: i + 1, exitEpisode: Math.min(i + 1, EPISODES),
      exitMethod: i === n - 1 ? winner : i >= n - 3 ? finalist : out[i % out.length],
      ...(family === "traitors" && i % 3 === 0 ? { role: { value: i % 2 ? "Recruited Traitor" : "Traitor", sinceEpisode: 1 } } : {}),
    })),
  };
  const s = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, type, EPISODES))));
  for (const ep of s.episodes) for (const ev of ep.events || []) if (ev.method === finalist || ev.method === winner) ev.juryVotes = ev.method === winner ? 5 : 0;
  if (type !== "classic-draft") delete s.settings.eventPoints;
  return s;
}

async function down(pool) {
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-rb-%'`); // rulesets, own rulebooks and memberships cascade
  await pool.query(`DELETE FROM show_seasons WHERE season_number = ANY($1) AND name=$2`, [[SEASON, FRESH], SEASON_NAME]); // season rulebooks, edits, changes cascade
  await pool.query(`DELETE FROM shows WHERE slug=$1`, [SHOW_SLUG]);
  await pool.query(`DELETE FROM rulebooks WHERE owner_kind='library' AND parent_kind='show_format' AND parent_id=$1`, [FORMAT_ID]);
  await pool.query(`DELETE FROM show_formats WHERE id=$1`, [FORMAT_ID]);
}

let made = 0;
async function insertLeague(pool, slug, name, state) {
  const code = `ZR${String(++made).padStart(4, "0")}`;
  const { rows } = await pool.query(`INSERT INTO leagues (name, slug, join_code, state) VALUES ($1,$2,$3,$4) RETURNING id`, [name, slug, code, JSON.stringify(state)]);
  return rows[0].id;
}

/** -> { seasons: { [showSlug]: seasonId }, fresh: { [showSlug]: seasonId }, leagues: [{ slug, leagueId, kind, show, type }], change } */
async function up(pool, { copies = 1 } = {}) {
  await down(pool);
  made = 0;
  const stored = storedData();
  await pool.query(`INSERT INTO show_formats (id, name, status, proposal, data, approved_at) VALUES ($1,$2,'approved','{}',$3,now())`, [FORMAT_ID, stored.name, JSON.stringify(stored)]);
  await pool.query(`INSERT INTO shows (slug, name, castaway_term, tribe_term, format) VALUES ($1,'zt Rulebook Show','Castaway','Tribe',$2)`, [SHOW_SLUG, FORMAT_ID]);
  const seasons = {};
  for (const [slug] of SHOWS) {
    const { rows } = await pool.query(
      `INSERT INTO show_seasons (show_id, season_number, name, status, episode_count) SELECT id, $2, $3, 'airing', $4 FROM shows WHERE slug=$1 RETURNING id`,
      [slug, SEASON, SEASON_NAME, EPISODES]
    );
    seasons[slug] = rows[0].id;
  }
  // Frozen, as every built-in season was before S2.
  for (const [slug, formatId] of SHOWS.filter(([, f]) => Formats.isBuiltInFormat(f))) {
    const source = await R.sourceFor(pool, formatId);
    // The library's template as it stands (the app and the backfill keep it current), made only when there's none.
    const { rows: had } = await pool.query("SELECT id, version FROM rulebooks WHERE owner_kind='library' AND parent_kind='builtin' AND parent_id=$1", [formatId]);
    const template = had[0] || (await R.ensureTemplate(pool, source)).row;
    const frozen = await R.createRulebook(pool, {
      ...R.legacyFields(source), name: SEASON_NAME, ownerKind: "season", seasonId: seasons[slug], isTemplate: false, status: "in_force",
      reviewStatus: "approved", parentKind: "rulebook", parentId: template.id, parentVersion: template.version, phaseStarts: {},
    });
    await pool.query(`UPDATE show_seasons SET rulebook_id=$1 WHERE id=$2`, [frozen.id, seasons[slug]]);
  }
  const fresh = {};
  for (const [slug] of FRESH_SHOWS) {
    const { rows } = await pool.query(
      `INSERT INTO show_seasons (show_id, season_number, name, status, episode_count) SELECT id, $2, $3, 'airing', $4 FROM shows WHERE slug=$1 RETURNING id`,
      [slug, FRESH, SEASON_NAME, EPISODES]
    );
    fresh[slug] = rows[0].id;
  }
  const { rows: ch } = await pool.query(
    `INSERT INTO season_rule_changes (season_id, status, effective_episode, checked_through, summary, proposal, delta, base_format, approved_at)
     VALUES ($1,'approved',$2,$2,$3,'{}',$4,'survivor',now()) RETURNING id, version`,
    [seasons.survivor, CHANGE.effectiveEpisode, CHANGE.summary, JSON.stringify(CHANGE.delta)]
  );
  const change = { id: ch[0].id, version: ch[0].version, effectiveEpisode: CHANGE.effectiveEpisode, summary: CHANGE.summary, delta: CHANGE.delta };

  const leagues = [];
  const add = async (slug, name, state, meta) => leagues.push({ slug, leagueId: await insertLeague(pool, slug, name, state), ...meta });
  const placed = (state, show, formatId, season = SEASON) => {
    state.settings.showId = show;
    state.settings.wikiSeason = season;
    state.settings.showFormat = formatId;
    if (formatId === FORMAT_ID) state.settings.showFormatData = stored;
    if (show === "survivor") state.settings.seasonRuleChanges = [change];
    return state;
  };
  for (let c = 1; c <= copies; c++) {
    for (const [show, formatId] of SHOWS) {
      for (const type of TYPES) {
        const slug = `zt-rb-${show === SHOW_SLUG ? "stored" : formatId}-${type}${copies > 1 ? `-${c}` : ""}`;
        await add(slug, `zt ${formatId} ${type}`, placed(demoState(formatId, type), show, formatId), { kind: "season", show, type });
      }
    }
  }
  const own = placed(demoState("survivor", "active-roster"), "survivor", "survivor");
  own.settings.leagueRulesetData = ownData();
  const ownId = await insertLeague(pool, "zt-rb-own", "zt own copy", own);
  const { rows: rs } = await pool.query(
    `INSERT INTO league_rulesets (league_id, name, data, parent_kind, parent_id) VALUES ($1,'Our Survivor',$2,'builtin','survivor') RETURNING id`,
    [ownId, JSON.stringify(own.settings.leagueRulesetData)]
  );
  await pool.query(`UPDATE leagues SET ruleset_id=$1 WHERE id=$2`, [rs[0].id, ownId]);
  leagues.push({ slug: "zt-rb-own", leagueId: ownId, kind: "own", show: "survivor", type: "active-roster", rulesetId: rs[0].id });

  const adopted = placed(demoState("survivor", "active-roster"), "survivor", "survivor");
  adopted.settings.adoptedRuleChanges = [change];
  const first = adopted.castaways[adopted.castaways.length - 1].id; // the winner, there every episode
  for (const ep of adopted.episodes) if (ep.number >= CHANGE.effectiveEpisode) ep.scoringEvents.push({ id: `zt_bonus_${ep.number}`, type: "ztBonus", castawayId: first });
  await add("zt-rb-adopted", "zt adopted change", adopted, { kind: "adopted", show: "survivor", type: "active-roster" });

  const legacy = placed(demoState("survivor", "active-roster"), "survivor", "survivor");
  delete legacy.settings.showFormat;
  await add("zt-rb-legacy", "zt before formats", legacy, { kind: "legacy", show: "survivor", type: "active-roster" });
  await add("zt-rb-stale", "zt stale cache", placed(demoState("survivor", "active-roster"), "survivor", "traitors"), { kind: "stale", show: "survivor", type: "active-roster" });
  await add("zt-rb-noseason", "zt no season", placed(demoState("survivor", "active-roster"), "survivor", "survivor", 9994), { kind: "noseason", show: "survivor", type: "active-roster" });
  for (const [show, formatId] of FRESH_SHOWS) {
    const s = demoState(formatId, "active-roster");
    Object.assign(s.settings, { showId: show, wikiSeason: FRESH, showFormat: formatId });
    await add(`zt-rb-fresh-${formatId}`, `zt fresh ${formatId}`, s, { kind: "fresh", show, type: "active-roster" });
  }
  return { seasons, fresh, leagues, change, formatId: FORMAT_ID, showSlug: SHOW_SLUG };
}

if (require.main === module) {
  const url = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) throw new Error("rulebook-fixture runs against a local database only");
  const pool = new Pool({ connectionString: url });
  const [cmd] = process.argv.slice(2);
  const copies = Number((process.argv.find((a) => a.startsWith("--copies=")) || "=1").split("=")[1]) || 1;
  const go = {
    up: (p) => up(p, { copies }).then((r) => console.log(`[zt] up: ${r.leagues.length} leagues on 6 zt-rulebooks seasons`)),
    down: (p) => down(p).then(() => console.log("[zt] down")),
  }[cmd];
  (go ? go(pool) : Promise.reject(new Error("usage: up [--copies=N] | down")))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { up, down, SEASON, FRESH, SEASON_NAME, FORMAT_ID, SHOW_SLUG, storedData, ownData };
