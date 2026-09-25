// Semantic search over episode research's free text (db/episode-research.js), backing a "suggested
// answer" for side bets (BetLogic in src/lib/game/state-logic.js). See db/migrations/0016 for why
// this is a search index and episode_research_items (0015) is a mapper, not the other way round: a
// side bet's question is arbitrary prose ("Will Jenna find an idol?") with no structured field to
// match against, unlike the fixed checklist -- that's the shape semantic search is actually for.
//
// Three design choices carry this file:
//
//   1. STORE ONLY WHAT'S WORTH FINDING. A castaway nothing happened to gets no chunk at all (see
//      chunksFromResearch below) -- a chunk that just says "nothing notable" still scores some
//      nonzero similarity against any query and would sit in the results for zero information.
//
//   2. NEVER FABRICATE AN ANSWER. This never asks a model to answer the bet -- it returns the most
//      similar chunk of REAL research text, verbatim, with a numeric confidence and the episode it
//      came from. If nothing scores high enough, it says so instead of guessing. Same rule the
//      checklist's three-valued answers follow: an honest "can't tell" beats a plausible-looking
//      wrong answer, because a human is about to act on it.
//
//   3. ASYMMETRIC EMBEDDINGS. The model is trained with an instruction on the QUERY side only
//      (QUERY_PREFIX below) -- a short question and a descriptive note are different kinds of text,
//      and marking which is which measurably improves retrieval. Getting this backwards doesn't
//      error, it just quietly retrieves worse, so it's worth being deliberate about.
//
// The model runs INSIDE the app (transformers.js + ONNX), not behind an API: no key, no external
// service, no per-call cost. It's small (bge-small-en-v1.5, 8-bit, 34MB): loads in ~0.2s from disk
// and embeds a whole episode's notes in tens of milliseconds. The files are fetched at build time
// (db/fetch-embedding-model.js) into .models/ and shipped with the functions that use them (see
// next.config.ts); anywhere they're missing -- a fresh checkout, the GitHub Action -- the first use
// downloads them once.

require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
// How each show format words its research answers (format.research.sentences).
const Formats = require("../src/lib/game/formats/index.js");

const EMBED_MODEL = "Xenova/bge-small-en-v1.5";
const DIMENSIONS = 384;
// bge's retrieval instruction, for the searching side only.
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";
// cwd, not __dirname: this file is bundled into the Next routes, where __dirname isn't the repo.
// On Vercel cwd is the function's root, which is where the traced .models/ files land.
const MODEL_DIR = path.join(process.cwd(), ".models");

// Calibrated for bge-small on a hand-built set of research notes and side-bet questions (seven notes,
// eight questions, including "Was a woman voted off?" and two off-topic ones) -- not a rigorous
// sample. Correct matches scored 0.62-0.80; the off-topic questions' best matches scored 0.46-0.58,
// and so did the one question whose right note wasn't the top match -- so below 0.62 means "can't
// tell", which is what the thresholds make it. Revisit once there's real grading history to check
// them against (does a "medium" answer actually tend to be wrong more often than a "high" one?).
const CONFIDENCE_THRESHOLDS = { high: 0.7, medium: 0.62 };

