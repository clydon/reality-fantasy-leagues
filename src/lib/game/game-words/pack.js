// The context pack for the Start-a-game GPT (docs/PLAN-start-a-game-gpt.md step G1, "The ask"): everything the app knows about
// the page someone types on, as the bot reads it. The server gathers it (src/lib/server/game-words.ts packInput); this shapes it,
// pure, so a test or the bank (tests/fixtures/game-words/) can build one without a database. Only the moments research answers
// can score (the data-can-settle rule), so the couch's-word ones are listed apart, as moments a game can't score.
//
//   packOf(input) -> the pack (plain JSON, as the prompt embeds it)
//   idsOf(pack)   -> { moments, phases, roles, groups, people }: the ids a draft may name, each a Set
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
    })),
    stillIn: cast.filter((c) => c.in !== false).length,
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
  return pack;
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
  };
}

module.exports = { packOf, idsOf };
