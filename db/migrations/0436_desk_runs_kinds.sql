-- desk_runs' kinds, every one (the main folder, at the engine's A13 merge, 2026-11-05). Two branches each set this check with their
-- own list: 0432 (What scores: 'rulebook', 'scores') and 0204 (A13 part 2b: 'facts'). Which list a database ended with depended
-- on the order it ran them in: production ran 0432 first, so 0204 lists every kind; a database built from empty runs 0204 before
-- desk_runs exists and ends with 0432's list, without 'facts'. This sets the full list everywhere. A later migration that adds a
-- kind lists them all again.
ALTER TABLE desk_runs DROP CONSTRAINT IF EXISTS desk_runs_kind_check;
ALTER TABLE desk_runs ADD CONSTRAINT desk_runs_kind_check
  CHECK (kind IN ('quick', 'full', 'schedule', 'trivia', 'bingo', 'cast', 'rulebook', 'scores', 'facts'));
