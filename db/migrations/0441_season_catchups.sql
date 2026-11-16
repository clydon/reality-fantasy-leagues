-- The catch-up (docs/PLAN-cast-properties.md chunk 6c; src/lib/server/catch-up.ts): a season that was played before cast
-- properties, bios and holdings existed is asked again by our bot, by itself, in order: its show (the rulebook's properties and
-- research questions), its cast (people's details), then each aired episode. Each episode's answer is a source of its own
-- ('catchup') beside the original, which stays as it was; one that would move any game's score waits for the desk.
-- Additive, plus one data step: the seasons that catch up after this deploys are queued here (the user, 2026-11-16: "the shows
-- that are on the prod app, survivor 51, traitors, the challenge, below deck"). Renumber at merge if another branch took 0441.
--
--   season_catchups  one per season: the step it's on (show, cast, then episodes), tries at the show or cast step and why it
--                    stopped, stuck_at after its last try (Try again clears it), done_at once every aired episode is in.
--   catchup_episodes one per aired episode once the season reaches its episodes: they're asked side by side (the user,
--                    2026-11-16: "parallel bots"), each with its own tries, until it's sent, held or stopped.
--   catchup_holds    an episode's answer that would change scores: what it says, which games and players move and by how much
--                    (`moves`), until the desk sends it or leaves it out.
CREATE TABLE season_catchups (
  season_id UUID PRIMARY KEY REFERENCES show_seasons(id) ON DELETE CASCADE,
  step TEXT NOT NULL DEFAULT 'show' CHECK (step IN ('show', 'cast', 'episodes')),
  tries INTEGER NOT NULL DEFAULT 0,
  asking_at TIMESTAMPTZ,
  tried_at TIMESTAMPTZ,
  message TEXT,
  stuck_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX season_catchups_open ON season_catchups (tried_at) WHERE done_at IS NULL AND stuck_at IS NULL;

CREATE TABLE catchup_episodes (
  season_id UUID NOT NULL REFERENCES season_catchups(season_id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  -- waiting (to ask, or to ask again after a failed try), sent, held (catchup_holds), stopped (its last try failed).
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'sent', 'held', 'stopped')),
  tries INTEGER NOT NULL DEFAULT 0,
  asking_at TIMESTAMPTZ,
  tried_at TIMESTAMPTZ,
  message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, episode_number)
);
CREATE INDEX catchup_episodes_waiting ON catchup_episodes (season_id) WHERE status = 'waiting';

CREATE TABLE catchup_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES show_seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  -- The answer as research read it (its own answers, provenance, the cast it was asked about) and the facts it files.
  answer JSONB NOT NULL,
  facts JSONB NOT NULL,
  -- [{ league, game, kind, players: [{ player, before, after }] }]: no names stored here beyond what the leagues already hold.
  moves JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  decision TEXT CHECK (decision IN ('sent', 'left')),
  CHECK ((decided_at IS NULL) = (decision IS NULL))
);
-- One waiting per episode: a newer try replaces the one before.
CREATE UNIQUE INDEX catchup_holds_waiting ON catchup_holds (season_id, episode_number) WHERE decided_at IS NULL;

-- Its answers are a source like the bot's scheduled runs, under a name of their own.
ALTER TABLE episode_research DROP CONSTRAINT episode_research_source_check;
ALTER TABLE episode_research ADD CONSTRAINT episode_research_source_check
  CHECK (source IN ('combined', 'paste', 'quick', 'hand', 'bot', 'autopilot', 'tiebreak', 'catchup'));

-- The seasons that catch up: the four shows on the app (by slug: production's The Traitors is 'the-traitors', a local copy's
-- may be 'the-traitors-us'), each season with a game that isn't deleted or archived, and each show's newest season.
-- scripts/catch-up-rehearse.js runs this statement again (it reads it from here), so keep it one statement ending in DO NOTHING.
INSERT INTO season_catchups (season_id)
SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
 WHERE s.slug IN ('survivor', 'the-traitors', 'the-traitors-us', 'the-challenge', 'below-deck')
   AND (EXISTS (SELECT 1 FROM leagues l
                 WHERE l.deleted_at IS NULL AND l.solo IS NULL AND l.name NOT LIKE 'zt%'
                   AND COALESCE(l.state->'settings'->>'archivedAt', '') = ''
                   AND l.state->'settings'->>'showId' = s.slug AND l.state->'settings'->>'wikiSeason' = ss.season_number::text)
        OR ss.season_number = (SELECT max(x.season_number) FROM show_seasons x WHERE x.show_id = ss.show_id))
ON CONFLICT DO NOTHING;
