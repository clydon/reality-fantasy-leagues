-- Mid-season waivers, phase 4 (docs/PLAN-midseason-waivers.md): every league with Pickups or
-- Add/drops on runs them as waivers now. The live one-at-a-time Pickups and Swap rounds are gone, and
-- so is settings.midSeasonMode, the switch phases 1-3 used to try waivers on one league at a time.
--
-- Closes any round still open by dropping the keys only the rounds used. Nothing is lost:
--   * a pickup round's unused turns were never spent (a loss is only marked replaced when its pickup
--     is made), so whoever was still owed one claims it in the next waiver week;
--   * a swap round's remaining turns lapse, but anyone who hadn't swapped gets the add/drop week of
--     that same episode, and anyone who had can't add/drop again in it (WaiverLogic.addDropUsed counts
--     the round's swaps);
--   * midSeason.priority (the rolling order) carries on as the waiver order.
-- The first waiver week opens by itself, for the latest episode with results, on the league's next
-- load or write or the hourly job (db/waivers.js).
UPDATE leagues
SET state = state
  #- '{midSeason,replenish}'
  #- '{midSeason,trade}'
  #- '{midSeason,lastSwapAfterEpisode}'
  #- '{settings,midSeasonMode}'
WHERE state->'midSeason' ?| array['replenish', 'trade', 'lastSwapAfterEpisode']
   OR state->'settings' ? 'midSeasonMode';
