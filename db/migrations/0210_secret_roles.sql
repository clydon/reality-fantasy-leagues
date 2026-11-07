-- Secret roles among the players (docs/PLAN-start-a-game-gpt.md step A14 part 4; game-spec schema.js `score.roles`): a draft whose
-- spec deals some of its seats a secret role (dealt at random once the game starts: its first episode has locked or has results)
-- keeps the deal here, one row a game: the seed it was dealt from, the seats it was dealt among and the seats given the role. The
-- first read or write after the game starts deals it (src/lib/server/secret-roles.ts, StateLogic.SecretRoleLogic.deal), the
-- insert racing nobody (ON CONFLICT DO NOTHING, then read back), so a deal is made once and never again: a seat joining later holds
-- no role, and one leaving keeps its own.
--
-- Kept out of the league's state on purpose: every route returns the state wholesale, so a role kept there would be readable from
-- anyone's Network tab (0004's reason for blind_draft_picks). Each seat is told its own role (and, with the spec's `mates`, who else
-- has it) by the roles route; only at the reveal (the game's end, or the episode its spec names, once that episode has results) is
-- the deal stamped on the state (state.secretRoles), as public as those results.
--
--   seed      the deal's own seed (the order it deals the seats in: SecretRoleLogic.deal)
--   seats     the seats dealt among (players in leagues.state), as the deal found them
--   holders   the seats given the role, each one of `seats`
--   role      the role's name as the spec said it when dealt (its words)
--
-- Additive: a table of its own, read a game at a time (its primary key is the league).
CREATE TABLE secret_role_deals (
  league_id UUID PRIMARY KEY REFERENCES leagues(id) ON DELETE CASCADE,
  seed TEXT NOT NULL CHECK (char_length(seed) BETWEEN 1 AND 100),
  seats JSONB NOT NULL CHECK (jsonb_typeof(seats) = 'array' AND octet_length(seats::text) <= 20000),
  holders JSONB NOT NULL CHECK (jsonb_typeof(holders) = 'array' AND octet_length(holders::text) <= 4000),
  role TEXT NOT NULL CHECK (char_length(role) BETWEEN 1 AND 40),
  dealt_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
