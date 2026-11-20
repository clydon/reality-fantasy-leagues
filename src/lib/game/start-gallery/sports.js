// Start a game's gallery, sports (docs/PLAN-start-a-game-redo.md Round 2): the game types a sport's fans already know
// (sports.json), each with our check's verdict on the sport's page, for the gallery's screens. Pure CommonJS like index.js, so the
// sheet bundles it and node scripts require it as it is; index.js can re-export it (it requires index.js only when first asked,
// never at load, so the two never require each other half-built). scripts/dev-test/sport-gallery-check.js checks every base.
//
//   SPORT_FAMILIES, SPORT_PAGES, SPORT_CATS, SPORT_BASES   the catalog: nine families, four pages, the categories, the bases
//   familyOf(league)               "football/nfl" is football; null for a league no family has
//   pageKindOf(page)               which page a sport's season is: slate | playoffs | game | event (below)
//   sportStandard(family, league)  the sport's standard games as defaultsFor gives them (src/lib/sports/index.ts)
//   sportBase(base, league)        a base as it reads on a league: its family's and league's words, spec or coming over its own
//   sportSpec(base, league, span)  its engine spec on a span (null: coming, or none here)
//   sportGallery(page, o)          every base of the page's sport on this page: plays, off (our check's why), coming, needs
//
// A page is a sport's season, which the wizard's read (GET /api/seasons/[id]/start?wizard=1: wizard.page, { ctx, pack }) gives, or
// a bare ctx (sports/page.ts sportPageContext), or PageFacts (index.js pageFacts). Which page it is:
//   slate     a league's season, several games an episode (a week, a day or a round): its pack's games share an episode, or its
//             part is a week, a day or a round
//   playoffs  a league's playoffs slate (its ctx's draws are the playoffs': specContextOf's `playoffs`)
//   game      a team's games, one an episode (one game, a series, a rivalry, a team's season: a matchup)
//   event     a field's or a card's season, an event an episode (golf, racing, MMA, tennis)
// A base is made for some of them (`on`): our check can't tell a slate from a game an episode, but the grader can (the server keeps a
// slate's week as its games one by one, score.ts leagueGames: only a question about each game, each: 'game', reads them; a lone
// final or stat question there never settles, and squares never pay), so a slate's questions ask about each game.
//
// A base's `spec` is a whole spec or { standard, with }: one of the sport's standard games (src/lib/sports/defaults: a league's own
// over the sport's, football's lineup slots as defaultsFor gives them) with `with`'s parts over it one level deep, so a guillotine
// is the standard season with its rank. Its span comes from its length on the page: one episode ("1 game", "This week", a len in
// sports.json's `one`), else from the page's next to the end. A draft is fitted to who's left as the show gallery's are
// (index.js baseSpec: an exclusive draft too big for the pool fits each one to it, else it's shared), and its verdict is index.js's
// check, word for word.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ../game-spec/schema.js */
const DATA = require('./sports.json');
const { PLAYOFFS } = require('../sequence/bracket.js');
const DEFAULTS = {
  baseball: require('../../sports/defaults/baseball.json'),
  basketball: require('../../sports/defaults/basketball.json'),
  football: require('../../sports/defaults/football.json'),
  golf: require('../../sports/defaults/golf.json'),
  hockey: require('../../sports/defaults/hockey.json'),
  mma: require('../../sports/defaults/mma.json'),
  racing: require('../../sports/defaults/racing.json'),
  soccer: require('../../sports/defaults/soccer.json'),
  tennis: require('../../sports/defaults/tennis.json'),
};
/** The gallery's own check and page facts (index.js), required when first asked. */
let gallery = null;
const G = () => gallery || (gallery = require('./index.js'));
/* eslint-enable @typescript-eslint/no-require-imports */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

const SPORT_FAMILIES = DATA.families;
const SPORT_PAGES = DATA.pages;
const SPORT_CATS = DATA.cats;
const SPORT_BASES = DATA.bases;
/** The lengths of one episode: a base this long plays from the page's next episode to it. */
const ONE = new Set(DATA.one);
const PAGE_KINDS = SPORT_PAGES.map((p) => p.id);

/** The family a league is ("football/nfl" is football), or null. */
function familyOf(league) {
  const id = String(league || '').split('/')[0];
  return SPORT_FAMILIES.some((f) => f.id === id) ? id : null;
}

