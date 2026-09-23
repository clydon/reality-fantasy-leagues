-- This repo's own app schema (leagues/memberships/chat/reports), living in the same
-- reality_fantasy_leagues Postgres database as Better Auth's own tables (user/session/account/
-- verification, managed separately by `npx @better-auth/cli migrate`, never by this file).
-- Shape ported from SurvivorDraft's db/migrations/0001_init.sql + 0003_chat.sql + 0005_issue_reports.sql
-- (structure only, not content -- this is a fresh database, no data migrated from there).
--
-- One real difference from that source: there is no `users` table here at all -- Better Auth's
-- "user" table (double-quoted below since "user" is a reserved word) IS the identity table, and
-- its id column is TEXT (Better Auth's own id format), not UUID, so every foreign key to it below
-- is TEXT rather than the UUID SurvivorDraft's schema uses for the equivalent reference.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  join_code TEXT NOT NULL UNIQUE,
  state JSONB NOT NULL,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE league_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,   -- matches an id inside leagues.state->'players'
  role TEXT NOT NULL CHECK (role IN ('commissioner','member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id),
  UNIQUE(league_id, player_id)
);
CREATE INDEX idx_league_memberships_user ON league_memberships(user_id);
CREATE INDEX idx_league_memberships_league ON league_memberships(league_id);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'message' CHECK (type IN ('message','system')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX idx_chat_messages_league ON chat_messages(league_id, created_at);

CREATE TABLE chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
CREATE INDEX idx_chat_reactions_message ON chat_reactions(message_id);

-- username and league_name are denormalized snapshots (not joined live) so a report stays
-- readable even if the account or league is later deleted -- same reasoning as SurvivorDraft's.
CREATE TABLE issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  league_id UUID REFERENCES leagues(id) ON DELETE SET NULL,
  league_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('issue','feature')),
  message TEXT NOT NULL,
  route TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_issue_reports_created ON issue_reports(created_at DESC);
