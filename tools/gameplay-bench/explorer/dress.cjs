// The bench's real dress (the user, 2026-11-15: "so I can see what a real game would look like"): a definition's generated people
// swapped for real ones, so a design round's situations can be judged on a real game. Only who they are changes: a show's cast
// takes a real season's castaways (their names and photos: scripts/dev-test/real-dress.js), an NFL pool real athletes (their names
// and ESPN headshots, each in the position the world dealt: sports-roster.cjs on the ESPN recording). Everything the world does with
// them (who scores, who goes home, the steps a situation plays) is the bench's as before, and each participant keeps the id the
// world would have generated (runtime-data.cjs contextData), so a situation's steps read the same.
//
//   const Dress = require('./dress.cjs');
//   Dress.apply(definition, 'real')      // a copy, dressed where a recording exists; the rest left as generated
//
// The context also carries `dress` ({ name, seasonName, number, art }), which live-db.cjs reads when it writes the case: the show's
// real name and season, and its art (fixture-art.js: borrowed from the local database's real show, or the project's own generated
// art for a sport). Recordings live in the ignored .ui-atlas/fixtures/ (real people stay out of the public repo); without one a
// context stays generated and `missing` says which.
const fs = require('fs');
const path = require('path');
const J = require('./json.cjs');

const REAL = path.resolve(__dirname, '../../../.ui-atlas/fixtures/real');
// Which recording dresses which context: a show's format, a sport's league.
const SHOWS = { survivor: { file: 'survivor-51.json', slug: 'survivor' } };
const SPORTS = { 'football/nfl': { name: 'NFL', art: 'football' } };

const idOf = (context, i) => context.id + '-participant-' + (i + 1);

function showCast(file) {
  const f = path.join(REAL, file);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

/** A show context's participants from a real season, or null without its recording. */
function dressShow(context) {
  const which = SHOWS[context.format?.id || 'survivor'];
  const rec = which && showCast(which.file);
  if (!rec) return null;
  const count = context.engine.pool || 18;
  if (count > rec.cast.length) return null;
  const participants = rec.cast.slice(0, count).map((c, i) => ({ id: idOf(context, i), contextId: context.id, name: c.name, photoUrl: c.photoUrl || null }));
  return { participants, dress: { name: rec.show.name, seasonName: rec.season.name, number: rec.season.number, art: { borrow: which.slug } } };
}

/** A sport context's participants: real athletes, each in the position the world deals that seat. */
function dressSport(context) {
  const league = context.key;
  const sport = SPORTS[league];
  if (!sport) return null;
  const Roster = require('./sports-roster.cjs'), Sports = require('./runtime-sports.cjs');
  let snap;
  try { snap = Roster.load(league); } catch { return null; }
  const count = context.engine.pool || 18;
  const seats = Array.from({ length: count }, (_, i) => ({ id: idOf(context, i), contextId: context.id, name: 'x' }));
  Sports.assignRoles(context, seats);
  const byRole = new Map();
  for (const a of Roster.pool(snap).athletes) byRole.set(a.role, [...(byRole.get(a.role) || []), a]);
  const taken = new Map();
  const participants = seats.map(p => {
    const list = byRole.get(p.role) || [], k = taken.get(p.role) || 0;
    taken.set(p.role, k + 1);
    const a = list[k];
    return a ? { id: p.id, contextId: context.id, name: a.name, photoUrl: a.headshot || null, role: p.role } : { id: p.id, contextId: context.id, name: p.role + ' ' + (k + 1), photoUrl: null, role: p.role };
  });
  return { participants, dress: { name: sport.name, seasonName: String(snap.events?.[0]?.season || ''), art: { generated: sport.art } } };
}

/** The definition dressed (a copy); `missing` lists the contexts left generated, with why. */
function apply(definition, kind = 'real') {
  if (kind !== 'real') throw Error("A dress is 'real' (a real season's people) or none");
  const d = J.clone(definition), missing = [];
  d.world.participants = d.world.participants || [];
  for (const context of d.world.contexts) {
    if (d.world.participants.some(p => p.contextId === context.id)) continue; // the definition named its own people
    const got = context.kind === 'sport' ? dressSport(context) : dressShow(context);
    if (!got) { missing.push(context.id + ' (' + (context.kind === 'sport' ? context.key : context.format?.id || 'show') + ': no recording)'); continue; }
    d.world.participants.push(...got.participants);
    context.dress = got.dress;
  }
  return { definition: d, missing };
}

module.exports = { apply };
