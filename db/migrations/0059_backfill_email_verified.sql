-- Turning on requireEmailVerification (src/lib/auth.ts) blocks sign-in for anyone whose
-- "emailVerified" is false -- without this, every account created before today (nobody was ever
-- asked to verify) gets locked out on their next login, this app's own dev/prod admin included.
-- One-time grandfather, not a schema change: going forward only a NEW signup with a real email
-- starts out unverified.
UPDATE "user" SET "emailVerified" = true WHERE "emailVerified" = false;
