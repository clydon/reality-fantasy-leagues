-- Generic key/value store for app-wide settings a super admin controls once, for everyone -- the
-- first user is Overview's section order/visibility (src/lib/overview-layout.ts), which started as
-- a personal, localStorage-only preference (see 0026's era of the feature) and is being promoted
-- here to a real global default: every user, in every league AND in demo mode, renders Overview from
-- whatever's stored under key='overview_layout', not their own browser's copy.
--
-- One row per setting rather than a dedicated table per setting: this table is expected to grow a
-- handful of these over time (rather than one migration + one table each), and a single admin-facing
-- read/write surface is simpler than N of them.
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
