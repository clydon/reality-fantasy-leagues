// Dev-only check of team defenses on an NFL slate (docs/PLAN-sports-ready.md, Phase 0 (a), then Phase 1.3's fix). The NFL's default
// lineup has a DEF slot (src/lib/sports/defaults/football.json: one "DEF", taking DEF), and every final scores each side's defense
// and special teams as one line, person `def:<team>` ("<Team> D/ST", football.ts defenseId). But a slate's people come from the
// teams' rosters (cast.ts rosterFromEvents), which list players only: is there anyone for those lines, or that slot?
//
// On nfl-slate-fixture.js (the recorded NFL season through the stand-in ESPN, the clock an hour before the week's first game):
//   the slate's people     after the fill, anyone who is a team defense (an ESPN id def:<team>, position DEF, or "D/ST" in the name)
//   the week's finals      the week played (the clock on a day at a time, the daily job each morning), each final's people: both
//                          sides' D/ST lines are there (the reader works), and whether each belongs to someone in the season
//   a league's DEF slot    the default season game (POST /api/sports/start's "season") started with the season's people approved
//                          (as the desk's Approve leaves them: without it no game started on a slate gets anyone, see
//                          check-sports-new-players.js), its people's position groups as the game reads them (score.ts leagueGames),
//                          and how many can play its DEF slot
// What's asserted is where Phase 1.3 leaves it: all 32 defenses are people of the slate, each final's D/ST lines belong to them, and
// a league has 32 to put in its DEF slot. On 2026-11-19 it fails all three (none of them; Phase 0 confirmed the inference): the D/ST
// lines are scored and belong to nobody, and nobody can fill the slot. Its last lines say which.
// Also asserted, noticed in Phase 0 (BACKLOG 221): the QB slot takes the slate's quarterbacks. It fails today: positions are stamped
// as ESPN's roster names them ("Quarterback") and football's slots take its abbreviations ("QB"), so nobody fits any slot.
// The stand-in's box scores are the recording's tables without their totals, so a D/ST line here is its game alone (DSTG): enough
// to say whose it is, not what it scored.
//
//   node scripts/dev-test/check-nfl-defenses.js [--week=9] [--keep]
//
// --week: a week the recording has played (the 2026-11-15 recording's are 1 to 9). Needs the local database and the NFL recording
// (see nfl-slate-fixture.js); no app server, never the real ESPN. Its rows are the fixture's (--keep leaves them; the next run removes
// them first). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
const TEAMS = 32;
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);

