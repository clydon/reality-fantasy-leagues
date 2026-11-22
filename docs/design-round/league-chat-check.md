# A league's page, Chat (sports-couch B1, session 5): the check

2026-11-22, the `sports-couch` lane. DESIGN-PROCESS.md step 4: PFD evaluate and Impeccable critique on the built tab, once each (two
independent reviewers), then one batch of fixes and one confirming look. Frames: real renders at 390 × 844,
`.ui-atlas/stories/league-chat/after/` (`scripts/dev-test/story-league-page.js --only=chat`: the room seeded through its real routes).

## Found in the build, before the check

- The couch hub's feed of what was said reads chat by couch: a room's messages would have reached it with no season to fold by
  (a spoiler for anyone hiding scores). The feed leaves room rows out (couch-hub.ts); engagement counts and couch points keep them.
- A thread's name has to outlive its week: the message keeps it (`sports_event_name`).

## Scores

- **PFD evaluate:** Foundation 78, L1 74, L2 80, L3 70, L4 73; overall **75**. Five messages in the first view; the fold says no
  state; the thread's composer names the game.
- **Impeccable critique** (single-context): Nielsen **28/40**. Contrast passes in both themes. Detector: 4 advisory 14 px sizes.

## The one batch

- **A spoiler leak** (Impeccable, P1): for someone hiding a game's score, the About chip and the chips' live-first order went by
  the game's state, so they changed the moment it ended. For a hidden game, "on" is now the clock alone (begun, and under 3.5
  hours since; the league card's rule), never its state.
- **The game tag was a control inside the message's button** (Impeccable, P1: invalid, and a tap near the name ambiguous): it's
  words now; the chips are the way into a thread.
- **The tag only where the talk changes game** (PFD: three tags in five messages), as a landmark.
- **The chosen chip in ink** (both: a near twin of the others) and **a hidden game's chip says "· Started"** (both: the spec's).
- **44 px targets:** the chips, "+N", "+ About", Earlier messages.
- **One way of saying where a message goes** (both): the placeholder names the game while About is on.
- **Your own run's tag without a stray dot** (both).
- **A short stream sits by the composer** (both), as chats do.
- **The fold compact** (PFD: heavier than what it hides): its count and who, Show the score on its line.
- **The solo line:** "Chat is for a couch: your friends talking about the NFL." (PFD: "couch" twice).

## Kept, and why

- **A failed send as a quiet toast** (Impeccable): the show's Chat does the same; one rule for both.
- **14 px chips** (detector): the app's chip size.
- **No team marks on the chips** (Impeccable's thought): the game's words are what the room speaks; marks would be a second
  vocabulary on a row R1 budgets at one line.

## Open after the confirming look (not chased)

- **Two places to talk about one game:** **decided** at the review, they stay apart until a real Sunday's been watched (BACKLOG
  254 s).
- **A game row's chat count** on Scores and the strip (round 1), and the room's latest line on This week (round 2): after the
  merge (BACKLOG 254 q, r).
- Not framed: a hider opening the thread itself (it shows the same fold), the composer after ×, and "+N".
