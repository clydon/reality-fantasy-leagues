-- Live previews' registry (docs/PLAN-preview-release.md, steps 3, 4 and 8a), in the preview service's own database: serverless
-- instances don't share memory, so whichever one answers reads the preview here. Made on the app's own database too, by the same
-- runner, and empty there: the app never makes a preview itself.
--   live_previews         one per preview: whose (owner_key, an opaque hash of the person's id, never the id), which game at which
--                         mark (game_key, so the same game reopens), its made-up viewer, its story as it fills in, its copies (to
--                         remove them), and until when (expires_at; kept_until once it's kept while they make the game).
--   live_preview_entries  the way into a preview's story on the preview host: a token used once, kept as its hash, minutes long.
CREATE TABLE live_previews (
  id UUID PRIMARY KEY,
  owner_key TEXT NOT NULL,
  game_key TEXT,
  viewer_user_id TEXT NOT NULL,
  story JSONB NOT NULL,
  copies JSONB NOT NULL DEFAULT '[]'::jsonb,
  complete BOOLEAN NOT NULL DEFAULT false,
  failed TEXT,
  kept_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX live_previews_owner ON live_previews (owner_key);
CREATE INDEX live_previews_expires ON live_previews (expires_at);

CREATE TABLE live_preview_entries (
  token_hash TEXT PRIMARY KEY,
  preview_id UUID NOT NULL REFERENCES live_previews (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
