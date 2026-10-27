-- Results looked up for a show you watch (src/lib/server/research-asks.ts): a show made a game that nobody plays a game on,
-- whose aired episodes have no results. Fill in what happened (episode-recaps.ts) asks for them along with its recaps. Each
-- episode is the bot's full research, run one at a time by the bot's clock (db/bot-research.js planAsks, run rows with slot
-- 'asked'), filed as the bot's own answer like a scheduled run's (bot-results.ts), so the season's stats count it. Whoever
-- asked hears as each one comes in. Additive.
--
--   research_asks   one per season and episode: who asked and when (asking again after it failed starts it over: asked_at is
--                   when its tries count from), and how it ended (done_at; ok, how many results it found, or why it didn't).
--                   A try is a bot_research_runs row (slot 'asked') started since asked_at; two tries, then it's given up.
CREATE TABLE research_asks (
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL CHECK (episode_number >= 1),
  asked_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at TIMESTAMPTZ,
  ok BOOLEAN,
  found INTEGER,
  message TEXT,
  PRIMARY KEY (season_id, episode_number)
);
CREATE INDEX research_asks_open ON research_asks (asked_at) WHERE done_at IS NULL;
CREATE INDEX research_asks_by ON research_asks (asked_by, asked_at);
