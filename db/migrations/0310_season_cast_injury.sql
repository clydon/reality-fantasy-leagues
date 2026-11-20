-- A sport's player's injury, as their roster says it now (docs/PLAN-sports-ready.md step 1.5; sports/cast.ts, refreshed by the daily
-- job's roster refresh). Additive:
--
--   season_cast.injury   { code, status, date } from ESPN's roster (`injuries[0]`): code a short tag ("Q", "D", "O", "IR"; another
--                        status as ESPN words it), status its words ("Questionable", "Injured Reserve"), date when ESPN noted it. NULL
--                        when the roster lists none (or for a show's cast). Read per request into a game's state (cast-props.ts:
--                        state.castInjuries), never copied into a league; shown by the design round (Phase 4.1/4.2).
ALTER TABLE season_cast ADD COLUMN injury JSONB;
