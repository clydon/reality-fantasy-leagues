-- Your profile and your AI (docs/PLAN-new-design.md step 15 part 1). Additive; classic reads none of it.
--
-- user_settings.colour: the colour your face is on, one of src/lib/people.ts PALETTE ("#35b5a5"); NULL is the one your id
-- picks, as every face had before. user_settings.ai: the AI the Ask an AI sheets open (Your AI for results); NULL is ChatGPT,
-- the recommended one. Both go in the backups with user_settings.
ALTER TABLE user_settings ADD COLUMN colour TEXT CHECK (colour ~ '^#[0-9a-f]{6}$');
ALTER TABLE user_settings ADD COLUMN ai TEXT CHECK (ai IN ('chatgpt', 'grok', 'ask', 'copy'));

-- Your picture: one small square image (made 256 by 256 in the browser, ~10-30 KB), read only through
-- GET /api/people/[id]/picture?v=<updated_at>, which a browser keeps for good (a new picture is a new version). Not in the
-- backups: it's a face, not the game, and its owner can choose it again.
CREATE TABLE user_pictures (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  picture BYTEA NOT NULL CHECK (octet_length(picture) <= 102400),
  type TEXT NOT NULL CHECK (type IN ('image/jpeg', 'image/webp', 'image/png')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
