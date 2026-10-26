-- What your couch sees (docs/PLAN-new-design.md step 15 part 3; the mock's share.js). Additive; classic reads none of it.
--
-- Four switches per account, each on by default (the mock's Everything, the recommended level), enforced on the server by the
-- spoiler guard's rule 3 (src/lib/server/guard.ts shares / sharesSql), on top of a show watched privately (show_follows.private),
-- which hides that one show whatever these say:
--   share_where      Where I am in each show: what you watch and how far you are (Who's watching, The couch is watching, the
--                    rail, First to finish, the chat's fold by progress, reveal lines)
--   share_now        When I'm watching: who's on now (a watch along open right now, and the month's watch alongs)
--   share_ratings    My episode ratings: the couch verdict, the taste twin, everyone's average
--   share_reactions  My watch along reactions: what you say in a watch along, for whoever watches after you
-- Just my games is where and now off; Only what games need is all four off (src/lib/sharing.ts SHARE_PRESETS). Your games
-- (picks once they lock, calls, bingo, polls) always show: the games need them.
--
-- Backed up with user_settings: a privacy choice is the person's, and a restore that lost it would show what they chose to hide.
ALTER TABLE user_settings ADD COLUMN share_where BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN share_now BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN share_ratings BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_settings ADD COLUMN share_reactions BOOLEAN NOT NULL DEFAULT true;
