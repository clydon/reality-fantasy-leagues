// Bingo's bank (docs/PLAN-bingo-bank.md; migration 0146 bingo_squares): about thirty squares for an episode, written by an AI
// with web search before it airs, for people watching it together to tick the moment they see them ("It rains", "Someone goes
// fishing", "A chat at the water well"). Cards are dealt from it (src/lib/game/bingo.ts dealCard), a mix of how likely each square
// is to come up, and settled on the honour system, so a square needn't be anything research could check: only something anyone
// half-watching would see.
//
// One prompt per episode, fitted to it: a premiere leans to first impressions, a finale to finale moments, a reunion to reunion
// ones; the phase the season's in (Survivor's merge) and who's still in, by name, for a few squares about someone. A season's own
// bank (no episode) is the same prompt for "a regular episode", with no names: any episode without a bank of its own deals from it.
// The show's scoring moments are a do-not-use list (they're the game's, settled by results, and Call it asks them already).
//
// The strict parse below keeps every square it was given: live when it passes, dropped with why (too long, a question, twice, a
// scoring moment, no likelihood), so the admin episode page can show both. Two ways in: the paste path (the admin episode page's
// prompt, src/lib/server/bingo-bank.ts, step 1), and the bot's own 'bingo' run (db/bot-research.js, step 2), a day before each
// episode airs, which asks a second prompt in a chat of its own to check each square (buildCheckPrompt, judged) and keeps the
// bank only when at least BOT_MIN pass.
//
// The prompts and parses are pure (tests/bingo-research.test.js); bingoContext, storeBank and hasBank read and write the database.
const StateLogic = require("../src/lib/game/state-logic.js");
const { momentsFor } = require("../src/lib/game/formats/rulebook-moments.js");
const { kindOf, partWord } = require("../src/lib/game/formats/rulebook-schema.js");
const { rulebookFor } = require("../src/lib/game/formats/blocks/index.js");
const Research = require("./episode-research.js");
const { seasonRulebook } = require("./rulebooks.js");
const { resolveFormat } = require("./show-formats.js");

/** How many squares the prompt asks for: more than a bank needs, so the parse (and step 2's check) can drop some. */
const ASKED = 30;
/** The fewest live squares worth keeping as a bank: a whole card. */
const MIN_BANK = 8;
/** The fewest the bot's run keeps (fewer is a failed try, asked again): enough that a couch's cards differ. */
const BOT_MIN = 16;
/** The most a square may say (the prompt asks for 40): a square is about 13 characters a line, four lines at most. */
const MAX_LABEL = 48;
/** What bingo_squares.label holds: a dropped square's label is cut to it. */
const STORED_LABEL = 60;
/** At most this many squares may name someone. */
const NAMED = 3;
const LIKELIHOODS = ["likely", "maybe", "longshot"];

/** What kind of episode `n` is, from where it falls and what its listing calls it. Pure. */
function episodeKind({ n, count = null, title = null, note = null }) {
  const words = `${title || ""} ${note || ""}`;
  if (/\breunion\b/i.test(words)) return "reunion";
  if ((count && n === count) || /\bfinale\b/i.test(words)) return "finale";
  if (n === 1 || /\bpremiere\b/i.test(words)) return "premiere";
  return "regular";
}

const LEAN = {
  premiere: "It's the premiere. Lean towards first impressions: people meeting, the new setting, the first challenges or tasks, early friendships and alliances, someone already struggling.",
  finale: "It's the finale. Lean towards finale moments: looking back at the season, final speeches or pleas, family and loved ones, nerves before the end, the winner's reaction, a crowd, confetti. Keep a few of the show's staples too.",
  reunion: "It's the reunion. Lean towards reunion moments: old footage, the host's questions, a feud picked back up, an apology, a walk-off, a surprise guest.",
  regular: "A regular episode: lean on the show's staples, the things that come up week after week.",
};

/**
 * Where the season is by episode `n` with `stillIn` people left (null: not known): the phase it's in, and one starting about now.
 * `phases` is the rulebook's season.phases. Pure.
 */
