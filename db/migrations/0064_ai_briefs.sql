-- AI briefs (src/lib/server/ai-briefs.ts): a long prompt parked at a short public URL, /b/<code>, so an
-- "Open in ChatGPT/Claude/..." link can carry one line ("read the brief at <url>") instead of the whole
-- prompt, which no chat's URL can hold. Content-addressed (one row per distinct prompt, re-asking
-- refreshes its expiry) and short-lived: a brief is only ever read minutes after it's made.
--
-- ai_brief_fetches logs who read each one (the fetcher's user agent), which is how we learn which chats
-- actually open the page: the point of the experiment.

CREATE TABLE ai_briefs (
  code TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ai_briefs_expires_at ON ai_briefs (expires_at);

CREATE TABLE ai_brief_fetches (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL REFERENCES ai_briefs(code) ON DELETE CASCADE,
  user_agent TEXT,
  via TEXT NOT NULL, -- 'page' (/b/<code>) or 'action' (the custom GPT's API call)
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_brief_fetches_code ON ai_brief_fetches (code, fetched_at);
