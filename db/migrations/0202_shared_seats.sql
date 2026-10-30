-- A team two people share (docs/PLAN-start-a-game-gpt.md step A10 part 4b). A seat (league_memberships.player_id, a player in
-- leagues.state) held at most one account; a game whose spec shares its seats (extras.seats, settings.seatPeople) lets up to
-- that many hold one, each joining by an invite to the seat (src/lib/server/join-league.ts).
--
--   seat_slot  which of a seat's accounts this is: 0 the seat's first (every join until now, and every join that takes a seat
--              of its own), 1 and up the people who joined to share it (the lowest free one). UNIQUE(league_id, player_id,
--              seat_slot) takes the place of UNIQUE(league_id, player_id), so a seat still can't take a second account by
--              accident: only a join that means to share it picks another slot. An account still has one seat a league
--              (UNIQUE(league_id, user_id) stays).
--
-- Additive for every existing row (all slot 0, one a seat as before). The new unique's index serves lookups by
-- (league_id, player_id), as the old one's did.
ALTER TABLE league_memberships ADD COLUMN seat_slot SMALLINT NOT NULL DEFAULT 0 CHECK (seat_slot >= 0);
ALTER TABLE league_memberships DROP CONSTRAINT league_memberships_league_id_player_id_key;
ALTER TABLE league_memberships ADD CONSTRAINT league_memberships_seat_key UNIQUE (league_id, player_id, seat_slot);

-- seat_moves: who made a shared seat's latest move of each kind (src/lib/server/shared-seats.ts recordSeatMove), where nothing
-- else records it (a lineup, a pick, a group slot, a side bet's guess, finale picks, a blind sheet, a draft pick; waiver claims,
-- answers and keepers record theirs already). Written only on a seat two or more accounts hold, so empty for every other game.
--
--   kind        lineup | pick | groupSlot | prediction | finale | sheet | draft
--   episode_id  the episode it was for (an id in leagues.state.episodes), '' for a move that isn't an episode's
--   user_id     who made it (null once their account is deleted)
CREATE TABLE seat_moves (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  episode_id TEXT NOT NULL DEFAULT '',
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, player_id, kind, episode_id)
);
