-- When each account last used the app (any authenticated request), for the admin Users table's
-- "Last active". Written by the server's session check at most once a minute per user, and never
-- for an admin impersonating them.
CREATE TABLE user_last_seen (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL
);
