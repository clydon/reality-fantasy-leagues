// G5: a season's made-for games (docs/PLAN-start-a-game-gpt.md G5, U0's "Made for <show>"): one ask a season, shared by every couch
// on it as research is. The bot writes eighteen creative games, six a length (one episode, a few, the season), a betting game in
// each length, every one a whole game in the manual's words; our check (check.js) is the gate, each idea read as a draft whose
// every number is the bot's choice (nobody typed anything). The prompt is U0's run-made ask (2026-11-08, the user's to approve at
// the merge), less the scoring themes, which the app doesn't have yet. The server's side is src/lib/server/made-games.ts.

const LENGTHS = ['one', 'few', 'season'];
const BASES = ['predictions', 'picks', 'lineup', 'best-ball', 'outlast', 'pool', 'bingo', 'calls'];

const HEAD = `You suggest games for our app, Game Your Show: games a group of friends (a "couch") plays along with a TV show. Answer as JSON. Don't search the web: everything you need is below, and what you know about the show.`;

const ASK = `WHAT WE WANT: the season's MADE-FOR games: creative games anyone could start, shown to every couch that plays this season. Eighteen of them: six for one episode, six for a few episodes, six for the season. In each length, at least one is a betting game (points from a bank, a stake on a call, a ticket: points, never money). Fun, built from what makes this show itself (its stages, its votes, its twists, its cast's big moments), each different from the others: a different kind of game, way to win or twist. Use any part of the manual.

For every game:
- Its length follows the show's stages, never episode numbers: one episode ("the next episode", the premiere included), a few (2 to 5 episodes: "the next 3 episodes", "until the merge"), the season (it starts after the first episode).
- The hook is true for its own length: a one-episode game never says "every week".
- Questions are in the present tense and about whoever is still in, never a named cast member.
- Only moments the page lists.
- Every number is yours to choose: put it in the game.
- Names say what the game is, with a little flavour: a 3 or 4 on a scale where 0 is clinical ("Weekly boot prediction") and 10 is wacky ("Chaos Goblins"); 28 characters at most; never a cast member's or another show's name.
- Nothing that needs watching live or tapping during the episode.

ANSWER with one JSON object and nothing else:
{ "ideas": [ { "base": "predictions" | "picks" | "lineup" | "best-ball" | "outlast" | "pool" | "bingo" | "calls", "length": "one" | "few" | "season", "name": "...", "hook": "One sentence a friend would say to sell it.", "fits": "Why it fits this show, in a few words.", "bet": true | false, "game": { the spec, in the manual's words } } ] }
One-episode games first, then a few, then the season.`;

/** The ask: the season's page (no couch: every couch shares it) and the manual, as G1's gamePrompt sends them. */
function madePrompt({ pack, manual }) {
  return [HEAD, '', 'THE SHOW AND SEASON (its moments, its stages):', JSON.stringify(pack), '', manual, '', ASK].join('\n');
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
    out.push({ base: BASES.includes(x.base) ? x.base : null, length, name, hook: str(x.hook, 300) || name, fits: str(x.fits, 200) || null, bet: x.bet === true, game: x.game });
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
