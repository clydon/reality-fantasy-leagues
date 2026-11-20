-- Live previews' limits (docs/PLAN-preview-release.md, decision 4 and step 8).
--   preview_uses          the app's: one row each time someone makes a preview, for the daily allowance they see ("You have 3
--                         previews left today"); a preview that fails to be made gives its row back. Reopening one costs nothing.
--   live_preview_months   the preview service's: each month's previews and what they cost it (CPU milliseconds, its own count), for
--                         the monthly budget that keeps previews well inside the free plan the app shares (Vercel Hobby).
-- And a preview's row now exists from the moment it starts being made (its viewer once the first copy is written), so the previews
-- being made at once can be counted (at most 10).
CREATE TABLE preview_uses (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  made_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX preview_uses_user ON preview_uses (user_id, made_at);

CREATE TABLE live_preview_months (
  month DATE PRIMARY KEY,
  previews INT NOT NULL DEFAULT 0,
  cpu_ms BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE live_previews ALTER COLUMN viewer_user_id DROP NOT NULL;
