-- The fold by progress and first to finish (docs/PLAN-new-design.md step 14 part 2). Additive, and classic reads neither column.
--
-- chat_messages.author_seen: how far its author had seen when they wrote it, kept only where the couch chat's fold goes by it: a
-- season watched at its own pace (a streaming drop, or a finished season with no game in the conversation, once a week has passed
-- since its last episode aired: src/lib/game/chat-fold.ts marksAuthor). There, someone else's message is folded for you while its
-- author had seen more than you, so a binge drop no longer folds everything said after it until you finish. NULL: the fold goes by
-- airtime, as before (a weekly season, and every message from before this). Written in one place, src/lib/server/chat.ts
-- insertMessage, for both designs' chat; never sent to anyone (it would say how far someone was).
ALTER TABLE chat_messages ADD COLUMN author_seen INTEGER CHECK (author_seen >= 0);

-- show_follows.finished_at: when someone's mark first reached the season's last episode (show_seasons.episode_count), kept from now
-- on by src/lib/server/follows.ts, the one place seen_through is written; cleared if they move back from the end. By the numbers'
-- First to finish (a streaming season's earliest on the couch), shown only to people who've finished it themselves.
ALTER TABLE show_follows ADD COLUMN finished_at TIMESTAMPTZ;
