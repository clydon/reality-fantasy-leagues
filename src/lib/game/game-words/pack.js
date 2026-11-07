// The context pack for the Start-a-game GPT (docs/PLAN-start-a-game-gpt.md step G1, "The ask"): everything the app knows about
// the page someone types on, as the bot reads it. The server gathers it (src/lib/server/game-words.ts packInput); this shapes it,
// pure, so a test or the bank (tests/fixtures/game-words/) can build one without a database. Only the moments research answers
// can score (the data-can-settle rule), so the couch's-word ones are listed apart, as moments a game can't score.
//
// G3: a sport's page adds its sport (id, name and ESPN's league), its teams, its games (each episode's: when, its sides and
// which is home, whether it's started, and ESPN's line on its total while it's still to play: never a score, so the pack can't
// spoil a game someone hasn't watched), the stats a request can name (each key with its words: the Sport's own) and the sport's
// standard scoring, lineup and games; its people are its players, each with their team (as a group) and position.
//
//   packOf(input) -> the pack (plain JSON, as the prompt embeds it)
//   idsOf(pack)   -> { moments, phases, roles, groups, people, teams, stats }: the ids a draft may name, each a Set
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const int = (v) => (Number.isInteger(v) ? v : null);

/** A moment's points as the pack says them: a number, or exclusive and shared. */
function pointsOf(p) {
  if (typeof p === 'number') return p;
  if (isObj(p) && typeof p.exclusive === 'number' && typeof p.shared === 'number') return p.exclusive === p.shared ? p.exclusive : { exclusive: p.exclusive, shared: p.shared };
  return null;
}

/**
 * The pack from what the server knows. `input`: { label, show, season, kind ('show' | 'sport'), status, today, episodes: { aired,
 * total, next: { number, airs } }, phases: [{ id, name, starts }], castWord: { one, many }, groupWord, cast: [{ id, name, in, out:
 * { episode, how }, group }], ctx (game-spec's SpecContext: moments, roles, results, winner, grouped, jury, votes, trivia), couch:
 * { people, games: [{ name, says }] } }. Everything is optional but the label.
 */
function packOf(input) {
  const i = isObj(input) ? input : {};
  const ctx = isObj(i.ctx) ? i.ctx : {};
  const moments = (Array.isArray(ctx.moments) ? ctx.moments : []).filter((m) => isObj(m) && str(m.id) && !m.off);
  const scored = moments.filter((m) => m.answeredBy !== 'league');
  const couchWord = moments.filter((m) => m.answeredBy === 'league');
  const cast = (Array.isArray(i.cast) ? i.cast : []).filter((c) => isObj(c) && str(c.name));
  const ep = isObj(i.episodes) ? i.episodes : {};
  const next = isObj(ep.next) && int(ep.next.number) ? { number: ep.next.number, ...(str(ep.next.airs) ? { airs: ep.next.airs } : {}) } : null;
  const pack = {
    page: str(i.label) || 'this show',
    ...(str(i.show) ? { show: i.show.trim() } : {}),
    ...(int(i.season) ? { season: i.season } : {}),
    kind: i.kind === 'sport' ? 'sport' : 'show',
    ...(str(i.status) ? { status: i.status } : {}),
    ...(str(i.today) ? { today: i.today } : {}),
    episodes: { aired: int(ep.aired) ?? 0, ...(int(ep.total) ? { total: ep.total } : {}), next },
    phases: (Array.isArray(i.phases) ? i.phases : ctx.phases || [])
      .filter((p) => isObj(p) && str(p.id))
      .map((p) => ({ id: p.id, name: str(p.name) || p.id, ...(int(p.starts) ? { starts: p.starts } : {}) })),
    words: {
      person: (isObj(i.castWord) && str(i.castWord.one)) || ctx.castaway || 'person',
      people: (isObj(i.castWord) && str(i.castWord.many)) || ctx.castaways || 'people',
      ...(str(i.groupWord) || str(ctx.group) ? { group: str(i.groupWord) || str(ctx.group) } : {}),
    },
    cast: cast.map((c) => ({
      ...(str(c.id) ? { id: c.id } : {}),
      name: c.name.trim(),
      in: c.in !== false,
      ...(isObj(c.out) && int(c.out.episode) ? { out: { episode: c.out.episode, ...(str(c.out.how) ? { how: c.out.how } : {}) } } : {}),
      ...(str(c.group) ? { group: c.group } : {}),
      ...(str(c.role) ? { role: c.role.trim() } : {}),
    })),
    ...(int(i.castMore) ? { castMore: i.castMore } : {}),
    stillIn: cast.filter((c) => c.in !== false).length + (int(i.castMore) ?? 0),
    moments: scored.map((m) => ({ id: m.id, says: str(m.label) || m.id, ...(pointsOf(m.defaultPoints) !== null ? { points: pointsOf(m.defaultPoints) } : {}) })),
    ...(couchWord.length ? { couchWordOnly: couchWord.map((m) => ({ id: m.id, says: str(m.label) || m.id })) } : {}),
    roles: Array.isArray(ctx.roles) ? ctx.roles.filter(str) : [],
    knows: {
      whoGoesHome: ctx.results !== false,
      whoWins: ctx.winner !== false,
      groups: ctx.grouped !== false && cast.some((c) => str(c.group)),
      juryVote: ctx.jury === true,
      whoVotedForWhom: ctx.votes === true,
      trivia: ctx.trivia !== false,
    },
    couch: isObj(i.couch)
      ? {
          people: int(i.couch.people) ?? null,
          games: (Array.isArray(i.couch.games) ? i.couch.games : []).filter((g) => isObj(g) && str(g.name)).map((g) => ({ name: g.name, ...(str(g.says) ? { says: g.says } : {}) })),
        }
      : null,
  };
  return i.kind === 'sport' ? sportPack(pack, i) : pack;
}

