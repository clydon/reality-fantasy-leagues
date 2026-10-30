-- The desk's Bingo bank (docs/PLAN-desk-parity.md step 4, part 4c; src/lib/server/desk-bingo.ts). Additive.
--
--   shown_at, shown_by   an admin's Show it again: the square's back on new cards over the flags it had then. bingo.ts
--                        FLAGGED_OUT counts only flags from after it (two new ones take it out again); an admin's own
--                        flag still takes it out at once, as before. The desk's Hide it from new cards is that flag.
--   pasted_by            who pasted the bank this square is in (the desk's Paste squares), so the bank says who wrote it;
--                        a bot's bank has its run_id. Classic's paste leaves it empty ("Pasted").
ALTER TABLE bingo_squares
  ADD COLUMN shown_at TIMESTAMPTZ,
  ADD COLUMN shown_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN pasted_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
