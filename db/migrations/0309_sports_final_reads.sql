-- A game's final, never zeroed silently and read again for corrections (docs/PLAN-sports-ready.md step 1.2; finals.ts saveFinals).
-- Additive:
--
--   sports_events.read_tries   how many times its counts were asked for and couldn't be read (no box score yet, or one the sport's
--                              reader threw on); reset when they're read.
--   sports_events.read_error   why the last read failed. Set on a final kept as none because nothing could be read two days on:
--                              the desk's Inbox lists it, and every run tries it again until it reads (then it's cleared).
--   sports_events.checked_at   when a kept final was last read again for a correction (about a day after it was kept, and before
--                              the next game of a season linking it); a changed answer is kept with a new lines_at, so every
--                              league's table follows (score.ts's stamp reads lines_at).
ALTER TABLE sports_events
  ADD COLUMN read_tries INT NOT NULL DEFAULT 0,
  ADD COLUMN read_error TEXT,
  ADD COLUMN checked_at TIMESTAMPTZ;
