-- An episode's headline (docs/design-round/tonight-writeup-bolder.md, the user's pick 2026-11-23): one line, the way a TV recap
-- would title it ("Rob walks out, Patt blindsided 6–5"), shown over the write-up in Tonight's Last time. The recap search writes it
-- with the summary from now on (episode-recaps.ts recapPrompt); the summaries saved before it get theirs once, from their own
-- words (scripts/headlines-once.js). Like the summary, only ever shown to someone who has seen that episode (season-episodes.ts).
-- The reveal doesn't read it: its "In this episode" plays before who went home, and a headline would say it first. Additive.
-- At most 45 characters, the one stated limit (recap-text.ts HEADLINE_MAX): one line of Last time's caps on an ordinary phone,
-- never more than two.
ALTER TABLE season_episodes ADD COLUMN headline TEXT CHECK (length(headline) <= 45);
