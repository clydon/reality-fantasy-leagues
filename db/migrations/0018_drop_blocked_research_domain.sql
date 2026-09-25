-- ew.com blocks Anthropic's search crawler, and a search restricted to a blocked site is refused
-- outright. Research now drops such sites and retries, but there's no reason to pay for the failed
-- first attempt every time.
UPDATE shows SET research_domains = array_remove(research_domains, 'ew.com') WHERE 'ew.com' = ANY(research_domains);
