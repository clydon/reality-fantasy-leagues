-- An episode looked up already, asked again (docs/PLAN-maker-scoring.md step 5): after the maker of a game adds a moment with a
-- question of its own (src/lib/server/maker-scoring.ts), the episodes looked up before it are asked again, for just what's new
-- or for everything. Additive.
--
--   research_asks.mode   null: its first ask (the whole checklist, as before). 'missing': only the questions its stored answers
--                        have nothing for, worked out when it runs (so a question added meanwhile comes too). 'full': the whole
--                        checklist again. Either is filled into the stored answers (db/bot-research.js runJob).
ALTER TABLE research_asks ADD COLUMN mode TEXT CHECK (mode IN ('missing', 'full'));
