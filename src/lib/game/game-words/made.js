// G5: a season's made-for games (docs/PLAN-start-a-game-gpt.md G5, U0's "Made for <show>"): a library for every couch on the
// season, as research is shared: a wide spread over everything the app offers (every kind of game, every way to win, the twists
// and bets), to start as it is or to tinker with. The menu is the wizard's own lists (start-wizard KINDS, WINS, TWISTS, MONEY,
// handed in by the server), so a kind the engine gains is asked for from then on; the manual is generated from the engine too. An
// ask again adds to the library, the kinds and ways to win it lacks first. Our check (check.js) is the gate, each idea read as a
// draft whose every number is the bot's choice (nobody typed anything). U0's run-made ask (2026-11-08) grown into this, less the
// scoring themes, which the app doesn't have yet: the user's to approve at the merge. The server's side is
// src/lib/server/made-games.ts.

const LENGTHS = ['one', 'few', 'season'];

const HEAD = `You suggest games for our app, Game Your Show: games a group of friends (a "couch") plays along with a TV show. Answer as JSON. Don't search the web: everything you need is below, and what you know about the show.`;

/** The menu as the prompt lists it: `menu` { kinds: [{ id, name, says }], wins: [{ id, label, says }], twists: [labels], bets: [labels] }. */
function menuText(menu) {
  const m = menu || {};
  return [
    `THE KINDS OF GAME WE OFFER (a game's "kind" is one of these ids):`,
    ...(m.kinds || []).map((k) => `- "${k.id}": ${k.name}. ${k.says}.${k.wins ? ` Ways to win it takes: ${k.wins.join(', ')}.` : ''}${k.example ? ` As our engine plays it on this season: ${JSON.stringify(k.example)}` : ''}`),
    "Start each game from its kind's engine game and change it with the manual's parts: a game our engine can't play is thrown away, so where a kind's engine game has a part (a bingo card, how calls are counted), keep it as it is, give each kind only a way to win it takes, and add no part its engine game doesn't have unless the manual says this show can use it.",
    '',
    'THE WAYS TO WIN:',
    ...(m.wins || []).map((w) => `- "${w.id}": ${w.label}. ${w.says}.`),
    '',
    `THE TWISTS: ${(m.twists || []).join('; ')}.`,
    `THE BETS (points, never money): ${(m.bets || []).join('; ')}.`,
  ].join('\n');
}

function askText(menu, have, missing) {
  const n = have && have.length ? 20 : 30;
  const library = have && have.length
    ? `ALREADY MADE (don't repeat these; make ${n} new ones, different from them): ${have.map((h) => `${h.name} (${h.kind}, ${h.length})`).join('; ')}.${missing && missing.length ? `\nTHE LIBRARY LACKS (make these first): ${missing.join('; ')}.` : ''}`
    : `Make about ${n}.`;
  return `WHAT WE WANT: the season's MADE-FOR games: a library every couch on this season can start as it is, or tinker with for ideas. A wide spread over everything we offer: every kind of game above that this show can play, at least twice, across the lengths it fits; every way to win at least once; the twists and bets spread across them, a betting game in each length; about a third each for one episode, a few episodes and the season. Fun, built from what makes this show itself (its stages, its votes, its twists, its cast's big moments), each different from the others. Use any part of the manual.
${library}

For every game:
- Its length follows the show's stages, never episode numbers: one episode ("the next episode", the premiere included), a few (2 to 5 episodes: "the next 3 episodes", "until the merge"), the season (it starts after the first episode).
- The hook is true for its own length: a one-episode game never says "every week".
- Questions are in the present tense and about whoever is still in, never a named cast member.
- Only moments the page lists.
- Every number is yours to choose: put it in the game.
- Names say what the game is, with a little flavour: a 3 or 4 on a scale where 0 is clinical ("Weekly boot prediction") and 10 is wacky ("Chaos Goblins"); 28 characters at most; never a cast member's or another show's name.
- Nothing that needs watching live or tapping during the episode.

ANSWER with one JSON object and nothing else:
{ "ideas": [ { "kind": ${(menu && menu.kinds ? menu.kinds.map((k) => `"${k.id}"`) : ['"..."']).join(' | ')}, "win": ${(menu && menu.wins ? menu.wins.map((w) => `"${w.id}"`) : ['"..."']).join(' | ')}, "length": "one" | "few" | "season", "name": "...", "hook": "One sentence a friend would say to sell it.", "fits": "Why it fits this show, in a few words.", "bet": true | false, "game": { the spec, in the manual's words } } ] }
One-episode games first, then a few, then the season.`;
}

/** The ask: the season's page (no couch: every couch shares it), the manual, the menu, and (asked again) the library so far. */
function madePrompt({ pack, manual, menu, have = [], missing = [] }) {
  return [HEAD, '', 'THE SHOW AND SEASON (its moments, its stages, its cast):', JSON.stringify(pack), '', manual, '', menuText(menu), '', askText(menu, have, missing)].join('\n');
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** The ideas in the bot's answer, each with a game, a known length and a name; anything else left out. Throws on no JSON. */
function readIdeas(answer) {
  const text = String(answer || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON in the answer');
  const json = JSON.parse(text.slice(start, end + 1));
  const out = [];
  for (const x of Array.isArray(json && json.ideas) ? json.ideas : []) {
    if (!x || typeof x !== 'object' || !x.game || typeof x.game !== 'object' || Array.isArray(x.game)) continue;
    const length = LENGTHS.includes(x.length) ? x.length : null;
    const name = str(x.name, 40);
    if (!length || !name) continue;
    out.push({ base: str(x.kind || x.base, 30) || null, length, name, hook: str(x.hook, 300) || name, fits: str(x.fits, 200) || null, bet: x.bet === true, game: x.game });
  }
  return out;
}

/** An idea as a draft for our check: every part said in its hook, every number assumed (the bot's choice: nobody typed one). */
function ideaDraft(idea) {
  const assumed = [];
  const walk = (v, p) => {
    if (typeof v === 'number') assumed.push({ part: p, value: v, why: 'the made-for game: the bot chose it' });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
  };
  walk(idea.game, '');
  const said = Object.keys(idea.game)
    .filter((k) => k !== 'spec')
    .map((part) => ({ part, quote: idea.hook }));
  return { draft: 1, game: idea.game, said, assumed, ask: [], cantYet: [], summary: idea.hook };
}

module.exports = { MADE_LENGTHS: LENGTHS, madePrompt, readIdeas, ideaDraft };
