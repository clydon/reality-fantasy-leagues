-- A third league role, Game admin (docs/PLAN-new-design.md step 0b): runs results and waivers and can pick for
-- people in a draft, but can't change rules or roles; a commissioner can do all of it. Roles can be handed
-- off or shared, and a league always keeps a commissioner (src/lib/server/roles.ts). The classic app knows
-- only commissioner and member, so a Game admin is a member there until the new design's Backstage opens
-- its pages to them (steps 5 and 6a).
ALTER TABLE league_memberships DROP CONSTRAINT league_memberships_role_check;
ALTER TABLE league_memberships ADD CONSTRAINT league_memberships_role_check CHECK (role IN ('commissioner', 'admin', 'member'));
