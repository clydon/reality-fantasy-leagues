-- Early access: new signups land on a "pending approval" screen until an admin approves them
-- (src/components/pending-approval-screen.tsx). DEFAULT true backfills every account that already
-- exists today -- nobody currently using the app gets locked out. Better Auth's `user`
-- additionalFields config (src/lib/auth.ts) overrides this with defaultValue:false on every new
-- signup through the app itself, so the column default only governs rows inserted outside that
-- path (db/seed-dev-admin.js's raw SQL), which should stay auto-approved.
ALTER TABLE "user" ADD COLUMN approved boolean NOT NULL DEFAULT true;
