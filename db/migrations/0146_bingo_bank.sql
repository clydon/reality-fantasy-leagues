-- Bingo's bank (docs/PLAN-bingo-bank.md; db/bingo-research.js writes it, src/lib/server/bingo.ts deals from it). Additive.
--
-- A card's squares were the rulebook's scoring moments, settled by the season's results. Now they're things a couch shouts at the
-- TV ("It rains", "Someone goes fishing"), written by an AI for each episode before it airs and settled on the honour system: a
-- tick is your say it happened, and two on the couch saying so makes it true (calls.ts settleSays; alone on the couch, your word).
--
--   bingo_squares        a season's banks: `episode` N is that episode's, NULL the season's own (any episode without one of
--                        its own deals from it). `likelihood` is how often the square comes up: likely (most episodes), maybe
--                        (about every other), longshot (now and then); a card is dealt a mix of the three. Every square the
--                        answer wrote is kept: `status` 'live' when it passed its checks, 'dropped' with `note` saying why (the
--                        admin episode page shows both). A new bank for the same season and episode replaces that batch; a card
--                        already ticked keeps its squares (their labels are on the card), so nothing it said is lost.
--   bingo_square_flags   "This square's unfair": out of new deals once two people (or an admin) say so (step 4).
--   bingo_cards          + rerolls: new cards dealt yourself before your first tick (at most two). A card is kept once it has a
--                        tick; until then it's dealt again from the bank each read, from a seed that counts the rerolls, so a
--                        replaced bank deals everyone afresh and the same card shows on every device.
--                        + called_lines: lines you've called BINGO on (step 3), [{ line: 0-7 (bingo.ts LINES), at }].
CREATE TABLE bingo_squares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode INTEGER CHECK (episode > 0),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  likelihood TEXT NOT NULL CHECK (likelihood IN ('likely', 'maybe', 'longshot')),
  status TEXT NOT NULL CHECK (status IN ('live', 'dropped')),
  note TEXT,
  run_id UUID REFERENCES bot_research_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bingo_squares_season ON bingo_squares (season_id, episode);

CREATE TABLE bingo_square_flags (
  square_id UUID NOT NULL REFERENCES bingo_squares(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (square_id, user_id)
);

ALTER TABLE bingo_cards ADD COLUMN rerolls SMALLINT NOT NULL DEFAULT 0 CHECK (rerolls BETWEEN 0 AND 2);
ALTER TABLE bingo_cards ADD COLUMN called_lines JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(called_lines) = 'array');

-- The bot's bingo run (step 2) files its answer here as a run of its own kind.
ALTER TABLE bot_research_runs DROP CONSTRAINT bot_research_runs_kind_check;
ALTER TABLE bot_research_runs ADD CONSTRAINT bot_research_runs_kind_check
  CHECK (kind IN ('quick', 'full', 'schedule', 'tiebreak', 'rulebook', 'trivia', 'bingo'));
