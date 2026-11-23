-- A league's art from your own picture (docs/design-round/league-art-spec.md; the user, 2026-11-23: "Uploading your own picture:
-- bypass this guardrail for now and implement it"). One picture per person per league, made 1280 by 720 in the browser (a JPEG,
-- its metadata gone with the re-draw); shown to its uploader and to anyone on a couch with them (as faces are: user_pictures), so
-- a couch owner's picture can be the couch's art. Choosing it is user_settings.league_art's 'upload' for that league.
-- version: when it was set (ms), on its link so a browser keeps each version for good. Not backed up, like faces.
CREATE TABLE league_art_pictures (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  league TEXT NOT NULL CHECK (length(league) <= 80),
  picture BYTEA NOT NULL CHECK (octet_length(picture) <= 409600),
  type TEXT NOT NULL CHECK (type IN ('image/webp', 'image/png', 'image/jpeg')),
  version BIGINT NOT NULL,
  PRIMARY KEY (user_id, league)
);
