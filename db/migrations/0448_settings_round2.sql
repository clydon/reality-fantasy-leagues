-- Settings, Round 2 (docs/PLAN-settings-overhaul.md; docs/design-round/settings-r2-spec.md): a show and a couch, for you.
--
-- When results show, on one season (A7, the exception to the account's When results show): NULL follows the account
-- (user_settings.show_results_immediately, or hide_sports_scores on a sport); 'wait' holds them until you've watched; 'now' shows
-- them straight away. Read wherever the account's choice is read (guard.ts and the pushes that name who went home), this first.
ALTER TABLE show_follows ADD COLUMN results TEXT CHECK (results IN ('wait', 'now'));

-- Which couch the hub shows (C25), for your account rather than the phone: a new phone opens on it. NULL: the first couch. A couch
-- you've left is just ignored when read.
ALTER TABLE user_settings ADD COLUMN hub_couch UUID;
