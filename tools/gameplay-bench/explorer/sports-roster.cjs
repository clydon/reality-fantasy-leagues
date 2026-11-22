// Real athletes for the bench's sports worlds: a league's recorded season (scripts/dev-test/espn-snapshot.js, in
// .ui-atlas/fixtures/espn/, kept out of git) read as a draftable pool of real people, with their names, positions, teams and
// ESPN headshots, ranked by what they did in the recorded box scores. The seam for runtime-sports.cjs's real-size pool
// (`athletes: 'real'`, core-runtime-41): a world can take these as its participants (name, role, team) instead of generated ones.
//
//   const Roster = require('./sports-roster.cjs');
//   const snap = Roster.load('football/nfl');                  // the newest recording, or { file }
//   const { athletes } = Roster.pool(snap);                    // 344 by the bench's NFL shares, best first
//   Roster.pool(snap, { shares: { QB: 12, WR: 24 } });          // any shares by position key
//
// Each athlete: { id (ESPN's, or def:<team> for a team defense, as src/lib/sports/football.ts defenseId), name (distinct within
// the pool: a shared name takes its team's abbreviation), role (the app's position key: QB, RB, WR, TE, PK, DEF), position
// (ESPN's words), team, teamName, teamAbbr, headshot (photoUrl too: the name runtime-data.cjs and live-db.cjs read a participant's
// photo by), status, games, value }. `value` is a ranking measure only (yards, touchdowns,
// catches and kicks weighted roughly as fantasy scoring does), not points any game scores.
//
// Only football is mapped so far (its roles, its box tables). Practice squads are left out unless `practiceSquad: true`; injured
// players stay in, marked by `status`, as a real draft pool keeps them.
const fs = require('fs');
const path = require('path');
// A team defense's picture is the app's badge for its team, never the league's logo (docs/PLAN-team-logos.md L0).
const { teamBadgeSrc } = require('jiti')(__filename, { alias: { '@': path.resolve(__dirname, '../../../src') } })('../../../src/lib/sports/team-badge.ts');

const DIR = path.resolve(__dirname, '../../../.ui-atlas/fixtures/espn');
// The bench's real-size NFL pool (runtime-sports.cjs REAL.football): 344, its defenses and kickers one a team.
const SHARES = { 'football/nfl': { QB: 40, RB: 80, WR: 110, TE: 50, PK: 32, DEF: 32 } };
// ESPN's position abbreviations to the app's keys (src/lib/sports/football.ts positions).
const ROLE = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', PK: 'PK', K: 'PK' };

/** The newest recording of a league (or `file`), parsed. */
function load(league = 'football/nfl', { file } = {}) {
  let f = file;
  if (!f) {
    const prefix = league.replace('/', '-') + '-';
    const found = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(x => x.startsWith(prefix) && x.endsWith('.json')).sort() : [];
    if (!found.length) throw Error('No recording of ' + league + ' in ' + DIR + ': run node scripts/dev-test/espn-snapshot.js record --league=' + league);
    f = path.join(DIR, found[found.length - 1]);
  }
  const snap = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (snap.schemaVersion !== 1 || !Array.isArray(snap.teams) || !Array.isArray(snap.events)) throw Error('Not an espn-snapshot recording: ' + f);
  return snap;
}

const num = v => { const n = Number(String(v).split('/')[0].split('-')[0]); return Number.isFinite(n) ? n : 0; };
const col = (table, label) => table.labels.indexOf(label);

/** Each athlete's games and ranking value from the recording's box scores; each team's defense's too (sacks and takeaways). */
function production(snap) {
  const out = {};
  const add = (id, k, v) => { const p = (out[id] ||= { games: new Set(), value: 0 }); p.value += v; if (k) p.games.add(k); };
  for (const e of snap.events) {
    if (!e.box) continue;
    for (const [team, side] of Object.entries(e.box)) {
      for (const t of side.tables || []) {
        const at = l => col(t, l);
        for (const r of t.rows || []) {
          const s = l => (at(l) >= 0 ? num(r.stats[at(l)]) : 0);
          let v = 0;
          if (t.name === 'passing') v = s('YDS') * 0.04 + s('TD') * 4 - s('INT') * 2;
          else if (t.name === 'rushing') v = s('YDS') * 0.1 + s('TD') * 6;
          else if (t.name === 'receiving') v = s('REC') * 0.5 + s('YDS') * 0.1 + s('TD') * 6;
          else if (t.name === 'kicking') v = s('FG') * 3 + s('XP');
          else if (t.name === 'defensive') { add('def:' + team, null, s('SACKS')); continue; }
          else if (t.name === 'interceptions') { add('def:' + team, null, s('INT') * 2); continue; }
          else continue;
          add(r.id, e.id, v);
        }
      }
      add('def:' + team, e.id, 0);
    }
  }
  return Object.fromEntries(Object.entries(out).map(([id, p]) => [id, { games: p.games.size, value: Math.round(p.value * 10) / 10 }]));
}

/** A draftable pool of real athletes by shares (the bench's for the league unless given), best first. */
function pool(snap, { shares, practiceSquad = false } = {}) {
  const want = shares || SHARES[snap.league];
  if (!want) throw Error('No shares for ' + snap.league + ': pass { shares: { QB: 40, ... } }');
  if (!snap.league.startsWith('football/')) throw Error('Only football is mapped so far (its roles and box tables): ' + snap.league);
  const made = production(snap);
  const byRole = {};
  for (const t of snap.teams) {
    for (const p of t.roster) {
      const role = ROLE[p.abbr];
      if (!role || !want[role]) continue;
      if (!practiceSquad && p.status === 'practice-squad') continue;
      const m = made[p.id] || { games: 0, value: 0 };
      (byRole[role] ||= []).push({ id: p.id, name: p.name, role, position: p.position, team: t.id, teamName: t.name, teamAbbr: t.abbreviation, headshot: p.headshot, photoUrl: p.headshot, status: p.status, games: m.games, value: m.value });
    }
    if (want.DEF) {
      const m = made['def:' + t.id] || { games: 0, value: 0 };
      (byRole.DEF ||= []).push({ id: 'def:' + t.id, name: t.name + ' D/ST', role: 'DEF', position: 'Team defense', team: t.id, teamName: t.name, teamAbbr: t.abbreviation, headshot: teamBadgeSrc(t.abbreviation, t.color, t.name), photoUrl: teamBadgeSrc(t.abbreviation, t.color, t.name), status: 'active', games: m.games, value: m.value });
    }
  }
  const athletes = [];
  for (const [role, n] of Object.entries(want)) {
    const list = (byRole[role] || []).sort((a, b) => b.value - a.value || b.games - a.games || a.name.localeCompare(b.name));
    if (list.length < n) throw Error('The recording has ' + list.length + ' ' + role + ' for a share of ' + n);
    athletes.push(...list.slice(0, n));
  }
  // A name the server can tell apart (score.ts finds a kept line's person by name): a shared one takes its team's abbreviation.
  const seen = {};
  for (const a of athletes) seen[a.name] = (seen[a.name] || 0) + 1;
  for (const a of athletes) if (seen[a.name] > 1) a.name = a.name + ' (' + a.teamAbbr + ')';
  athletes.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return { league: snap.league, season: snap.calendars?.[snap.league]?.season ?? null, recordedAt: snap.recordedAt, size: athletes.length, athletes };
}

module.exports = { load, pool, production, SHARES, ROLE, DIR };
