// What a show calls things (db/migrations/0142): one of its episodes (shows.episode_term: "Episode", a baseball series'
// "Game", F1's "Race") and one of its people (shows.castaway_term: "Castaway", "Player", "Driver"). The show's tabs and every
// "Episode 4" its screens say read them through showWords, so a sport reads as games and players, not episodes and a cast.

export interface ShowWords {
  /** "Episode", "Game", "Race". */
  episode: string;
  episodes: string;
  /** Before a number where room is short: "Ep 4", but "Game 4" (only Episode has a short form people know). */
  ep: string;
  /** "Castaway", "Player", "Cast member". */
  person: string;
  people: string;
  /** The people tab: "Castaways", "Players", else "Cast" when the word won't fit a tab. */
  peopleTab: string;
  /** The episodes tab: "Episodes", "Races", else "Schedule" (when the word is long, or would read as the Games tab). */
  episodesTab: string;
  /** A team's season: each game's name by episode (epName); absent for a show. */
  names?: Record<number, GameLabel> | null;
}

/** A sport's game by what it is (server sports/game-names.ts): "Week 11 at Bengals", "at Bengals", "@CIN". */
export interface GameLabel {
  long: string;
  short: string;
  tag: string;
  /** A narrow column's (a season grid's): the opponent from the team's side, "KC", "@CIN". */
  col?: string;
  /** The two teams' ids, away then home (or the season's team first when neither is home): their pictures (game-art.ts). */
  sides?: string[];
}

/**
 * An episode as people name it: a team's game by its opponent ("Week 11 at Bengals"; `short` "at Bengals", `tag` "@CIN"), else the
 * show's word and its number ("Episode 4", "Ep 4"). Never "Game 10" for a game that has a name (docs/design-round/props-table-spec.md).
 */
export function epName(words: { episode: string; ep?: string; names?: Record<number, GameLabel> | null }, n: number, form: "long" | "short" | "tag" | "col" | "narrow" = "long"): string {
  const g = words.names?.[n];
  if (form === "col") return g?.col ?? String(n);
  // A narrow cell that said "Ep 4" (a week strip, a chart's axis): the opponent for a team's game, else "Ep 4" as it was.
  if (form === "narrow") return g?.col ?? `${words.ep ?? epShort(words.episode)} ${n}`;
  if (g) return g[form];
  return form === "long" ? `${words.episode} ${n}` : `${words.ep ?? epShort(words.episode)} ${n}`;
}

const TAB_ROOM = 11;
// A word for the whole group, not one person (The Traitors' "Cast"): its people are the word, one of them a "Cast member".
const COLLECTIVE = /^(cast|crew)$/i;
// Already plural ("Contestants"): leave it. "-ss/-us/-is" endings are singulars (Class, Bus, Iris).
const LOOKS_PLURAL = /[^sciux]s$/i;

// Words a listing numbers that say when, not what ("Week 3: Bills at Jets", "Night 2", "Part 1"): never a show's word for one.
const NOT_A_WORD = new Set(["Episode", "Ep", "Part", "Chapter", "Night", "Day", "Week", "Show", "Season", "Volume", "Vol", "No"]);

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

/** "Game" -> "Games", "Celebrity" -> "Celebrities", "Cast member" -> "Cast members", "Contestants" stays. */
export function pluralWord(word: string): string {
  if (!word || LOOKS_PLURAL.test(word)) return word;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/** `people`: the show's own word for many of them, when the desk set one (shows.castaway_plural, 0429: "People" for "Person"). */
/** An episode word as a strip or a tag says it, short (U1's sports slice: the strip's unit is the world's, "Wk", "G", "Ep"): the
 *  usual shortenings, else the word itself (never two letters cut off it: "Game" was "Ga"). */
export function epShort(episode: string): string {
  const SHORT: Record<string, string> = { Episode: "Ep", Week: "Wk", Game: "G", Round: "Rd", Matchday: "MD", Gameweek: "GW", Race: "Race", Day: "Day", Night: "Night" };
  return SHORT[episode] ?? episode;
}

/** An engine's words (its "Episode", the default when it isn't told the show's) in the show's own ("Game 3", "Weeks 1–4"). */
export function inShowWords(text: string, words: Pick<ShowWords, "episode" | "episodes">): string {
  if (words.episode === "Episode") return text;
  return text.replace(/\bEpisodes\b/g, words.episodes).replace(/\bEpisode\b/g, words.episode).replace(/\bepisodes\b/g, words.episodes.toLowerCase()).replace(/\bepisode\b/g, words.episode.toLowerCase());
}

export function showWords(terms: { castaway?: string | null; people?: string | null; episode?: string | null } | null | undefined, names?: Record<number, GameLabel> | null): ShowWords {
  const episode = cap((terms?.episode ?? "").trim()) || "Episode";
  const said = cap((terms?.castaway ?? "").trim()) || "Cast member";
  const person = COLLECTIVE.test(said) ? `${said} member` : said;
  const episodes = pluralWord(episode);
  const own = cap((terms?.people ?? "").trim());
  const people = own || (COLLECTIVE.test(said) ? said : pluralWord(person));
  return {
    episode,
    episodes,
    ep: epShort(episode),
    person,
    people,
    peopleTab: people.length <= TAB_ROOM ? people : "Cast",
    episodesTab: episodes.length <= TAB_ROOM && episodes !== "Games" ? episodes : "Schedule",
    ...(names && Object.keys(names).length ? { names } : {}),
  };
}

/**
 * A sport's word for one of its episodes from its listing's titles ("Game 4: Brewers at Rays" -> "Game"): the word most titled
 * episodes start with before a number, when it's more than half of them (never one that says when: "Week 3"); else null.
 */
export function episodeWordFromTitles(titles: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  let titled = 0;
  for (const t of titles) {
    if (!t) continue;
    titled++;
    const m = /^([A-Za-z]+) \d+/.exec(t.trim());
    const w = m ? cap(m[1].toLowerCase()) : null;
    if (w && !NOT_A_WORD.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] * 2 > titled ? best[0] : null;
}
