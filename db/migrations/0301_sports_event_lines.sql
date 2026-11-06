-- A team game's final, kept once it's final (docs/PLAN-start-a-game-gpt.md track L, L3 part 1; src/lib/sports/final.ts
-- storedGame, src/lib/server/sports/finals.ts). Additive. Asked again from the provider if lost (as sports_events is).
--
--   sports_events.lines     everyone's counts at the final, in the sport's keys ({ "4431679": { "PTS": 32, "FGM": 11, ... } }: the
--                           plays added up with the final's correction, so ESPN's own box score; derived stats are worked out at
--                           the read), a team's own (football's defense) under its id. '{}' when the provider had none two days
--                           after the final (it isn't coming). Read by a game scored by stats and by the sports settles.
--   sports_events.people    each one's team and position as the box has them ({ "4431679": { "team": "20", "position": "G" } }).
--   sports_events.lines_at  when they were kept; never written again after.
ALTER TABLE sports_events ADD COLUMN lines JSONB, ADD COLUMN people JSONB, ADD COLUMN lines_at TIMESTAMPTZ;
