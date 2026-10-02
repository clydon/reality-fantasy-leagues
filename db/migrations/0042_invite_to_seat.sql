-- An invite can offer a particular seat: a commissioner hands a computer player (or any seat with no
-- account behind it) over to someone, who takes over its team, points and history when they accept
-- instead of joining as a new player. NULL is an ordinary invite. Same TEXT, no-foreign-key convention
-- as league_memberships.player_id, since players live in leagues.state.
ALTER TABLE league_invites ADD COLUMN player_id TEXT;
