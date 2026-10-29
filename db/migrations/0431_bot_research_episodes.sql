-- Just this episode (the user, 2026-10-29): on the desk's Research, a run's sheet and Add a run say whether a change is for
-- "Every episode" (the season's schedule, show_seasons.bot_research_schedule, 0065) or "Episode N only". An episode's own
-- runs sit over the season's schedule for that episode alone: the bot's planner (db/bot-research.js slots) reads them for
-- that episode's runs (its results after it ends, trivia about it, bingo squares for it), and "Back to the season's
-- schedule" deletes the row.
--
--   bot_research_episodes   one per episode with runs of its own: the whole list (normalizeSchedule's shape), who set it
--                           and when. A change to every episode reaches it too (src/lib/server/desk-bot.ts).
--
-- Our usual runs (DEFAULT_SCHEDULE) become data too, with no migration: app_settings 'bot_usual' (0027), absent until the
-- desk's "Make this our usual"; a season with no schedule of its own (bot_research_schedule NULL) follows it.
--
-- Additive: a new table.
CREATE TABLE bot_research_episodes (
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL CHECK (episode_number > 0),
  schedule JSONB NOT NULL,
  updated_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, episode_number)
);