/** Which page a sport's season is: slate, playoffs, game or event (the header). `page` the wizard's page ({ ctx, pack }), a ctx or
 *  PageFacts (no pack: its part says). */
function pageKindOf(page) {
  const p = isObj(page) ? page : {};
  const ctx = isObj(p.ctx) ? p.ctx : p;
  if (ctx.shape === 'field' || ctx.shape === 'card') return 'event';
  if (ctx.shape === 'team' && Array.isArray(ctx.draws) && ctx.draws.some((d) => (isObj(d) ? d.key : d) === PLAYOFFS)) return 'playoffs';
  const games = isObj(p.pack) && Array.isArray(p.pack.games) ? p.pack.games : [];
  const seen = new Set();
  for (const g of games) {
    if (!isObj(g)) continue;
    if (seen.has(g.episode)) return 'slate';
    seen.add(g.episode);
  }
  const part = isObj(ctx.part) ? ctx.part.singular : null;
  return part === 'week' || part === 'day' || part === 'round' ? 'slate' : 'game';
}

/**
 * The sport's standard games on a league, { [id]: { about, on, spec } }, as defaultsFor gives them (src/lib/sports/index.ts): a
 * league's own specs over the sport's (racing's F1 and IndyCar, the NBA's bracket), and its lineup slots as each spec's
 * count.slots where it counts exactly the lineup (index.ts withLineupSlots; the check script holds the two the same).
 */
function sportStandard(family, league) {
  const d = DEFAULTS[family];
  if (!d) return {};
  // (A check's stand-in league, "football/zt-nfl-slate", reads as its family's core league, as defaultsFor reads it.)
  const name = league ? String(league).split('/').pop() : null;
  const core = SPORT_FAMILIES.find((f) => f.id === family)?.core;
  const key = name && name.startsWith('zt-') && typeof core === 'string' ? core.split('/').pop() : name;
  const own = key && isObj(d.leagues) ? d.leagues[key] : null;
  const specs = { ...d.specs, ...(own && isObj(own.specs) ? own.specs : {}) };
  const slots = own && isObj(own.slots) ? own.slots : d.slots;
  // Every sport's since step 2.3 (index.ts slotted: not a lineup of one slot taking everyone, golf's golfers).
  const lineup = isObj(slots) && Array.isArray(slots.lineup) && slots.lineup.length > 1 ? slots.lineup : [];
  const total = lineup.reduce((n, s) => n + s.n, 0);
  const out = {};
  for (const [id, x] of Object.entries(specs)) {
    const spec = clone(x.spec);
    const c = spec.count;
    if (lineup.length && isObj(c) && (c.start === total || c.best === total)) {
      spec.count = { ...c, slots: lineup.map((s) => ({ label: s.slot, of: 'position', values: [...s.takes], n: s.n })) };
      // Step 2.4: its IR places on a game with a draft (index.ts withLineupSlots).
      if (isObj(slots.ir) && isObj(spec.get) && spec.get.by === 'draft') spec.get = { ...spec.get, ir: { n: slots.ir.n, takes: [...slots.ir.takes] } };
    }
    out[id] = { about: x.about, on: x.on || null, spec };
  }
  return out;
}

/** `b`'s parts over `a`'s, one level deep (a part that's an object merges; anything else, null and lists, replaces). A ranking
 *  of another kind replaces the standard's whole (BACKLOG 226: Season points on the NFL's season takes none of its final). */
function over(a, b) {
  const out = clone(a);
  for (const [k, v] of Object.entries(b || {})) {
    const other = k === 'rank' && isObj(v) && isObj(out[k]) && v.by !== undefined && v.by !== out[k].by;
    out[k] = isObj(v) && isObj(out[k]) && !other ? { ...out[k], ...clone(v) } : clone(v);
  }
  return out;
}

const baseOf = (base) => (typeof base === 'string' ? SPORT_BASES.find((b) => b.id === base) || null : base);

/** A base as it reads on a league: its family's `by`, then the league's, over its own (words, spec, coming, needs, gap, len). */
function sportBase(base, league) {
  const b = baseOf(base);
  if (!b) return null;
  const by = isObj(b.by) ? b.by : {};
  const family = familyOf(league);
  const out = { ...b, ...(family && isObj(by[family]) ? by[family] : {}), ...(league && isObj(by[league]) ? by[league] : {}) };
  delete out.by;
  // A league's own coming stands for its spec (college's bracket); a spec of its own stands for a coming it doesn't say.
  if (league && isObj(by[league]) && by[league].spec && !by[league].coming) delete out.coming;
  return out;
}

