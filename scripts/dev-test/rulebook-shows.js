// Dev-only test bank: the shows the rulebook checks try (check-rulebook-prompt.js researches each one's rulebook;
// check-episode-research.js researches a few of its episodes with it), and the ask-AI bot client both use.
//
//   const { PRESETS, TEMPLATES, botUrl, askBot } = require("./rulebook-shows");
//
// Each preset: what to ask for the rulebook (show, season, airing), our own rulebook to compare with (expect),
// where its cast is in the local database (cast: [showSlug, seasonNumber]), and the season and episodes to
// research (episodes: { season, numbers, castLabel? }: castLabel names the cast when "season N" doesn't, as for a sport's rosters). The bot is llm-browser-api (LLM_BROWSER_API_URL / _KEY in
// .env.local): this PC's by default, so production's VM stays free.
require("dotenv").config({ path: ".env.local", quiet: true });
const { BUILT_IN_BLOCKS } = require("../../src/lib/game/formats/blocks/index.js");
const SAMPLES = require("../../tests/fixtures/rulebook-samples.js");

const PRESETS = {
  "survivor-50": { show: "Survivor", season: "Season 50", expect: BUILT_IN_BLOCKS.survivor.blocks, episodes: { season: "50", numbers: [1, 7, 13] } },
  "survivor-51": {
    show: "Survivor", season: "Season 51, airing now", airing: true, expect: BUILT_IN_BLOCKS.survivor.blocks, cast: ["survivor", 51],
    episodes: { season: "51", numbers: [1, 3, 5] },
  },
  "amazing-race": { show: "The Amazing Race", season: "its most recent season", expect: SAMPLES.amazingRace, episodes: { season: "37", numbers: [1, 6, 12] } },
  "the-challenge": { show: "The Challenge", season: "its most recent season", expect: BUILT_IN_BLOCKS.challenge.blocks, episodes: { season: "40", numbers: [1, 8, 16] } },
  "real-housewives": { show: "The Real Housewives of Beverly Hills", season: "its most recent season", episodes: { season: "14", numbers: [1, 9, 18] } },
  "below-deck": { show: "Below Deck", season: "its most recent season", expect: SAMPLES.belowDeck, episodes: { season: "11", numbers: [1, 8, 15] } },
  "world-series-2025-game-2": { show: "the World Series", season: "Game 2 of the 2025 World Series", episodes: { season: "2025", numbers: [1, 2, 3], castLabel: "the 2025 World Series: both teams' full rosters" } },
  "world-series-2026-game-2": {
    show: "the World Series", season: "Game 2 of the 2026 World Series, which hasn't happened yet or is about to", airing: true,
    episodes: { season: "2026", numbers: [1, 2], castLabel: "the 2026 World Series: both teams' full rosters" },
  },
  scrubs: { show: "Scrubs", season: "its most recent season", episodes: { season: "1", numbers: [1, 12, 24] } },
  "snl-51": { show: "Saturday Night Live", season: "Season 51", expect: SAMPLES.snl, episodes: { season: "51", numbers: [1, 8, 15] } },
  "snl-52": { show: "Saturday Night Live", season: "Season 52, airing now", airing: true, expect: SAMPLES.snl, episodes: { season: "52", numbers: [1, 2, 3] } },
};

// The nearest rulebook we have, as a starting point (--template).
const TEMPLATES = {
  "amazing-race": BUILT_IN_BLOCKS.survivor.blocks, "the-challenge": BUILT_IN_BLOCKS.survivor.blocks, "real-housewives": SAMPLES.belowDeck,
  "below-deck": SAMPLES.pluribus, "world-series-2025-game-2": SAMPLES.formula1, "world-series-2026-game-2": SAMPLES.formula1,
  scrubs: SAMPLES.pluribus, "snl-51": SAMPLES.formula1, "snl-52": SAMPLES.formula1,
};

const UA = { "User-Agent": "GameYourShow/1.0 (+https://gameyourshow.com)" };

/** The bot to use: `which` local (this PC's, the default) or vm. */
function botUrl(which = "local") {
  const urls = (process.env.LLM_BROWSER_API_URL || "").split(",").map((u) => u.trim().replace(/\/+$/, "")).filter(Boolean);
  if (!urls.length || !process.env.LLM_BROWSER_API_KEY) throw new Error("LLM_BROWSER_API_URL and LLM_BROWSER_API_KEY must be in .env.local");
  const local = urls.find((u) => /127\.0\.0\.1|localhost/.test(u));
  if (which === "local" && local) return local;
  return urls.find((u) => u !== local) || urls[0];
}

/** One prompt to ChatGPT with web search, through the bot: { answer, seconds }. */
async function askBot(url, prompt, { maxWait = 420 } = {}) {
  const res = await fetch(`${url}/ask`, {
    method: "POST",
    headers: { ...UA, "Content-Type": "application/json", "X-API-Key": process.env.LLM_BROWSER_API_KEY },
    body: JSON.stringify({ provider: "chatgpt", prompt, search: true, max_wait: maxWait }),
    signal: AbortSignal.timeout((maxWait + 30) * 1000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.response) throw new Error(body.detail || `HTTP ${res.status}`);
  return { answer: body.response, seconds: body.seconds || 0 };
}

/** The season's cast from the local database, read only ([] when it isn't there). */
async function localCast(cast) {
  const url = process.env.AUTH_DATABASE_URL || "";
  if (!cast || !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) return [];
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(
      `SELECT sc.name FROM season_cast sc JOIN show_seasons ss ON ss.id = sc.season_id JOIN shows s ON s.id = ss.show_id
        WHERE s.slug = $1 AND ss.season_number = $2 ORDER BY sc.sort_order, sc.name`,
      cast
    );
    return rows.map((r) => r.name);
  } catch {
    return [];
  } finally {
    await pool.end();
  }
}

/** Who left and when, by the season's accepted results in the local database (read only; {} when it isn't there). */
async function localExits(cast) {
  const url = process.env.AUTH_DATABASE_URL || "";
  if (!cast || !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) return {};
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(
      `SELECT sd.castaway_name AS name, sd.episode_number AS episode, sd.method FROM season_decisions sd
         JOIN show_seasons ss ON ss.id = sd.season_id JOIN shows s ON s.id = ss.show_id
        WHERE s.slug = $1 AND ss.season_number = $2 AND sd.kind = 'elimination' AND sd.status = 'accepted'`,
      cast
    );
    return Object.fromEntries(rows.map((r) => [r.name, { episode: r.episode, how: r.method, from: "accepted results" }]));
  } catch {
    return {};
  } finally {
    await pool.end();
  }
}

module.exports = { PRESETS, TEMPLATES, botUrl, askBot, localCast, localExits };
