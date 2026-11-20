-- The other positions a sport's player fills besides their roster's one (docs/PLAN-sports-ready.md step 2.3; sports/cast.ts, kept
-- current by the daily job's roster refresh). Additive:
--
--   season_cast.eligible   their league's rule (sports/index.ts eligibleFor: the sport's defaults' slots.eligible) over every
--                          position ESPN's roster lists them at: MLB's, the positions each has played, so a shortstop listed at
--                          second base fills 2B, and a two-way player listed as a starting pitcher fills SP and the pitchers' P.
--                          Positions, and across groups that position's group. NULL for none (the NBA's and NHL's rosters list one
--                          position; a show's cast). Read per request into a game's state (cast-props.ts: state.castEligible),
--                          never copied into a league; a lineup's slots read it (StateLogic.SlotLogic.fits).
ALTER TABLE season_cast ADD COLUMN eligible TEXT[];
