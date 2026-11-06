-- A shared game's two holders (docs/PLAN-start-a-game-gpt.md, the Decisions table's "A shared game's two holders", the user's
-- rule of 2026-11-06): someone who goes home is owed a replacement on every team that held them; one replacing them no longer
-- settles it for the others. Every exit a game had already played stays as it played out, so no past loss is owed again and no
-- standings move backwards.
--
-- So each existing game gets its cutover, settings.perHolderFrom: the first episode it hasn't played, the latest episode with
-- results plus one (state-logic.js WaiverLogic.cutoverAt, which this mirrors; EpisodeLogic.hasResults says what counts as
-- results). A game at your own pace (settings.ownPace) takes the furthest any seat has played: a seat still catching up, its mark
-- (lateJoin.seenThrough, no further than the latest with results); any other seat, the latest. An exit before the cutover keeps
-- the old rule (WaiverLogic.replacedFor); from it on, per holder. A game made after this has no cutover: per holder throughout.
--
-- Written once, only on a league without one (safe however it meets a league), and never moved after: nothing in the app writes it.

WITH eps AS (
  SELECT l.id,
         COALESCE(MAX(CASE WHEN jsonb_typeof(e->'number') = 'number' THEN floor((e->>'number')::numeric) END) FILTER (WHERE
           COALESCE(e->'noExit', 'false'::jsonb) NOT IN ('false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb)
           OR (jsonb_typeof(e->'events') = 'array' AND jsonb_array_length(e->'events') > 0)
           OR (jsonb_typeof(e->'scoringEvents') = 'array' AND jsonb_array_length(e->'scoringEvents') > 0)
           OR (jsonb_typeof(e->'exiled') = 'array' AND jsonb_array_length(e->'exiled') > 0)
           OR (jsonb_typeof(e->'roles') = 'array' AND jsonb_array_length(e->'roles') > 0)
           OR (jsonb_typeof(e->'groups') = 'array' AND jsonb_array_length(e->'groups') > 0)
         ), 0) AS latest
  FROM leagues l
  LEFT JOIN LATERAL jsonb_array_elements(CASE jsonb_typeof(l.state->'episodes') WHEN 'array' THEN l.state->'episodes' ELSE '[]'::jsonb END) e ON true
  WHERE jsonb_typeof(l.state->'settings') = 'object' AND NOT (l.state->'settings' ? 'perHolderFrom')
  GROUP BY l.id
),
cut AS (
  SELECT eps.id,
         CASE WHEN COALESCE(l.state->'settings'->'ownPace', 'false'::jsonb) NOT IN ('false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb)
           THEN GREATEST(0, COALESCE((
             SELECT MAX(CASE
               WHEN COALESCE(p->'lateJoin'->'catchingUp', 'false'::jsonb) NOT IN ('false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb)
                 AND jsonb_typeof(p->'lateJoin'->'seenThrough') = 'number'
                 AND (p->'lateJoin'->>'seenThrough')::numeric = floor((p->'lateJoin'->>'seenThrough')::numeric)
               THEN LEAST((p->'lateJoin'->>'seenThrough')::numeric, eps.latest)
               ELSE eps.latest END)
             FROM jsonb_array_elements(CASE jsonb_typeof(l.state->'players') WHEN 'array' THEN l.state->'players' ELSE '[]'::jsonb END) p
           ), 0)) + 1
           ELSE eps.latest + 1 END AS at
  FROM eps JOIN leagues l ON l.id = eps.id
)
UPDATE leagues l
SET state = jsonb_set(l.state, '{settings,perHolderFrom}', to_jsonb(cut.at::int))
FROM cut
WHERE l.id = cut.id;
