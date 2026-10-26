// The library's shapes (docs/PLAN-new-design.md step 10 part 3; PLAN-admin-shows-rulebooks.md "Templates: room to grow, and
// worth it"; PLAN-rulebooks-implementation.md 7.9). A template is a finished rulebook new shows start from: the rulebook
// prompt sends the nearest one as a skeleton, so the chat corrects a shape instead of inventing one. Each template earns its
// place: "add a template when two real shows share its shape". The shapes the design plan proposes are listed here, each
// with what makes a rulebook that shape; the desk's library shows them dashed ("Proposed") until two real shows here fit
// one, and then offers to save one of those shows' rulebooks as the template (named for the shape, its examples kept so a
// show like them finds it).
//
// Also how a show's name is matched to a template (`familyOf`, `sameFamily`): "The Amazing Race (American edition)" and
// "The Amazing Race Canada" are one family, "Below Deck" and "Below Deck Mediterranean" too. Pure, plain CommonJS like
// everything in formats/.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./index.js */
const { kindOf } = require('./rulebook-schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const list = (v) => (Array.isArray(v) ? v : []);
const segs = (b) => list(b.segments).filter((s) => s && typeof s === 'object');
const ways = (b) => list(b.waysOut).filter((w) => w && typeof w === 'object');

/** A segment that sends someone home: it says so, or a way out names it as the cause. */
const sendsHome = (b, s) => s.onTheLine === 'goingHome' || ways(b).some((w) => w.means === 'out' && w.cause && typeof w.cause === 'object' && w.cause.segment === s.id);

const viewersVote = (b) =>
  list(b.season && b.season.phases).some((p) => p && list(p.changes).includes('viewersVote')) ||
  (b.season && b.season.finale && b.season.finale.decidedBy === 'viewersVote') ||
  segs(b).some((s) => s.decidedBy === 'vote' && s.voters === 'viewers');

/**
 * The proposed shapes, by kind (the design plan's table): { id, kind, name, like (the shows it's for), line (how it plays),
 * fits(blocks) }. `fits` reads the blocks only, so it's the same for a season's rulebook and the library's.
 */
const SHAPES = [
  {
    id: 'brackets',
    kind: 'competition',
    name: 'Brackets and duels',
    like: ['The Floor', 'Physical: 100', 'The Ultimate Fighter'],
    line: 'Two face off every episode, and one goes home',
    fits: (b) => segs(b).some((s) => s.decidedBy === 'headToHead' && s.often === 'everyEpisode' && sendsHome(b, s)) && !segs(b).some((s) => s.decidedBy === 'vote' && s.often === 'everyEpisode' && sendsHome(b, s)),
  },
  {
    id: 'auditions',
    kind: 'competition',
    name: 'Auditions to live shows',
    like: ['The Voice', "America's Got Talent", 'American Idol'],
    line: 'Judges or coaches pick, then viewers vote',
    fits: (b) => viewersVote(b) && segs(b).some((s) => s.decidedBy === 'pick' || s.decidedBy === 'judges'),
  },
  {
    id: 'gameShow',
    kind: 'competition',
    name: 'Game show',
    like: ['Jeopardy!', 'Wheel of Fortune'],
    line: 'New contestants most episodes; one night at a time',
    fits: (b) => !(b.cast && b.cast.groups) && !ways(b).some((w) => w.means === 'winner') && (!b.season || !b.season.finale || ['mostPoints', 'nobody'].includes(b.season.finale.decidedBy)),
  },
  {
    id: 'docuseries',
    kind: 'series',
    name: 'Docuseries',
    like: ['Drive to Survive', 'Selling Sunset'],
    line: 'A real world followed through a season; nothing contested',
    fits: (b) => b.start !== 'scripted' && !(b.cast && b.cast.groups) && list(b.season && b.season.phases).length <= 1 && segs(b).length > 0 && segs(b).every((s) => s.decidedBy === 'nobody'),
  },
  {
    id: 'awards',
    kind: 'talk',
    name: 'Awards night',
    like: ['The Oscars', 'The Emmys', 'The Grammys'],
    line: 'One night of categories, each with a winner',
    fits: (b) => segs(b).some((s) => (s.decidedBy === 'vote' || s.decidedBy === 'judges') && s.decides === 'winner'),
  },
  {
    id: 'playoffs',
    kind: 'sport',
    name: 'Season and playoffs',
    like: ['NFL', 'NBA', 'NHL'],
    line: 'A regular season, then the playoffs',
    fits: (b) => list(b.season && b.season.phases).length >= 2,
  },
  {
    id: 'bracket',
    kind: 'sport',
    name: 'Tournament bracket',
    like: ['March Madness', 'The World Cup', 'Wimbledon'],
    line: 'Knockout rounds until one is left',
    fits: (b) => segs(b).some((s) => s.decidedBy === 'headToHead') && segs(b).some((s) => sendsHome(b, s)),
  },
  {
    id: 'race',
    kind: 'sport',
    name: 'Race series',
    like: ['Formula 1', 'NASCAR', 'IndyCar', 'MotoGP'],
    line: 'Everyone races every event; the order scores',
    fits: (b) => segs(b).some((s) => s.decidedBy === 'result' && s.decides === 'fullOrder' && s.often === 'everyEpisode'),
  },
];

/** The shapes a rulebook is, of its own kind: [shape id]. */
function shapesOf(blocks) {
  const b = blocks || {};
  const kind = kindOf(b);
  return SHAPES.filter((s) => s.kind === kind && s.fits(b)).map((s) => s.id);
}

const shapeById = (id) => SHAPES.find((s) => s.id === id) || null;

// A show's family: its name without a country, an edition or a leading "The".
const TRAILING = /\s+(us|usa|uk|australia|canada|nz|new zealand|au|south africa|ireland|india|philippines|vip|all stars|all-stars|\d{4})$/;

/** "The Amazing Race (American edition)" -> "amazing race"; "Love Island USA" -> "love island"; "RuPaul's Drag Race UK" -> "rupauls drag race". */
function familyOf(name) {
  let s = String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9:!& -]+/g, ' ')
    .replace(/[:!&-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/^the\s+/, '');
  for (let i = 0; i < 3 && TRAILING.test(s); i++) s = s.replace(TRAILING, '').trim();
  return s;
}

/**
 * Whether two shows are one family: the same family, or one's the start of the other's in whole words ("below deck" and
 * "below deck mediterranean"), as long as the shorter says enough (two words, or one of six letters or more).
 */
function sameFamily(a, b) {
  const x = familyOf(a);
  const y = familyOf(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (!long.startsWith(`${short} `)) return false;
  return short.includes(' ') || short.length >= 6;
}

module.exports = { SHAPES, shapesOf, shapeById, familyOf, sameFamily };
