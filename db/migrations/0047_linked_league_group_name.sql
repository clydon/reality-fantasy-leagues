-- Linked leagues (0040) get a name, set by a commissioner of any league in the group in League
-- Settings > Linked leagues. The league dropdowns show a group as one row under this name that opens
-- into its leagues. NULL is no name: the group shows as its show and season ("Survivor 51" --
-- league-groups.ts's groupDisplayName), which every league in a group shares.
ALTER TABLE league_groups ADD COLUMN name TEXT;
