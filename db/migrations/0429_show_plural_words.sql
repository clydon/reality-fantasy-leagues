-- A show's words on the desk (docs/PLAN-desk-parity.md part 7a, Its words): one person and many, one group and many, and
-- the episode word. The singulars are shows.castaway_term, tribe_term and episode_term (0142); these are the two plurals,
-- for words English doesn't make by adding an s ("person", "people"). Null works the plural out from the singular, as
-- every show did until now (show-words.ts pluralWord), so nothing reads differently until the desk sets one. Two
-- additive columns, and the trigger below.
ALTER TABLE shows ADD COLUMN IF NOT EXISTS castaway_plural TEXT;
ALTER TABLE shows ADD COLUMN IF NOT EXISTS tribe_plural TEXT;
ALTER TABLE shows DROP CONSTRAINT IF EXISTS shows_plural_words_check;
ALTER TABLE shows ADD CONSTRAINT shows_plural_words_check
  CHECK ((castaway_plural IS NULL OR length(castaway_plural) BETWEEN 1 AND 40) AND (tribe_plural IS NULL OR length(tribe_plural) BETWEEN 1 AND 40));

-- A new singular clears its plural, whatever writes it (Make it a game, the daily listings job, classic's show page), so a
-- plural set for an old word never outlives it. The desk's Its words writes the singulars, then the plurals. A trigger on an
-- existing table: rehearsed with the step's merge.
CREATE OR REPLACE FUNCTION shows_plural_follows_word() RETURNS trigger AS $$
BEGIN
  IF NEW.castaway_term IS DISTINCT FROM OLD.castaway_term THEN
    NEW.castaway_plural := NULL;
  END IF;
  IF NEW.tribe_term IS DISTINCT FROM OLD.tribe_term THEN
    NEW.tribe_plural := NULL;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS shows_plural_follows_word ON shows;
CREATE TRIGGER shows_plural_follows_word BEFORE UPDATE OF castaway_term, tribe_term ON shows
  FOR EACH ROW EXECUTE FUNCTION shows_plural_follows_word();
