// Bingo's bank for a check (docs/PLAN-bingo-bank.md; migration 0146 bingo_squares): canned answers as an AI chat would paste them,
// and banks filed into a zt season through the real parse and store (db/bingo-research.js), so a check can deal cards without
// asking anyone. Refuses a season whose show isn't a zt- one, and a database that isn't local.
//
//   const bingo = require("./bingo-fixture");
//   bingo.squares({ likely: 10, maybe: 14, longshot: 6 })   -> [{ square, likelihood }], distinct Survivor-ish squares
//   bingo.squares({ likely: 3, maybe: 4, longshot: 1 }, "talk")   -> a talk show's
//   bingo.answer(list)                                     -> the chat's reply: a line of chatter and a ```json block
//   await bingo.up(pool, seasonId, episode | null, counts | list)   -> files that bank (null: the season's own), replacing it;
//                                                                     resolves its live squares [{ id, key, label, likelihood }]
//   await bingo.down(pool, seasonId)                       -> removes the season's banks (a zt season's own down takes them too)
//
// From a terminal, for looking at cards by hand on a zt season (new-fixture.js's ZT Survivor 51, say):
//   node scripts/dev-test/bingo-fixture.js up <seasonId> <episode|season> [likely maybe longshot]   (default 10 14 6)
//   node scripts/dev-test/bingo-fixture.js down <seasonId>
const B = require("../../db/bingo-research.js");

const SURVIVOR = {
  likely: [
    "Someone cries", "A chat at the water well", "Someone talks about home", "A slow-motion shot", "Rain at camp", "Tree mail arrives",
    "Whispering at Tribal", "Jeff laughs", "A close-up of a crab", "Someone says blindside", "A sunrise shot", "Someone naps on the beach",
    "A hug after a challenge", "Someone pleads at Tribal",
  ],
  maybe: [
    "Someone goes fishing", "The fire won't start", "Someone eats something gross", "Someone talks about their kids", "A medic checks someone",
    "A fake idol gets made", "Someone loses a shoe", "An animal at camp", "Someone swims in the ocean", "A storm rolls in", "Someone does yoga",
    "The shelter gets fixed", "Someone gets sunburnt", "A coconut gets cracked", "Someone counts votes out loud", "A night-time scramble",
    "Someone's hair gets cut", "A puzzle comes down to two",
  ],
  longshot: [
    "A shark in the water", "Someone dozes at Tribal", "Jeff tells someone off", "A rock draw", "Someone sings at camp", "A new tribe flag",
    "A mic falls off", "A drone shot of a turtle", "Someone hides in the jungle", "A tribe loses its fire",
  ],
};
const TALK = {
  likely: ["The host laughs at a joke", "A cold open", "The crowd cheers a cameo", "A pre-taped bit", "Someone breaks", "A musical guest"],
  maybe: ["A wig falls off", "The host plays an instrument", "A sketch runs long", "Someone flubs a line", "A political joke", "The band gets a shout-out"],
  longshot: ["An animal on stage", "A surprise reunion", "The host cries laughing", "A stage crew member on camera"],
};
const POOLS = { survivor: SURVIVOR, talk: TALK };

/** Distinct squares, `counts` of each likelihood, in order (so two banks of the same counts say the same): Survivor's, or a talk show's. */
function squares(counts, flavour = "survivor") {
  const pool = POOLS[flavour];
  return Object.entries(counts).flatMap(([likelihood, n]) => {
    if (n > pool[likelihood].length) throw new Error(`bingo-fixture has only ${pool[likelihood].length} ${flavour} ${likelihood} squares`);
    return pool[likelihood].slice(0, n).map((square) => ({ square, likelihood }));
  });
}

/** A chat's reply around a list of squares: some chatter, then the JSON in a code fence. */
const answer = (list) => `Here are your bingo squares!\n\n\`\`\`json\n${JSON.stringify({ squares: list }, null, 2)}\n\`\`\`\nHave fun watching.`;

async function zt(pool, seasonId) {
  const db = String(pool.options && pool.options.connectionString ? pool.options.connectionString : process.env.AUTH_DATABASE_URL || "");
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(db)) throw new Error("bingo-fixture runs against a local database only");
  const { rows } = await pool.query("SELECT s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  if (!rows[0] || !rows[0].slug.startsWith("zt-")) throw new Error(`bingo-fixture only touches zt seasons (${seasonId} is ${rows[0] ? rows[0].slug : "missing"})`);
}

/** Files a bank (`episode` null: the season's own) from counts or a list of squares, replacing that one. Resolves its live squares. */
async function up(pool, seasonId, episode, what) {
  await zt(pool, seasonId);
  const list = Array.isArray(what) ? what : squares(what);
  const { squares: parsed } = B.parseBingoAnswer(answer(list));
  await B.storeBank(pool, seasonId, episode, parsed);
  const { rows } = await pool.query(
    "SELECT id, label, likelihood FROM bingo_squares WHERE season_id = $1 AND episode IS NOT DISTINCT FROM $2 AND status = 'live' ORDER BY created_at, id",
    [seasonId, episode]
  );
  return rows.map((r) => ({ id: r.id, key: `b:${r.id}`, label: r.label, likelihood: r.likelihood }));
}

async function down(pool, seasonId) {
  await zt(pool, seasonId);
  await pool.query("DELETE FROM bingo_squares WHERE season_id = $1", [seasonId]);
}

module.exports = { POOLS, squares, answer, up, down };

if (require.main === module) {
  require("dotenv").config({ path: ".env.local", quiet: true });
  const { Pool } = require("pg");
  const [cmd, seasonId, which, ...n] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  (async () => {
    if (cmd === "up") {
      const [likely = 10, maybe = 14, longshot = 6] = n.map(Number);
      const live = await up(pool, seasonId, which === "season" ? null : Number(which), { likely, maybe, longshot });
      console.log(`[zt] bingo bank: ${live.length} squares for ${which === "season" ? "the season" : `episode ${which}`}`);
    } else if (cmd === "down") {
      await down(pool, seasonId);
      console.log("[zt] bingo banks removed");
    } else throw new Error("usage: bingo-fixture.js up <seasonId> <episode|season> [likely maybe longshot] | down <seasonId>");
  })()
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
