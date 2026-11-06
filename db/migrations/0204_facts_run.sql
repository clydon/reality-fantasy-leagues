-- Episode facts' own short run (docs/PLAN-start-a-game-gpt.md step A13 part 2b, db/facts-research.js): after the morning's full
-- run, bot research asks on their own the episode facts the episode's stored answer isn't sure of (who says the title quote), and
-- files the answer into that stored answer (episode_research, source 'combined': its payload's episodeFacts, with provenance's
-- factsRun saying when). Its run rows are a kind of their own, as trivia's and bingo's are, and the desk's Run now queues one.
--
-- desk_runs (0424) sorts after this file, so a database built from empty doesn't have it yet here: its check is widened only where
-- the table exists (production, and every database made from a copy of it), and 0426, which sets the check a database built from
-- empty ends with, lists 'facts' too.
--
-- At the merge (2026-11-05): production had already run 0432, which added 'rulebook' and 'scores' to desk_runs' check, so this
-- file lists every kind (dropping those two would refuse production's rows, or the What scores runs after it); 0436 sets the
-- same list where a database ran the files in another order.
--
-- Additive: two kind checks widened.
ALTER TABLE bot_research_runs DROP CONSTRAINT bot_research_runs_kind_check;
ALTER TABLE bot_research_runs ADD CONSTRAINT bot_research_runs_kind_check
  CHECK (kind IN ('quick', 'full', 'schedule', 'tiebreak', 'rulebook', 'trivia', 'bingo', 'facts'));

DO $$
BEGIN
  IF to_regclass('public.desk_runs') IS NOT NULL THEN
    ALTER TABLE desk_runs DROP CONSTRAINT IF EXISTS desk_runs_kind_check;
    ALTER TABLE desk_runs ADD CONSTRAINT desk_runs_kind_check
      CHECK (kind IN ('quick', 'full', 'schedule', 'trivia', 'bingo', 'cast', 'rulebook', 'scores', 'facts'));
  END IF;
END $$;
