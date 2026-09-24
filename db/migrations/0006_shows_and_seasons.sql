-- Admin-managed catalog of shows and their seasons.
--
-- Until now the only show was a hardcoded entry in state-logic.js's SHOWS registry
-- ({survivor: {id, name, castawayTerm, tribeTerm}}), which meant adding a second show needed a code
-- change and a deploy. This moves the catalog into the database so a super-admin can manage it from
-- the Admin tab.
--
-- state-logic.js's SHOWS stays, but only as the bootstrap default for a brand-new league's
-- settings.showId -- the rows here are the catalog of record. Keeping the game logic free of any DB
-- dependency is deliberate and load-bearing (that file is a fork of one the live app loads straight
-- into a browser with no bundler); nothing in it may read these tables.
--
-- `slug` rather than the UUID is what leagues store in settings.showId, and it's why this needs no
-- league-state migration: existing leagues already hold 'survivor', which matches the seeded row
-- below. It also means a show can be renamed or its row rebuilt without orphaning any league.

CREATE TABLE shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What leagues reference (settings.showId). Immutable in practice once leagues point at it.
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- Per-show terminology, so the UI can say "Houseguest"/"House" for Big Brother rather than
  -- Survivor's "Castaway"/"Tribe". These columns existed in the hardcoded registry and in the Show
  -- type but were never actually read anywhere; they become editable here.
  castaway_term TEXT NOT NULL DEFAULT 'Castaway',
  tribe_term TEXT NOT NULL DEFAULT 'Tribe',
  -- MediaWiki Action API endpoint for this show's wiki, e.g. https://survivor.fandom.com/api.php.
  -- Different shows live on different wikis, so this can't be a constant in the connector.
  wiki_api_url TEXT,
  -- Retire a show without deleting it: hidden from the league-creation picker, but any league
  -- already pointing at it keeps working.
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE show_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  -- Leagues reference a season by (show slug, this number) via settings.wikiSeason, again so no
  -- league-state migration is needed.
  season_number INTEGER NOT NULL,
  -- Display name where the season has one beyond its number ('Winners at War').
  name TEXT,
  -- The page title the MediaWiki API actually needs ('Survivor 44'). Derived from wiki_url when an
  -- admin pastes one, but stored separately and independently editable, because a wiki's URL scheme
  -- and its canonical page title are not always the same thing.
  wiki_page_title TEXT,
  -- The URL as pasted from a browser. Kept so an admin can see and re-check what they entered
  -- rather than only the derived title.
  wiki_url TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('upcoming', 'airing', 'completed')),
  premiere_date DATE,
  finale_date DATE,
  -- How many contestants the season starts with. Lets League Settings' shared-ownership nudge do
  -- real arithmetic (players x roster size vs. cast size) BEFORE anyone has entered the cast --
  -- until now that check had nothing to compare against and fell back to a vague message.
  cast_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (show_id, season_number)
);

CREATE INDEX idx_show_seasons_show ON show_seasons(show_id, season_number);

-- Seed the show that was hardcoded, with the same values, so the existing picker entry and every
-- league already holding showId='survivor' keep working unchanged.
INSERT INTO shows (slug, name, castaway_term, tribe_term, wiki_api_url)
VALUES ('survivor', 'Survivor', 'Castaway', 'Tribe', 'https://survivor.fandom.com/api.php');

-- One season row for the season the wiki connector has actually been run against, so the connector
-- has a real row to resolve rather than falling back on its hardcoded title straight away.
INSERT INTO show_seasons (show_id, season_number, name, wiki_page_title, wiki_url, status, cast_size)
SELECT id, 44, 'Survivor 44', 'Survivor 44', 'https://survivor.fandom.com/wiki/Survivor_44', 'completed', 18
FROM shows WHERE slug = 'survivor';
