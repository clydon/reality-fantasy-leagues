-- A rotating host's questions (docs/PLAN-start-a-game-gpt.md step A14 part 6; game-spec schema.js `card.from: 'host'`): each episode
-- one of the game's seats, in turn, writes the card's lines from its list of the show's moments, and everyone answers them as the
-- questions on the card. The host's lines are kept here, one row an episode, while they write them: who wrote them and which
-- moments, in their order (filed false). Once the host's time is up (the spec's hours before the episode airs, or when it locks or
-- has results), the first read or write files what the card plays (src/lib/server/host-cards.ts, StateLogic.HostLogic.file): the
-- host's lines, if whoever wrote them still hosts it by the data then, else the fallback (filed true, `how` saying which, player_id
-- the episode's host either way), and from then on it stands: lines written after it change nothing, so a line answered never
-- changes its moment.
--
-- Kept out of the league's state on purpose while they're being written: every route returns the state wholesale, so lines kept
-- there would be readable from anyone's Network tab before they're out (0004's reason for blind_draft_picks). Once filed they're
-- stamped on the league's episode (`episode.cardChoice`: { moments, host, how }), as public as the air times, for everyone to answer.
--
--   episode    the episode the card is for (its number)
--   player_id  its host (a seat in leagues.state); filed with how 'fallback', null when nobody hosted it
--   moments    the host's lines, the moments' ids in their order; filed with how 'fallback', none
--   filed      false while the host can still write; true once the episode's card is settled
--   how        once filed: 'host' (the host's lines stood) or 'fallback'
--
-- Additive: a table of its own, read a game at a time (its primary key leads with the league).
CREATE TABLE host_cards (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode > 0),
  player_id TEXT CHECK (player_id IS NULL OR char_length(player_id) BETWEEN 1 AND 100),
  moments TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(moments) <= 12),
  filed BOOLEAN NOT NULL DEFAULT false,
  how TEXT CHECK (how IS NULL OR how IN ('host', 'fallback')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, episode),
  CHECK (filed OR (player_id IS NOT NULL AND cardinality(moments) > 0 AND how IS NULL)),
  CHECK (NOT filed OR how IS NOT NULL)
);
