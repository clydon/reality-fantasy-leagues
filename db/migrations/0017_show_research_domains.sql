-- The sites episode research (db/episode-research.js) is allowed to search, per show.
--
-- Restricting the search is the biggest single lever on both cost and quality: search results enter
-- the model's context as input tokens, and an open web search spends them on aggregator spam, fan
-- speculation and pages about the wrong season. A short list of trusted recap sources gives fewer,
-- better pages. NULL means "use the defaults" (the show's own wiki plus a few general TV recap
-- sites -- see domainsFor in db/episode-research.js); an admin edits it in the show's Settings.
ALTER TABLE shows ADD COLUMN research_domains TEXT[];

-- Survivor has a well-known set of reliable recap sources, so it starts with them rather than the
-- generic list. Only fills an empty value; never overwrites one an admin has set.
UPDATE shows
   SET research_domains = ARRAY['survivor.fandom.com', 'insidesurvivor.com', 'truedorktimes.com', 'ew.com', 'tvline.com', 'parade.com', 'cbs.com']
 WHERE slug = 'survivor' AND research_domains IS NULL;
