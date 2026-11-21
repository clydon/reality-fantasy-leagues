# Settings, Round 4: the words and the ripple (the spec)

> **Status (2026-11-21): the spec, built on branch settings-r4** (lane rfl-settings, port 3018). Round 4 of
> [PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md), with BACKLOG 243. A words sweep and its ripple, so it goes through
> Impeccable alone (docs/DESIGN-PROCESS.md, "When not to use them": a words change is Impeccable's `clarify`, then one check),
> not the three-skill round. The structural decisions were Rounds 1 to 3's.

## The job

Rounds 1 to 3 each did their own words. This round finds what's left: the places that still say a retired home's name, the
places where Start a game and a running game call one thing two names, the ways Recommended is marked, and the confirms that
aren't on the guards' pattern. Then it re-renders what those parts touch.

Scope is the new app (src/new, its routes, the pushes and toasts it shows, the errors its routes send). The classic screens
(src/components/setup, -waivers, -episodes, -draft; the classic tour in src/lib/tour) are left as they are: classic isn't the
spec, and nothing in the new app renders them. The desk's own words wait for Round 5, except where they point at a home that
no longer exists.

## The glossary (one set of words)

What a running game (Manage this game, decided in Rounds 0 and 3) calls a thing is what Start a game calls it too.

| Thing | The word | Was, somewhere |
| --- | --- | --- |
| A game's runner's page | Manage this game | Backstage, Game settings |
| The list of your games on a show | Games you run | Backstage (the tab's title still said it) |
| The second runner | Helper | Game admin (desk only now) |
| Joining that waits for a yes | They ask first | ask me first |
| The freeze | Freeze rules and joining; "Frozen for the season" | Lock it down, Locked down, (competitive) |
| A couch's own rulebook | Customize the rulebook | Make it ours |
| Where a season's rules live | This season's rules | Scoring rules |
| Waiver feels | Relaxed · Standard · Strict | Casual · Balanced · Competitive (Start a game) |
| When a replacement comes | Whenever one goes home · When your team is short · In set windows · No replacements | Replace right away, Replace only when short, Replacements wait for a window |
| Who claims first | Fewest points first · Most points first · Rolling | Lowest score picks first, Highest score picks first |
| The draft's clock | A clock on each pick (1 min, 2 min, none); Someone away: wait for them / use their list | 60 seconds a pick, then from their queue; No pick timer |
| A confirm's way out | Not now | Not yet (which Tonight also uses, for "Seen Ep 9? Not yet") |
| A record of changes | Recent changes (kept: see "Kept, and why") | |

## The changes

### 1. Old homes, followed
- The pushes: a join request says "Let them in or not, on Manage this game" and opens that game's Manage this game; a late
  joiner opens their game's page; a couch handed on says what's theirs now without results (the bot settles them since
  results-settle) and opens Games you run.
- The errors a person can meet: "Too late to undo: stop it on Manage this game instead"; "Only whoever runs a game here can
  open this" (was "Backstage is for…"); "Customize the rulebook first"; the freeze's refusal names Manage this game; the desk's
  computer-player refusal names Who's playing.
- The tab's title on Games you run: "Games you run" (was "Backstage").
- This season's rules: the frozen note says where to turn it off ("Freeze rules and joining is on, on Manage this game").
- A show change ("…asked first, in This season's rules").
- The desk's Setup note: a game is deleted from its own Manage this game page.

### 2. One set of words (the glossary, applied)
- Start a game: the waiver feels as Relaxed · Standard · Strict (the stored values stay casual, balanced, competitive).
- Start a game: **Lineups hidden goes** from The details. The new app hides others' lineups until the lock whatever it says
  (3b, A15), so the control does nothing (settings rule 2). The engine field stays for old games.
- describe.js's details (the engine lab, and anything that lists a game's details): the replacement, freeze, draft-clock and
  claim-order words above; the Starters detail goes for the same reason.
- What players see about waivers and the waiver page's order line: Fewest points / Most points.
- Manage this game and its sheets: "they ask first", "Frozen for the season", the join card's freeze line without
  "(competitive)".

### 3. One Recommended tag
One part, `Recommended` (src/new/ui/recommended.tsx): the word in condensed caps, muted, no fill, so it reads the same on the
ground, a card and a raised choice (the old fill chip vanished on a raised choice). Used by Your settings' choices, Manage this
game's choices, the desk's choice cards, Who can fill in results and the draft room's Someone away. A Stepper's value line keeps
"Recommended: 3" when off it (that's the value, rule 4), and a changed setting keeps its dot.

### 4. One confirm pattern (rule 6)
- The preview-then-confirm sheet (GuardSheet) and the hold sheet (HoldSheet) both end with **Not now**.
- **Leave the pool** moves to the hold sheet: it deletes your picks, calls and streak for good (leavePool removes the seat), so
  it says that and asks for a hold; nothing to restore.
- **Customize the rulebook?** keeps its sheet (it explains a change of mode) and gains the same Not now.
- Not moved: the vote's sheet (its quiet way out was 3b's fix against leaning to the default), Look them up again (a choice
  between two asks, not a confirm), Unlock One tap (money, the desk's Round 5 and BACKLOG 113).

### 5. How it plays says 3b's two rules (BACKLOG 243)
- When the show adds a moment mid-season: "If the show adds a moment mid-season, it counts from the start" / "from the next
  episode" / "you vote on whether it counts from the start" (settings.newMoments; the show's format default when unset).
- An empty slot fills from the bench: "If a starter goes home and nobody changes the lineup, the first on the bench starts"
  (settings.benchFill on).

### 6. The ripple
- A person's colour: Waivers passes the same id as Manage this game, so a face is one colour on both.
- Who's playing's "You" tag, measured again at 390.
- How long's Ends stays a native select (see below).
- Re-render: every screen that uses a changed part (the guards' sheets, the Recommended tag's homes, Start a game's details and
  waivers, the pool's Leave, the rulebook page), before and after, at 390.

## Kept, and why
- **Recent changes keeps its name.** Round 3's shape assumed "Changes in these games" for the show's ⋯. Recent changes is
  already literal and is named in a dozen places ("undo from Recent changes", "restorable for 30 days from Recent changes");
  the longer name says less. A choice for the user on the story.
- **How long's Ends is a native select:** a long list of episodes and phases, where the phone's own picker is the ordinary
  control (rule 8). Visually it sits in the line like Starts.
- **"Suggested" on a new moment's points** (the rulebook's Add a moment, a new show's What scores): a starting value, not a
  recommended choice, so it isn't the tag.
- **The classic screens' "Commish" tags and old waiver words:** classic only.
- **The desk's research words** ("it waits in each couch's Backstage"): what happens to an unsure answer changed with
  results-settle, so the sentence needs the desk's own pass (Round 5), not a new name.
