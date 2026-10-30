-- A couch's Delete on the desk (docs/PLAN-desk-parity.md part 6d; decision 4): the couch goes with its games, restorable for
-- 30 days from Couches › Deleted, then for good on its own (end-game.ts purgeDeleted, as a deleted game does). Its people come
-- off it (their rows kept in the delete's line on the desk, admin_changes.after, so Restore puts them back) and every couch
-- read leaves a deleted one out. Two nullable columns and a partial index, and a trigger on leagues (below): it changes an
-- existing table's behaviour, so it's rehearsed with the step's merge, as 0420, 0421 and 0427 were.
ALTER TABLE couches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE couches ADD COLUMN IF NOT EXISTS deleted_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_couches_deleted ON couches(deleted_at) WHERE deleted_at IS NOT NULL;

-- No live game on a deleted couch: a game started (or brought back, or moved onto it) while its couch is deleted, or while
-- its Delete is under way, is refused, whichever path makes it (Start a game, classic, a restore). The couch row is read
-- with a lock, so a game started the moment its couch's Delete holds that row waits for it, then sees it deleted. Its
-- Restore brings the couch back first, then the games it took.
CREATE OR REPLACE FUNCTION leagues_on_a_live_couch() RETURNS trigger AS $$
DECLARE gone TIMESTAMPTZ;
BEGIN
  IF NEW.couch_id IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT deleted_at INTO gone FROM couches WHERE id = NEW.couch_id FOR KEY SHARE;
  IF gone IS NOT NULL THEN
    RAISE EXCEPTION 'That couch was deleted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS leagues_on_a_live_couch ON leagues;
CREATE TRIGGER leagues_on_a_live_couch BEFORE INSERT OR UPDATE OF couch_id, deleted_at ON leagues
  FOR EACH ROW EXECUTE FUNCTION leagues_on_a_live_couch();