/** A sport's page: its sport, teams, games, stats and standard game in place of a show's moments, phases and roles. */
function sportPack(pack, i) {
  const sport = isObj(i.sport) && str(i.sport.league) ? { id: str(i.sport.id) || i.sport.league.split('/')[0], ...(str(i.sport.name) ? { name: i.sport.name.trim() } : {}), league: i.sport.league.trim() } : null;
  const side = (x) => (isObj(x) && str(x.id) && str(x.name) ? { id: x.id, name: x.name.trim(), ...(x.home === true ? { home: true } : {}) } : null);
  const games = (Array.isArray(i.games) ? i.games : [])
    .filter((g) => isObj(g) && int(g.episode))
    .map((g) => ({
      episode: g.episode,
      ...(str(g.at) ? { at: g.at } : {}),
      ...(str(g.id) ? { id: g.id } : {}),
      ...(str(g.name) ? { name: g.name.trim() } : {}),
      sides: (Array.isArray(g.sides) ? g.sides : []).map(side).filter(Boolean),
      started: g.started === true,
      ...(typeof g.line === 'number' && Number.isFinite(g.line) && g.started !== true ? { line: g.line } : {}),
      ...(str(g.called) ? { called: g.called } : {}),
    }));
  const teams = new Map();
  for (const t of Array.isArray(i.teams) ? i.teams : []) if (side(t)) teams.set(t.id, { id: t.id, name: t.name.trim() });
  for (const g of games) for (const t of g.sides) if (!teams.has(t.id)) teams.set(t.id, { id: t.id, name: t.name });
  const stats = (Array.isArray(i.stats) ? i.stats : [])
    .filter((x) => isObj(x) && str(x.key))
    .map((x) => ({
      key: x.key,
      says: str(x.says) || x.key,
      ...(str(x.short) && x.short !== x.key ? { short: x.short } : {}),
      ...(str(x.one) && plain(x.one) !== plain(str(x.says) || '') ? { one: x.one } : {}),
      ...(x.place ? { place: true } : {}),
      ...(x.rate ? { rate: true } : {}),
    }));
  const st = isObj(i.standard) ? i.standard : null;
  const rest = { ...pack };
  for (const k of ['moments', 'couchWordOnly', 'roles']) delete rest[k];
  return {
    ...rest,
    ...(sport ? { sport } : {}),
    teams: [...teams.values()],
    games,
    ...(int(i.gamesMore) ? { gamesMore: i.gamesMore } : {}),
    stats,
    ...(st
      ? {
          standard: {
            ...(isObj(st.scoring) ? { scoring: st.scoring } : {}),
            ...(int(st.starters) ? { starters: st.starters } : {}),
            ...(int(st.bench) !== null ? { bench: st.bench } : {}),
            ...(str(st.locks) ? { locks: st.locks } : {}),
            games: (Array.isArray(st.games) ? st.games : []).filter((g) => isObj(g) && str(g.id) && str(g.about)).map((g) => ({ id: g.id, about: g.about })),
          },
        }
      : {}),
    knows: { finals: true, playerStats: stats.length > 0, lines: games.some((g) => g.line !== undefined) },
  };
}

/** Words as compared: lower case, letters and digits, single spaces. */
const plain = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9+%]+/g, ' ').trim();
/** "home runs" and "home run" alike, "rbis" and "rbi": each word's last s taken off (never a pass's or a bonus's), on both sides. */
const singular = (s) => s.replace(/\b([a-z0-9]{2,}?)s\b/g, (m, stem) => (/(s|u)$/.test(stem) ? m : stem));
const said = (s) => singular(plain(s).replace(/^(an?|one|each|every|per|the)\s+/, ''));

/**
 * G3: the stat some words name among a sport's `stats` ({ key, says, short?, one? }: the pack's, or sports/page.ts statWords), its
 * key, or null: a key as it is ("HR", any case), a column's short form where only one stat has it (a hitter's hits and a pitcher's
 * hits allowed share "H"), or its words or its noun, singular or plural ("home runs", "a home run", "total bases", "RBIs"). Never a
 * guess: words that fit two stats name neither.
 */
function statKeyIn(stats, words) {
  const w = String(words == null ? '' : words).trim();
  const list = (Array.isArray(stats) ? stats : []).filter((x) => isObj(x) && str(x.key));
  if (!w || !list.length) return null;
  const exact = list.find((x) => x.key === w) || list.find((x) => x.key.toUpperCase() === w.toUpperCase());
  if (exact) return exact.key;
  const w2 = said(w);
  const hits = new Set();
  for (const x of list) {
    if (said(x.short || x.key) === w2) hits.add(x.key);
    if ([x.says, x.one].some((y) => str(y) && said(y) === w2)) hits.add(x.key);
  }
  return hits.size === 1 ? [...hits][0] : null;
}

/** The ids a draft may name, from its pack. */
function idsOf(pack) {
  const p = isObj(pack) ? pack : {};
  return {
    moments: new Set((p.moments || []).map((m) => m.id)),
    couchWord: new Set((p.couchWordOnly || []).map((m) => m.id)),
    phases: new Set((p.phases || []).map((x) => x.id)),
    roles: new Set(p.roles || []),
    groups: new Set((p.cast || []).map((c) => c.group).filter(Boolean)),
    people: new Set((p.cast || []).map((c) => c.id || c.name)),
    teams: new Set((p.teams || []).map((t) => t.id)),
    stats: new Set((p.stats || []).map((x) => x.key)),
  };
}

module.exports = { packOf, idsOf, statKeyIn };
