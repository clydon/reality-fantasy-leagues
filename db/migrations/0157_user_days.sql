-- Couch points (the user, 2026-10-31; couch-standings.ts COUCH_POINTS): each day someone opens the app is a point on every couch
-- they're on. user_last_seen keeps only the last visit, so this keeps a row a day, stamped beside it (auth-helpers.ts
-- touchLastSeen), counted from now on. A day is Eastern's, as the rest of Couch points count them (couch-points.ts). Not backed
-- up, like user_last_seen.
CREATE TABLE user_days (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  PRIMARY KEY (user_id, day)
);
