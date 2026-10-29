// When each account last used the app: the later of its last authenticated request
// (user_last_seen, stamped by requireSession -- see auth-helpers.ts) and its last real sign-in
// (newest session row, which also covers anyone not seen since that table existed). Impersonation
// never counts toward either. LAST_ACTIVE is that, as SQL over "user" aliased `u` (the desk's
// People sorts by it: desk-people.ts).
export const LAST_ACTIVE = `GREATEST(
  (SELECT ls.last_seen_at FROM user_last_seen ls WHERE ls.user_id = u.id),
  (SELECT MAX(s."createdAt") FROM session s WHERE s."userId" = u.id AND s."impersonatedBy" IS NULL)
)`;
