-- Per-show override for which wikitext section holds the cast.
--
-- The connector used to look for the literal string "==Castaways==" on a season page, which is
-- Survivor's wording and Survivor's exact spacing. The Traitors wiki writes "== Contestants ==" --
-- a different word AND padded with spaces -- so the fetch failed with "No ==Castaways== section
-- found" on a page that plainly had one.
--
-- wiki-sync now matches headings with a whitespace-tolerant regex and tries a list of candidates
-- (the show's own castaway_term pluralized first, then the common synonyms), which handles both of
-- those without configuration. This column is the escape hatch for a wiki that calls it something
-- the list can't guess -- the same reason wiki_page_title is independently editable rather than
-- always derived. NULL means "use the candidate list", which is what every show should normally do.
ALTER TABLE shows ADD COLUMN cast_section_heading TEXT;

COMMENT ON COLUMN shows.cast_section_heading IS
  'Optional wikitext section heading holding the cast table (e.g. ''Contestants''). NULL = let wiki-sync infer it from castaway_term and its synonym list.';
