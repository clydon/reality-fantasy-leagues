-- Losing fire-making now costs a point (-1: less than being voted out's -3 -- reaching the final four
-- is something -- but a loss; winning it is the new +2). Set outright in every Survivor league, as
-- 0036 did for the endgame: no live league had reached the final four (agreed with the owner).
-- The new categories (won fire-making, chosen for a reward, learned of an advantage) need nothing
-- here: a league without a stored value uses the default.
UPDATE leagues
   SET state = jsonb_set(state, '{settings,eventPoints,lostFireMaking}', to_jsonb(-1))
 WHERE COALESCE(state->'settings'->>'showFormat', 'survivor') = 'survivor'
   AND state->'settings' ? 'eventPoints';
