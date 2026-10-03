-- Closing the "What's New" popup while a super-admin impersonated someone marked it seen on THEIR
-- account (user_settings.whats_new_seen), so they never got it themselves. /api/me/settings now
-- ignores that while impersonating; this repairs the accounts it already happened to.
--
-- Which ones: "Last active" (0032's user_last_seen) is stamped on every request a person makes
-- themselves -- at most a minute behind -- and never while they're impersonated, and the settings
-- route is the only thing that writes user_settings. So a row last written well after its owner's
-- last real request was written by someone viewing as them. (Someone who's been back since can't be
-- told apart this way; for them the popup simply stays dismissed.)
--
-- What they get back: seen through the newest release from before the day of their last real visit
-- (the app would have shown them anything older then), or nothing seen if they've never had one.
-- Releases from that day on show again -- a same-day one they did see may repeat, rather than one
-- they didn't being skipped. The release ids and dates are src/lib/whats-new.ts's RELEASES as of now.
WITH releases(id, released) AS (
  VALUES ('2026-10-01', DATE '2026-10-01'), ('2026-10-01b', DATE '2026-10-01'),
         ('2026-10-02', DATE '2026-10-02'), ('2026-10-02b', DATE '2026-10-02'), ('2026-10-02c', DATE '2026-10-02'),
         ('2026-10-02d', DATE '2026-10-02'), ('2026-10-02e', DATE '2026-10-02'), ('2026-10-03', DATE '2026-10-03')
),
affected AS (
  SELECT s.user_id, ls.last_seen_at
    FROM user_settings s LEFT JOIN user_last_seen ls ON ls.user_id = s.user_id
   WHERE s.whats_new_seen IS NOT NULL
     AND s.updated_at > COALESCE(ls.last_seen_at, '-infinity') + interval '5 minutes'
)
UPDATE user_settings s
   SET whats_new_seen = (SELECT max(r.id) FROM releases r WHERE r.released < a.last_seen_at::date)
  FROM affected a
 WHERE s.user_id = a.user_id;
