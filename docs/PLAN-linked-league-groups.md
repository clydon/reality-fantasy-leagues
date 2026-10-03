# Plan: named linked-league groups in the league dropdown

Linked leagues (db/migrations/0040, 0046, `src/lib/server/league-groups.ts`) get a name, and the
league dropdowns (desktop sidebar and mobile top bar) show each group as one row that opens into its
leagues. The point is a shorter menu for people in a lot of leagues.

## Naming

- `league_groups.name TEXT NULL` (migration 0047).
- Unnamed groups show **show + season number** ("Survivor 51"). `linkProblem` already guarantees
  every league in a group is on the same show and season, so the default always exists.
- Any commissioner of a league in the group renames it: `PUT /api/leagues/[id]/link` takes
  `{ name: string | null }` next to `order` / `favoriteId`. `null` (or blank) is back to the default.
- League Settings > Linked leagues gets a name field at the top (read-only for non-commissioners).

## The dropdown

```
┌──────────────────────────────────┐
│ Hosers                Survivor   │  plain league (unchanged)
│ [Classic]  👑 Commissioner       │
├──────────────────────────────────┤
│ ▾ The Island Crew      Survivor  │  group row
│   3 leagues · 👑                 │
│   │ Main Draft        ★          │  the group's favorite
│   │ Eliminator Pool              │  current league highlighted
│   │ Side Bets                    │
├──────────────────────────────────┤
│ ▸ Traitors Gang        Traitors  │  collapsed group
├──────────────────────────────────┤
│ + Join or create a league        │
└──────────────────────────────────┘
```

- Nested (accordion), not a side flyout: the sidebar has no room beside it and flyouts are poor on touch.
- Tapping a group row only opens or closes it; it never switches league.
- Every group starts closed except the one holding the open league. Open/closed isn't remembered
  past the menu closing.
- Inside a group: the commissioner's order (0046), with a star on the favorite. Each league keeps
  its type badge and crown.
- A group the user is in only ONE league of renders as a plain league row (group name as a subtitle).
- If the whole menu would be a single group (the user's linked leagues are their only leagues), it
  renders as a fixed heading with its leagues under it -- nothing to open.
- Desktop: the switcher button shows the group name small above the league name. Mobile's top bar
  is left alone (the swipe dots already say "you're in a group"; the name is one tap away).
- `/dashboard` has no league list, and Admin's list stays flat -- neither changes.

## Code

1. `db/migrations/0047_linked_league_group_name.sql`.
2. `league-groups.ts`: `groupDisplayName(name, showName, season)`.
3. `/api/me`: each league gets `group: { id, name } | null` (name already defaulted); a group's
   leagues come back together, at the place of its highest-ranked league, in group order.
4. `/api/leagues/[id]/link`: GET returns `name` and `defaultName`; PUT accepts `name`.
5. `src/components/league-menu.tsx`: one shared menu body (`groupLeagues()` + rendering) used by
   both `league-switcher.tsx` and `mobile-nav.tsx`, replacing their duplicated lists.
6. `linked-leagues-section.tsx`: the name field.
