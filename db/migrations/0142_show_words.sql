-- What a show calls one of its episodes (src/lib/game/show-words.ts): "Episode", a baseball series' "Game", F1's "Race". Read with
-- castaway_term (what it calls its people) for the show's tabs and every "Episode 4" a show's screens say.
--
-- Where it comes from, best first: Make it a game's research (the rulebook's "parts", make-game.ts saves it as it saves
-- castaway_term), else a sport's TV listing ("Game 4: Brewers at Rays" -> Game: add-show.ts), else the kind's word.
-- Backfilled here the same way, from what's already stored. A show nobody's researched that's a sport also gets "Player" for its
-- people rather than the old "Athlete" (most sports are team games; research, or the desk, says "Driver").
ALTER TABLE shows ADD COLUMN episode_term TEXT NOT NULL DEFAULT 'Episode' CHECK (length(episode_term) BETWEEN 1 AND 40);

-- A sport, from its listing's titles: the word most of its titled episodes start with, before a number.
WITH words AS (
  SELECT ss.show_id, substring(se.title FROM '^([A-Za-z]+) [0-9]+') AS word
    FROM season_episodes se JOIN show_seasons ss ON ss.id = se.season_id JOIN shows s ON s.id = ss.show_id
   WHERE s.kind = 'sport' AND se.title IS NOT NULL
), counted AS (
  -- Words that say when, not what ("Week 3", "Night 2"), never count (show-words.ts NOT_A_WORD).
  SELECT show_id, word, count(*) AS n, sum(count(*)) OVER (PARTITION BY show_id) AS titled,
         row_number() OVER (PARTITION BY show_id ORDER BY (lower(word) IN ('episode', 'ep', 'part', 'chapter', 'night', 'day', 'week', 'show', 'season', 'volume', 'vol', 'no')), count(*) DESC) AS rank
    FROM words GROUP BY show_id, word
)
UPDATE shows s SET episode_term = upper(left(c.word, 1)) || lower(substr(c.word, 2))
  FROM counted c
 WHERE c.show_id = s.id AND c.rank = 1 AND c.word IS NOT NULL AND c.n * 2 > c.titled
   AND lower(c.word) NOT IN ('episode', 'ep', 'part', 'chapter', 'night', 'day', 'week', 'show', 'season', 'volume', 'vol', 'no');

-- A sport with no such titles: the kind's word.
UPDATE shows SET episode_term = 'Event' WHERE kind = 'sport' AND episode_term = 'Episode';

-- Research wins: a season rulebook's "parts" (its latest season's).
UPDATE shows s SET episode_term = upper(left(x.word, 1)) || substr(x.word, 2)
  FROM (
    SELECT DISTINCT ON (ss.show_id) ss.show_id, trim(r.blocks->'parts'->>'singular') AS word
      FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id
     WHERE r.owner_kind = 'season' AND r.status <> 'archived' AND nullif(trim(r.blocks->'parts'->>'singular'), '') IS NOT NULL
     ORDER BY ss.show_id, ss.season_number DESC
  ) x
 WHERE x.show_id = s.id AND length(x.word) <= 40;

UPDATE shows SET castaway_term = 'Player' WHERE kind = 'sport' AND castaway_term = 'Athlete' AND set_up_at IS NULL;