function phaseLines(phases, n, stillIn) {
  const started = (p) =>
    p.starts && (p.starts.type === "episode" ? n >= p.starts.n : p.starts.type === "remaining" ? stillIn != null && stillIn <= p.starts.n : false);
  const now = [...(phases || [])].reverse().find(started);
  const soon = (phases || []).find((p) => p !== now && p.starts && p.starts.type === "remaining" && stillIn != null && stillIn <= p.starts.n + 1 && stillIn > p.starts.n);
  const at = (phases || []).find((p) => p.starts && p.starts.type === "episode" && p.starts.n === n && n > 1);
  return [
    now && (phases || []).length > 1 ? `The season is in its "${now.name}" phase${now.summary ? `: ${now.summary}` : ""}` : null,
    at ? `This episode is where "${at.name}" starts${at.summary ? `: ${at.summary}` : ""}` : null,
    soon ? `"${soon.name}" starts when ${soon.starts.n} are left, and ${stillIn} are left now, so it may start this episode${soon.summary ? ` (${soon.summary})` : ""}` : null,
  ].filter(Boolean);
}

/**
 * The prompt. `episode` null writes the season's own bank (any regular episode, no names). `stillIn`: who's still in when it airs
 * (names as to write them), [] for a show without a cast; `avoid`: the show's scoring moments' labels.
 */
