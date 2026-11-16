-- Watching a sports game as if live (the design round's step 7, the user's missed game: "I can watch a recording to pretend I'm
-- live"): a game someone chose to watch later keeps its score and result hidden from them on every device until they say they've
-- watched it (src/lib/server/sports/recordings.ts). A row while they're watching it; deleted when they've watched it.
CREATE TABLE IF NOT EXISTS sports_recordings (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  game_id text NOT NULL,
  league text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);
