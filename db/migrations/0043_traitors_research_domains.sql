-- The Traitors is read mostly from recaps (docs/RESEARCH-traitors-events.md), so its research gets
-- the recap sites that reported it reliably across US2-US4, best first, with the fandom wiki last as
-- a cross-check on votes, shields and roles. Vulture blocks automated fetching, so it isn't listed.
-- Same rule as Survivor's (0017): only fills an empty value, never overwrites one an admin has set.
UPDATE shows
   SET research_domains = ARRAY['goldderby.com', 'today.com', 'peacocktv.com', 'avclub.com', 'thetraitors.fandom.com']
 WHERE slug = 'traitors' AND research_domains IS NULL;
