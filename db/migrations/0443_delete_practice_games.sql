-- The practice couch is retired (docs/PLAN-start-a-game-redo.md E1e; the user, 2026-11-18: "just delete them"): computer players
-- join any game now, so the practice games made while it was live (2026-10-27 to 2026-11-18) go, as its End it took one away: the
-- league, and everything that cascades from it (memberships, answers, picks). leagues.solo keeps its check (('public', 'practice'))
-- and its practice index: nothing makes a practice game again.
DELETE FROM leagues WHERE solo = 'practice';
