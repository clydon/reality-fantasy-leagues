-- Survivor's endgame is now: every finalist (winner too) gets "Reached Final Tribal Council", plus
-- one "jury vote" event per vote received, plus a Sole Survivor bonus -- so how someone did at Final
-- Tribal scores, not just whether they won.

-- The jury count travels with the finalist's elimination decision (research's juryVotesReceived),
-- onto the league's elimination record (ep.events[].juryVotes) when applied.
ALTER TABLE season_decisions ADD COLUMN jury_votes INTEGER CHECK (jury_votes >= 0);

-- Every Survivor league moves to the new endgame values outright, plus "had an advantage used against
-- them" back to a penalty: the only live leagues hadn't revealed episode 2 when this shipped, so there
-- were no finale scores to disturb (agreed with the league's owner), and leaving old values in place
-- would have stacked them (the winner now also gets the finalist points). Scoring values only --
-- drafts, rosters and lineups are untouched. Survivor only: The Challenge and The Traitors have a
-- "finalist" of their own, unchanged (no cached showFormat = a pre-formats league = Survivor).
--   shared:    finalist 3, soleSurvivor 3, zeroJuryVotes -3, advantageTargeted -0.5
--   exclusive: finalist 2, soleSurvivor 1, zeroJuryVotes -2, advantageTargeted -0.5
UPDATE leagues
   SET state = jsonb_set(state, '{settings,eventPoints}',
         COALESCE(state->'settings'->'eventPoints', '{}'::jsonb)
         || CASE WHEN state->'settings'->>'ownershipMode' = 'shared'
                 THEN '{"finalist": 3, "soleSurvivor": 3, "zeroJuryVotes": -3, "advantageTargeted": -0.5}'::jsonb
                 ELSE '{"finalist": 2, "soleSurvivor": 1, "zeroJuryVotes": -2, "advantageTargeted": -0.5}'::jsonb END)
 WHERE COALESCE(state->'settings'->>'showFormat', 'survivor') = 'survivor'
   AND state->'settings' ? 'eventPoints';