function buildBingoPrompt({ showName, season, kind = "competition", part = { singular: "episode", plural: "episodes" }, premise = null, episode = null, count = null, airAt = null, title = null, note = null, phases = [], stillIn = [], term = "people", avoid = [] }) {
  const ep = part.singular;
  const forSeason = episode == null;
  const which = forSeason ? null : episodeKind({ n: episode, count, title, note });
  const about = forSeason
    ? [
        `Search the web for ${showName} season ${season}: read about the show, its last few seasons and this one so far.`,
        `Write ${ASKED} bingo squares for any regular ${ep} of it: things people watching together can tick the moment they see them on screen.`,
        `These are for every ${ep} without squares of its own, so each square has to fit any ${ep} of the season, not one in particular.`,
      ]
    : [
        `Search the web for ${showName} season ${season}. ${cap(ep)} ${episode}${title ? `, "${title}",` : ""} ${airAt ? `airs ${airAt}` : "is the next to air"}${note ? ` (${note})` : ""}. It hasn't aired yet.`,
        "Read about the show, this season so far and what the network says about this episode before writing anything.",
        `Write ${ASKED} bingo squares for people watching ${ep} ${episode} together: things they can tick the moment they see them on screen.`,
        "",
        LEAN[which],
        ...phaseLines(phases, episode, stillIn.length ? stillIn.length : null),
      ];
  const named = !forSeason && stillIn.length > 0;
  return [
    ...about,
    premise ? `About the show: ${premise}` : null,
    "",
    "Every square must be:",
    "- Seen on screen, by anyone half-watching: something that happens, is said or is shown in the episode itself. Not something only",
    "  recaps, exit interviews, social media or the next morning's news would tell you.",
    `- Likely, not certain: it comes up in about every ${ep} or every other one of a show like this, so it's ticked some weeks and not`,
    `  others. Never something that happens in every single ${ep} (the show's opening, its usual ending), and never a rare event.`,
    "- Fun to spot: the show's running gags, catchphrases and habits, the setting and the weather, daily life, strategy talk, emotions,",
    "  and the way it's filmed and edited (a host's line, a slow-motion shot, a recap montage). The things a group shouts at the TV.",
    avoid.length ? "- Not part of the game's scoring. These are scored already, so leave them out, and anything that means the same:" : null,
    avoid.length ? `  ${avoid.join("; ")}` : null,
    `- No spoilers and no predictions: nothing about who wins, who goes home or what twist is coming, and nothing from leaked footage.${forSeason ? "" : " The network's own description of the episode is fine."}`,
    "- Short and clear: at most 40 characters, one obvious tap. Written as what happens, in the present tense (\"It rains\", \"Someone",
    "  goes fishing\", \"A chat at the water well\"), never as a question, never \"someone does something\".",
    "- Different from each other: no two squares that the same moment would tick.",
    named ? `- About anyone in particular: at most ${NAMED} squares may name someone, and only someone from this list of the ${term} still in, written as listed:` : null,
    named ? `  ${stillIn.join(", ")}` : forSeason ? "- About nobody in particular: no names, since anyone could be gone by the time a square is dealt." : null,
    "",
    "Give each square a likelihood:",
    `- likely: it comes up in most ${part.plural}`,
    `- maybe: about every other ${ep}`,
    "- longshot: now and then, but it wouldn't surprise anyone",
    "About a third likely, about half maybe and the rest longshot.",
    "",
    "Reply with only this JSON, in a ```json code block, and nothing after it:",
    '{"squares": [{"square": "It rains", "likelihood": "maybe"}]}',
    `Write ${ASKED} squares. Plain JSON: double quotes, no comments, no trailing commas.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const str = (v) => (typeof v === "string" ? v.trim() : "");
const fold = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();

/** A square as written, tidied: no wrapping quotes, no full stop, no doubled spaces, a capital first. */
function tidy(label) {
  const t = str(label).replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").replace(/\s+/g, " ").replace(/\.+$/, "").trim();
  return t ? cap(t) : "";
}

/** Whether a square names one of `names` (a whole name, or a first name of three letters or more). */
function namesSomeone(label, names) {
  const words = ` ${fold(label)} `;
  return names.some((n) => {
    const full = fold(n);
    const first = full.split(" ")[0];
    return (full && words.includes(` ${full} `)) || (first.length >= 3 && words.includes(` ${first} `));
  });
}

/**
 * The answer: { squares: [{ label, likelihood, status, note }], skipped }. Every square with words is kept, live or dropped with
 * why; `skipped` counts entries with none. `avoid`: the show's scoring moments' labels; `names`: the season's cast, so a bank
 * names someone in at most NAMED squares (`anyone` false: the season's own bank, which names nobody). Throws only when there's no
 * JSON at all.
 */
function parseBingoAnswer(text, { avoid = [], names = [], anyone = true } = {}) {
  const raw = JSON.parse(Research.extractJsonObject(String(text || "")));
  const list = Array.isArray(raw.squares) ? raw.squares : Array.isArray(raw) ? raw : [];
  const scored = new Set(avoid.map(fold));
  const seen = new Set();
  const squares = [];
  let skipped = 0;
  let named = 0;
  for (const item of list.slice(0, ASKED + 10)) {
    const label = tidy(typeof item === "string" ? item : item && (item.square ?? item.label ?? item.text));
    if (!label) {
      skipped++;
      continue;
    }
    const said = str(item && item.likelihood).toLowerCase().replace(/[\s_-]+/g, "");
    const likelihood = said === "" ? "maybe" : LIKELIHOODS.includes(said) ? said : null;
    const why =
      label.length > MAX_LABEL
        ? "too long for a square"
        : /\?$/.test(label)
          ? "a question, not something you see"
          : !likelihood
            ? "no likelihood (likely, maybe or longshot)"
            : seen.has(fold(label))
              ? "written twice"
              : scored.has(fold(label))
                ? "one of the show's scoring moments"
                : namesSomeone(label, names) && (!anyone || ++named > NAMED)
                  ? anyone
                    ? `more than ${NAMED} squares name someone`
                    : "names someone (the season's squares name nobody)"
                  : null;
    seen.add(fold(label));
    squares.push({
      label: label.length > STORED_LABEL ? `${label.slice(0, STORED_LABEL - 1)}…` : label,
      likelihood: likelihood || "maybe",
      status: why ? "dropped" : "live",
      note: why,
    });
  }
  return { squares, skipped };
}

// ---------- the check ----------
// A second prompt, in a chat of its own (each ask opens a new one), judges what the first wrote, the way a couch would: would you
// see it, does it come up often enough without being certain, is it one of the game's scoring moments, does it give anything away,
// and would the same moment tick another square. It can also say how likely a square really is. Only a square every check passes
// stays live; the rest are kept as dropped, with why.

/**
 * The check's prompt: the squares the parse kept, numbered from 1 (`squares`), for an episode or (`episode` null) the season.
 * A premiere, finale or reunion (episodeKind, from `count`, `title` and `note`) is judged against others of its kind: the writer
 * was told to lean on its moments, which against regular episodes would all look rare (Survivor 49's finale: 4 of 30 passed).
 */
function buildCheckPrompt({ showName, season, part = { singular: "episode", plural: "episodes" }, episode = null, count = null, title = null, note = null, squares, avoid = [] }) {
  const ep = part.singular;
  const which = episode == null ? "regular" : episodeKind({ n: episode, count, title, note });
  const one = which === "regular" ? ep : which;
  return [
    `These are bingo squares for people watching ${showName} season ${season} together, ${episode == null ? `for any ${ep} of the season` : `for ${ep} ${episode}`}. Someone else wrote them; check every one.`,
    `Use what you know about the show, and search the web about it if you need to.${episode == null ? "" : ` ${cap(ep)} ${episode} hasn't aired yet: never look for what happens in it.`}`,
    which === "regular" ? null : `It's the season's ${which}, so judge each square against ${which}s of a show like this, not its regular ${part.plural}.`,
    "",
    ...squares.map((s, i) => `${i + 1}. ${s.label} (${s.likelihood})`),
    "",
    "For each square:",
    "- seen: true if anyone half-watching would see it on screen: it happens, is said or is shown in the episode itself. False if",
    "  only recaps, exit interviews, social media or the next morning's news would tell you.",
    `- likely: true if it comes up in about every ${one} or every other one of a show like this. False if it happens in every single`,
    `  ${one} (certain, so not worth a square) or hardly ever (rare).`,
    "- scoring: true if it's one of the game's scoring moments listed below, or means the same; else false.",
    "- spoiler: true if it gives anything away or predicts an outcome (who wins, who goes home, a twist that's coming, leaked",
    "  footage); else false.",
    "- sameAs: the number of an EARLIER square that the same moment on screen would also tick (\"It rains\" and \"Rain at camp\"),",
    "  else null.",
    `- likelihood: how often it really comes up: likely (most ${which === "regular" ? part.plural : `${which}s`}), maybe (about every other), longshot (now and then).`,
    "- note: when seen or likely is false, scoring or spoiler is true, or sameAs is set, a few words on why; else an empty string.",
    avoid.length ? "" : null,
    avoid.length ? `The game's scoring moments: ${avoid.join("; ")}` : null,
    "",
    "Reply with only this JSON, in a ```json code block, and nothing after it, one entry per square in the same order:",
    '{"checks": [{"n": 1, "seen": true, "likely": true, "scoring": false, "spoiler": false, "sameAs": null, "likelihood": "maybe", "note": ""}]}',
    "Plain JSON: double quotes, no comments, no trailing commas.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/**
 * The check's answer: one verdict per square (by `n`, from 1), or null for one it didn't check. Each judgement must be given
 * outright (seen and likely true, scoring and spoiler false) to pass; `sameAs` counts only for an earlier square.
 */
function parseCheckAnswer(text, count) {
  const raw = JSON.parse(Research.extractJsonObject(String(text || "")));
  const out = Array.from({ length: count }, () => null);
  for (const c of Array.isArray(raw.checks) ? raw.checks : []) {
    const n = Number(c && c.n);
    if (!Number.isInteger(n) || n < 1 || n > count || out[n - 1]) continue;
    const same = Number(c.sameAs);
    const said = str(c.likelihood).toLowerCase().replace(/[\s_-]+/g, "");
    out[n - 1] = {
      seen: c.seen === true,
      likely: c.likely === true,
      scoring: c.scoring !== false,
      spoiler: c.spoiler !== false,
      sameAs: c.sameAs != null && Number.isInteger(same) && same >= 1 && same < n ? same : null,
      likelihood: LIKELIHOODS.includes(said) ? said : null,
      note: str(c.note).slice(0, 200) || null,
    };
  }
  return out;
}

/**
 * Every square the first prompt wrote, live or dropped, with why: the parse's drops as they were, then each checked square's
 * verdict (`checks`, one per square the parse kept, in order). A square the same as an earlier one is dropped only while that
 * one is still live; a likelihood the check gives replaces the writer's.
 */
function judged(squares, checks) {
  const kept = [];
  let i = 0;
  return squares.map((s) => {
    if (s.status !== "live") return s;
    const v = checks[i++];
    const like = v && kept[v.sameAs - 1];
    const why = !v
      ? "not checked"
      : !v.seen
        ? "not something you'd see on screen"
        : !v.likely
          ? "too rare, or too certain, to be a square"
          : v.scoring
            ? "one of the game's scoring moments"
            : v.spoiler
              ? "gives something away"
              : like && like.status === "live"
                ? `the same moment as "${like.label}"`
                : null;
    const out = { ...s, likelihood: (v && v.likelihood) || s.likelihood, status: why ? "dropped" : "live", note: why ? `the check: ${why}${v && v.note ? ` (${v.note})` : ""}` : null };
    kept.push(out);
    return out;
  });
}

// ---------- the database ----------

/** A season's rulebook blocks: its own, else its show's format's. */
async function blocksOf(pool, seasonId) {
  const row = await seasonRulebook(pool, seasonId);
  if (row && row.blocks) return row.blocks;
  const { rows } = await pool.query("SELECT s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  const format = await resolveFormat(pool, rows[0] ? rows[0].format : null);
  return rulebookFor(format.id, format.data).blocks;
}

/**
 * Everything the prompt says about an episode (`episode` null: the season's own bank): the show, the kind of episode, the phase,
 * who's still in (the season's cast less who's gone before it, by its results, accepted or not), and the moments that score.
 * `airAt`: when it airs, as to write it ("Wed, Oct 29, 8:00 PM EDT"), from the caller's schedule; `title` and `note` the schedule's
 * (with the wiki's title when the listings have none), else season_episodes' own.
 */
async function bingoContext(pool, seasonId, episode, { airAt = null, title, note } = {}) {
  const { rows: head } = await pool.query(
    `SELECT s.name, s.castaway_term, ss.season_number, ss.episode_count FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
    [seasonId]
  );
  if (!head[0]) throw new Error("Season not found");
  const [blocks, { rows: cast }] = await Promise.all([
    blocksOf(pool, seasonId),
    pool.query("SELECT name FROM season_cast WHERE season_id = $1 ORDER BY sort_order ASC, name ASC", [seasonId]),
  ]);
  const avoid = [...new Set(momentsFor(blocks).filter((m) => !m.off && m.label).map((m) => String(m.label).replace(/\.$/, "")))];
  const base = {
    /** Everyone in the season, for the parse's names check. */
    cast: cast.map((c) => c.name),
    showName: head[0].name,
    season: head[0].season_number,
    kind: kindOf(blocks),
    part: partWord(blocks),
    premise: (blocks && blocks.premise) || null,
    count: head[0].episode_count || null,
    phases: (blocks && blocks.season && blocks.season.phases) || [],
    term: (blocks && blocks.cast && blocks.cast.plural) || (head[0].castaway_term ? `${head[0].castaway_term.toLowerCase()}s` : "people"),
    avoid,
  };
  if (episode == null) return { ...base, episode: null };
  const [{ rows: ep }, { rows: exits }] = await Promise.all([
    pool.query("SELECT title, note FROM season_episodes WHERE season_id = $1 AND number = $2", [seasonId, episode]),
    pool.query(
      `SELECT DISTINCT castaway_name FROM season_decisions
        WHERE season_id = $1 AND kind = 'elimination' AND status <> 'rejected' AND episode_number < $2`,
      [seasonId, episode]
    ),
  ]);
  const roster = { castaways: cast.map((c, i) => ({ id: String(i), name: c.name })) };
  const gone = new Set(exits.map((e) => (StateLogic.Core.findCastawayByName(roster, e.castaway_name).castaway || {}).name).filter(Boolean));
  return {
    ...base,
    episode,
    airAt,
    title: title !== undefined ? title : (ep[0] && ep[0].title) || null,
    note: note !== undefined ? note : (ep[0] && ep[0].note) || null,
    stillIn: cast.map((c) => c.name).filter((name) => !gone.has(name)),
  };
}

/** Files a bank for a season's episode (null: its own), replacing any earlier one for it. Returns how many went live. */
async function storeBank(pool, seasonId, episode, squares, runId = null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM bingo_squares WHERE season_id = $1 AND episode IS NOT DISTINCT FROM $2", [seasonId, episode]);
    for (const s of squares) {
      await client.query(
        "INSERT INTO bingo_squares (season_id, episode, label, likelihood, status, note, run_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [seasonId, episode, s.label, s.likelihood, s.status, s.note, runId]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return squares.filter((s) => s.status === "live").length;
}

/** Whether a season's episode (null: the season's own) has a bank of live squares already. */
async function hasBank(pool, seasonId, episode) {
  const { rows } = await pool.query("SELECT EXISTS (SELECT 1 FROM bingo_squares WHERE season_id = $1 AND episode IS NOT DISTINCT FROM $2 AND status = 'live') AS has", [seasonId, episode]);
  return !!rows[0].has;
}

module.exports = {
  ASKED,
  MIN_BANK,
  BOT_MIN,
  MAX_LABEL,
  NAMED,
  episodeKind,
  phaseLines,
  buildBingoPrompt,
  parseBingoAnswer,
  buildCheckPrompt,
  parseCheckAnswer,
  judged,
  bingoContext,
  storeBank,
  hasBank,
};