function confidenceFor(similarity) {
  if (similarity >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (similarity >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return null; // below the floor: "can't determine confidently" territory, not a real answer.
}

// Whether the model's files are already on disk (fetched at build, or by an earlier run).
function modelOnDisk() {
  return fs.existsSync(path.join(MODEL_DIR, EMBED_MODEL, "onnx", "model_quantized.onnx"));
}

// Loaded once per process and reused: loading is the only slow part, embedding is milliseconds.
let extractor = null;
function loadModel() {
  if (!extractor) {
    extractor = (async () => {
      // A dynamic import because transformers.js is ESM and this file is CommonJS.
      const { pipeline, env } = await import("@huggingface/transformers");
      // Read from .models/ when it's there. Otherwise download once, into .models/ where that's
      // writable (a dev machine, the GitHub Action) or the temp dir where it isn't (a serverless
      // function whose .models/ didn't get shipped).
      let writable = true;
      try {
        fs.mkdirSync(MODEL_DIR, { recursive: true });
        fs.accessSync(MODEL_DIR, fs.constants.W_OK);
      } catch {
        writable = false;
      }
      env.cacheDir = modelOnDisk() || writable ? MODEL_DIR : path.join(os.tmpdir(), "rfl-models");
      return pipeline("feature-extraction", EMBED_MODEL, { dtype: "q8" });
    })().catch((e) => {
      extractor = null; // let the next call try again rather than caching the failure
      throw new Error(`Embeddings: couldn't load the ${EMBED_MODEL} model (${e.message}).`);
    });
  }
  return extractor;
}

/** Embeds one or more texts. `kind` is "document" for text being stored and "query" for text being
 * searched with -- see the file header on why that split matters. Returns one 384-dim unit vector
 * per input text, in the same order. */
async function embedTexts(texts, kind) {
  if (!texts.length) return [];
  const model = await loadModel();
  const input = kind === "query" ? texts.map((t) => QUERY_PREFIX + t) : texts;
  const output = await model(input, { pooling: "cls", normalize: true });
  return output.tolist();
}

/** Turns one episode's research payload into the chunks worth embedding: one episode-level summary,
 * plus one per castaway who has something notable on their checklist -- see the file header on why
 * an empty note is worse than no chunk at all. The per-person lines are the show format's own
 * wording for its checklist (format.research.sentences), so a chunk reads like the facts a reviewer
 * already sees. */
function chunksFromResearch(payload, format) {
  const chunks = [];
  const summaryText = [payload.episodeTitle, payload.summary].filter(Boolean).join(": ");
  if (summaryText) chunks.push({ castawayName: null, chunkType: "summary", text: summaryText });
  for (const entry of payload.castaways || []) {
    const notes = format.research.sentences(entry);
    if (!notes.length) continue;
    chunks.push({ castawayName: entry.name, chunkType: "castaway_note", text: `${entry.name}: ${notes.join("; ")}.` });
  }
  return chunks;
}

/** Embeds and stores one episode's chunks. Replaces existing rows for the same
 * (show, season, episode, chunk_type, castaway) rather than accumulating -- a re-research (--force)
 * re-embeds cleanly rather than leaving stale chunks behind to compete in search. */
async function storeChunksForEpisode(pool, { showId, season, episodeNumber, format }, payload) {
  const chunks = chunksFromResearch(payload, format);
  if (!chunks.length) return { stored: 0 };

  const vectors = await embedTexts(chunks.map((c) => c.text), "document");
  for (let i = 0; i < chunks.length; i++) {
    await pool.query(
      `INSERT INTO episode_text_chunks (show_id, season_number, episode_number, castaway_name, chunk_type, text, embedding, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (show_id, season_number, episode_number, chunk_type, COALESCE(castaway_name, ''))
       DO UPDATE SET text = EXCLUDED.text, embedding = EXCLUDED.embedding, model = EXCLUDED.model, created_at = now()`,
      [showId, season, episodeNumber, chunks[i].castawayName, chunks[i].chunkType, chunks[i].text, `[${vectors[i].join(",")}]`, EMBED_MODEL]
    );
  }
  return { stored: chunks.length };
}

/**
 * Semantic search, scoped to one episode: embeds `query` and returns the closest stored chunks by
 * cosine similarity, best first. Returns `{ hasResearch, matches }` -- `hasResearch` is false only
 * when this episode has no chunks at all (nobody has researched it yet), which is a different, more
 * useful answer than "found nothing relevant" for a caller deciding what to tell a commissioner.
 */
async function searchChunks(pool, { showId, season, episodeNumber, query, limit = 3 }) {
  // Only this model's vectors: another model's live in a different space, and comparing across them
  // returns confident nonsense rather than an error.
  const { rows: any } = await pool.query(
    "SELECT 1 FROM episode_text_chunks WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND model=$4 LIMIT 1",
    [showId, season, episodeNumber, EMBED_MODEL]
  );
  if (!any.length) return { hasResearch: false, matches: [] };

  const [queryVector] = await embedTexts([query], "query");
  const { rows } = await pool.query(
    `SELECT castaway_name AS "castawayName", chunk_type AS "chunkType", text,
            1 - (embedding <=> $4::vector) AS similarity
       FROM episode_text_chunks
      WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND model=$6
      ORDER BY embedding <=> $4::vector
      LIMIT $5`,
    [showId, season, episodeNumber, `[${queryVector.join(",")}]`, limit, EMBED_MODEL]
  );
  return {
    hasResearch: true,
    matches: rows.map((r) => ({ ...r, similarity: Number(r.similarity), confidence: confidenceFor(Number(r.similarity)) })),
  };
}

/**
 * The one call a "suggested answer" route needs: searches for `question`, and reports the single
 * best match with a confidence label, or explains why there isn't one -- 'no-research' (nobody has
 * researched this episode) vs. 'unconfident' (there's research, but nothing matched well enough to
 * trust). Never returns an answer without also returning what backs it, and never returns a
 * confidence label for a match that didn't clear the floor -- see confidenceFor.
 */
async function suggestAnswer(pool, { showId, season, episodeNumber, question }) {
  // "Has this episode been researched?" is answered by episode_research, NOT by whether chunks exist.
  // Embedding is a best-effort step after research, so research can exist with no chunks (it failed,
  // or ran before search existed, or under an older embedding model) -- and reporting that as "no
  // research has been run" was simply wrong. Index it now instead, from the stored answers; if that
  // fails, the error says why rather than pretending nothing was researched.
  const { rows: researched } = await pool.query(
    `SELECT er.payload, er.provenance, s.format FROM episode_research er JOIN shows s ON s.id = er.show_id
      WHERE er.show_id=$1 AND er.season_number=$2 AND er.episode_number=$3`,
    [showId, season, episodeNumber]
  );
  if (!researched.length) return { status: "no-research", answer: null, confidence: null, castawayName: null, similarity: null };
  const { rows: indexed } = await pool.query(
    "SELECT 1 FROM episode_text_chunks WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND model=$4 LIMIT 1",
    [showId, season, episodeNumber, EMBED_MODEL]
  );
  if (!indexed.length) {
    try {
      // Worded by the format the answers were asked under.
      const format = Formats.formatFor((researched[0].provenance && researched[0].provenance.format) || researched[0].format);
      await storeChunksForEpisode(pool, { showId, season, episodeNumber, format }, researched[0].payload);
    } catch (e) {
      throw new Error(`This episode has been researched, but it couldn't be indexed for search: ${e.message}`);
    }
  }

  const { hasResearch, matches } = await searchChunks(pool, { showId, season, episodeNumber, query: question, limit: 1 });
  if (!hasResearch) {
    // Researched, indexed, and still nothing: every castaway was quiet and there was no summary.
    return { status: "unconfident", answer: null, confidence: null, castawayName: null, similarity: null };
  }
  const top = matches[0];
  if (!top || !top.confidence) {
    return {
      status: "unconfident",
      answer: null,
      confidence: null,
      castawayName: top ? top.castawayName : null,
      similarity: top ? top.similarity : null,
    };
  }
  return { status: "ok", answer: top.text, confidence: top.confidence, castawayName: top.castawayName, similarity: top.similarity };
}

module.exports = {
  embedTexts,
  chunksFromResearch,
  storeChunksForEpisode,
  searchChunks,
  suggestAnswer,
  confidenceFor,
  CONFIDENCE_THRESHOLDS,
  EMBED_MODEL,
  DIMENSIONS,
};