(async () => {
  const week = fx.weeksOf(fx.recording().input).find((w) => w.n === WEEK);
  if (!week || !week.games.length || week.games.some((g) => g.state !== "post" || !g.box)) throw new Error(`--week=${WEEK} isn't a week the recording has played`);
  const w = await fx.up({ at: new Date(Date.parse(week.first) - 3600_000).toISOString() });
  try {
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const StateLogic = fx.app("../../src/lib/game/state-logic.js");
    const isDefense = (r) => /^def:/.test(r.provider_ids?.espn ?? "") || r.role === "DEF" || /team defense/i.test(r.role ?? "") || /D\/ST$/.test(r.name);

    // The week played, its finals kept as production keeps them (and the people of every team its games link by then).
    const errors = await w.days(new Date(Date.parse(week.last) + 8 * 3600_000).toISOString());
    const { rows: people } = await w.pool.query("SELECT name, tribe_name, role, provider_ids FROM season_cast WHERE season_id = $1", [w.seasonId]);
    const teams = new Set(people.map((p) => p.tribe_name));
    const defenses = people.filter(isDefense);
    fact(`the slate's people: ${people.length} on ${teams.size} teams, ${[...new Set(people.map((p) => p.role))].length} positions (${[...new Set(people.map((p) => p.role))].slice(0, 6).join(", ")}...)`);
    check(defenses.length === TEAMS && new Set(defenses.map((d) => d.tribe_name)).size === TEAMS, `the slate's people hold all ${TEAMS} team defenses (${defenses.length})`, defenses.slice(0, 3));
    const { rows: finals } = await w.pool.query(
      `SELECT f.event_id, f.teams, f.people, f.lines FROM season_events e JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
        WHERE e.season_id = $1 AND e.episode = $2 AND f.final AND f.lines IS NOT NULL`,
      [w.seasonId, WEEK]
    );
    check(finals.length === week.games.length, `${week.label}'s finals kept (${finals.length} of ${week.games.length}; errors ${errors.length})`, errors);
    const dst = finals.flatMap((f) => Object.keys(f.lines ?? {}).filter((id) => id.startsWith("def:")).map((id) => ({ id, event: f.event_id, line: f.lines[id] })));
    check(dst.length === 2 * finals.length, `each final scores both sides' D/ST as a line of its own (${dst.length} lines for ${finals.length} games)`, dst.slice(0, 2));
    const ids = new Set(people.flatMap((p) => Object.entries(p.provider_ids ?? {}).map(([k, v]) => `${k}:${v}`)));
    const owned = dst.filter((d) => ids.has(`espn:${d.id}`));
    const sample = dst.find((d) => Object.keys(d.line ?? {}).length);
    if (sample) fact(`e.g. ${sample.id} in ${sample.event}: ${JSON.stringify(sample.line)}`);
    check(owned.length === dst.length, `every D/ST line belongs to someone in the season's people (${owned.length} of ${dst.length})`);

    // The default season game, with the season's people approved, and its DEF slot.
    await w.approveCast();
    const started = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    // Read as the league's poll reads it (league-read.ts readyLeague: air times, the stats' position groups, cast properties), its
    // slots as the engine fills them (SlotLogic: a slot takes someone whose position is one of its values).
    const state = await readyLeague(started.leagueId, await w.league(started.leagueId));
    const slots = StateLogic.SlotLogic.expanded(state);
    fact(`the season game: ${state.castaways.length} people; its lineup ${slots.map((s) => s.label).join(", ")}`);
    const defSlot = slots.find((s) => s.values.includes("DEF"));
    check(!!defSlot, "the default season game's lineup has a DEF slot", slots);
    const fitting = (slot) => state.castaways.filter((c) => StateLogic.SlotLogic.fits(state, c.id, slot)).length;
    const def = defSlot ? fitting(defSlot) : 0;
    check(def >= TEAMS, `the season game has ${TEAMS} people who can play its DEF slot (${def})`);
    // Noticed in Phase 0 (BACKLOG 221): the control, the QB slot, against the slate's quarterbacks. A person's position is stamped
    // from their roster's role (cast-props.ts), which ESPN's roster gives as a name ("Quarterback": espn.ts readPerson), while
    // football's slots take ESPN's abbreviations (defaults/football.json: "QB"), so nobody fits any slot and every lineup is refused.
    const qbSlot = slots.find((s) => s.label === "QB");
    const qbs = state.castaways.filter((c) => /^(QB|Quarterback)$/.test(state.castProps?.[c.id]?.position ?? "")).length;
    const qbFit = qbSlot ? fitting(qbSlot) : 0;
    const positions = [...new Set(Object.values(state.castProps ?? {}).map((p) => p.position))].slice(0, 4);
    fact(`positions as stamped: ${positions.join(", ")}...; the slots take ${slots.map((s) => s.values.join("/")).join(", ")}`);
    check(qbFit === qbs && qbs > 0, `(BACKLOG 221) the QB slot takes the slate's ${qbs} quarterbacks (${qbFit})`);
    // And a lineup a fan would set (a quarterback, three receivers, two running backs, a tight end and a kicker; the DEF slot left
    // empty, nobody can fill it), as if drafted, checked by the engine's own lineup rule (ActiveRosterLogic.validateLineup, what the
    // lineup route asks) on a copy: nothing saved.
    const copy = structuredClone(state);
    const seat = copy.players[0].id;
    const of = (role, n) => copy.castaways.filter((c) => copy.castProps?.[c.id]?.position === role).slice(0, n).map((c) => c.id);
    const picks = [...of("Quarterback", 1), ...of("Wide Receiver", 3), ...of("Running Back", 2), ...of("Tight End", 1), ...of("Place Kicker", 1)];
    for (const c of copy.castaways) if (picks.includes(c.id)) c.ownerIds = [seat];
    StateLogic.ensureEpisodeNumber(copy, started.from, false);
    const ep = copy.episodes.find((e) => e.number === started.from);
    const problem = ep ? StateLogic.ActiveRosterLogic.validateLineup(copy, ep.id, seat, picks, Date.now()) : "no episode";
    fact(`a lineup of ${picks.length} (QB, 3 WR, 2 RB, TE, K) for ${ep ? `episode ${ep.number}` : "?"}: ${problem ?? "accepted"}`);
    check(problem === null, "(BACKLOG 221) the engine accepts a lineup of real players in their slots", problem);
    console.log(
      defenses.length === 0
        ? "VERDICT (a): CONFIRMED: an NFL slate has no team defenses: the finals' D/ST lines belong to nobody and the DEF slot has nobody to fill it"
        : defenses.length === TEAMS
          ? "VERDICT (a): STRUCK: the slate's people hold every team defense"
          : `VERDICT (a): PARTLY: ${defenses.length} of ${TEAMS} defenses`
    );
    if (qbFit === 0 && qbs > 0) console.log("NOTICED (BACKLOG 221): nobody fits any of football's slots (positions are ESPN's names, the slots its abbreviations): every NFL lineup is refused");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
