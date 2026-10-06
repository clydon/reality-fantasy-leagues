-- Who created a show (docs/PLAN-rollout-order.md stage 4: self-serve "+ Add it"). Null for every
-- existing row (seeded/admin-created, before this column existed). Used only for ownership checks on
-- the new non-admin /api/formats/* routes -- a self-serve show is public in the picker immediately
-- like any other, but only its creator (or an admin, via the existing admin routes) can touch the
-- show_formats draft behind it.
ALTER TABLE shows ADD COLUMN created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