/** A base's length on a page: its own there (`lens`), else its len. */
const lenOn = (b, page) => (isObj(b.lens) && b.lens[page]) || b.len;

/** A base's engine spec on a league (null: coming, or a standard game the league hasn't), its span set when one's given. */
function sportSpec(base, league, span) {
  const b = sportBase(base, league);
  if (!b || b.coming || !isObj(b.spec)) return null;
  let spec;
  if (typeof b.spec.standard === 'string') {
    const std = sportStandard(familyOf(league), league)[b.spec.standard];
    if (!std) return null;
    spec = over(std.spec, b.spec.with);
  } else spec = clone(b.spec);
  if (span) spec.span = { from: span.from, to: span.to === undefined ? null : span.to };
  return spec;
}

/** The page's words: "a league's season". */
const pageWords = (id) => (SPORT_PAGES.find((p) => p.id === id) || { name: id }).name.replace(/^./, (c) => c.toLowerCase());

/**
 * Every base of the page's sport (its league's family; `o.league` when the page doesn't say), each as the gallery shows it, in the
 * catalog's order: { id, cat, name, plain, about, effort, len, on, state, why, gap, needs, short, sentence, rules, type, spec,
 * fitted }. state: plays (its square), off (our check's why), coming (dashed: the step or piece that brings it), needs (dashed: what
 * the page has to give it), elsewhere (made for another page: only with `o.all`). `o.page` names the page (else pageKindOf);
 * `o.extra` goes to pageFacts (lastSeason: the couch's game on last season, which a keeper league needs).
 */
function sportGallery(page, o = {}) {
  const g = G();
  const pg = isObj(page) && isObj(page.ctx) && page.from ? page : g.pageFacts(page, o.extra || {});
  const ctx = pg.ctx || {};
  const league = ctx.league || o.league || null;
  const family = familyOf(league || ctx.sport);
  if (!family) return [];
  const kind = o.page && PAGE_KINDS.includes(o.page) ? o.page : pageKindOf(page);
  const out = [];
  for (const base of SPORT_BASES) {
    if (!base.sports.includes(family) || (Array.isArray(base.leagues) && !base.leagues.includes(league))) continue;
    const b = sportBase(base, league);
    const len = lenOn(b, kind);
    const row = { id: b.id, cat: b.cat, name: b.name, aka: b.aka || [], plain: b.plain, about: b.about, effort: b.effort, len, on: b.on, gap: b.gap || null, needs: b.needs || null, short: null, sentence: null, rules: null, type: null, spec: null, fitted: null };
    if (!b.on.includes(kind)) {
      if (o.all) out.push({ ...row, len: b.len, state: 'elsewhere', why: `Made for ${pageWords(b.on[0])}` });
      continue;
    }
    if (b.coming) {
      out.push({ ...row, state: 'coming', why: `Coming: ${b.coming}` });
      continue;
    }
    let spec = sportSpec(b, league, null);
    if (!spec) {
      out.push({ ...row, state: 'off', why: `${(DEFAULTS[family] && DEFAULTS[family].sport) || family} has no standard ${b.spec && b.spec.standard} game here` });
      continue;
    }
    // A keeper league names the couch's game it continues (the page's last season), else it waits for one.
    if (b.needs) {
      if (!(isObj(spec.get) && isObj(spec.get.keep) && pg.lastSeason)) {
        out.push({ ...row, state: 'needs', why: `Needs ${b.needs}` });
        continue;
      }
      spec.get.keep.from = pg.lastSeason;
    }
    const span = { from: pg.from, to: ONE.has(len) ? pg.from : null };
    spec = g.baseSpec({ spec }, span, pg);
    const v = g.check(spec, pg);
    out.push({ ...row, state: v.ok ? 'plays' : 'off', why: v.ok ? null : v.problems[0] || v.waits[0] || "Our check doesn't place it", short: v.short, sentence: v.sentence, rules: v.rules, type: v.type, spec, fitted: spec.__fitted || null });
  }
  return out;
}

module.exports = { SPORT_FAMILIES, SPORT_PAGES, SPORT_CATS, SPORT_BASES, familyOf, pageKindOf, sportStandard, sportBase, sportSpec, sportGallery };
