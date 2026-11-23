-- The victory lap (docs/PLAN-sports-couch.md C3; docs/design-round/victory-lap-spec.md): after a couch member's team wins, that fan's
-- one prompt to post a GIF and a line to the league's room (the game's thread) and the couch's feed. A row a person, couch and game:
-- the lap they posted (its room message) or their Not this time (skipped), so the prompt ends on every phone. The final that earned it
-- is kept with it (the team's and the opponent's names and scores at the final), so a lap always wears its result. Deleting the room
-- message takes the lap with it.
CREATE TABLE IF NOT EXISTS sports_laps (
  couch_id uuid NOT NULL REFERENCES couches(id) ON DELETE CASCADE,
  league text NOT NULL CHECK (length(league) <= 64),
  game_id text NOT NULL CHECK (length(game_id) <= 64),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  team_id text NOT NULL CHECK (length(team_id) <= 64),
  message_id uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  skipped boolean NOT NULL DEFAULT false,
  team jsonb NOT NULL,
  opponent jsonb NOT NULL,
  score int[] NOT NULL CHECK (array_length(score, 1) = 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (couch_id, game_id, user_id),
  CHECK (skipped OR message_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sports_laps_couch_created ON sports_laps (couch_id, created_at);
CREATE INDEX IF NOT EXISTS sports_laps_message ON sports_laps (message_id) WHERE message_id IS NOT NULL;
