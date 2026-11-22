# Following a league (sports-couch A3): the shape brief (Impeccable, step 3)

Operate mode, inside the committed Lower Third world (DESIGN.md). The structure is [league-follow-spec.md](league-follow-spec.md);
the first view is [league-follow-first-view.md](league-follow-first-view.md) (R1–R5).

- **Job and outcome.** A fan puts a league on their shows (or takes it off) in one tap where they meet it, and a fan of two teams
  says which is theirs. Proof: the league's card lands in Your shows (A2's card, unchanged in look) and the toggle reads Following.
- **One toggle, the team sheet's.** `FollowToggle` (a shared part in sports/parts.tsx, lifted from team.tsx): 44 px tall, a pill
  (the app's only round control besides faces: it's a state, not a broadcast graphic), 14 px bold; Follow outlined in `edge`,
  Following filled `foreground` on `background`. `aria-pressed`, the spoken name says what ("Follow the NFL"). Never yellow.
- **Search's league row.** The row stays a 64 px row; its tap target ends before the toggle, which takes the chevron's slot, 12 px
  from the row's text, its own button (never nested). The league's caps mark and name unchanged; the line "Every game, week by
  week". A long name truncates before the toggle.
- **The league sheet's follow row.** First in the sheet, the team sheet's row exactly: up to three 24 px faces overlapping, the
  line in 13 px muted (one line, truncating), the toggle at the end; 44 px min height, 12 px under it to Your games. The line's
  words are the spec's, the first that holds.
- **The team sheet's your team.** Only with two or more teams followed in the league: the line on your team says "Your NFL team"
  (the league's short name); on another followed team, the line as today and under it a 44 px-tall text button "Make them your
  team" (13 px bold, underlined like the sheet's "All opponents", left-aligned with the line). The toast confirms.
- **Feedback and states.** The toggle flips at once (optimistic) and a toast says what moved (the spec's words); a refusal flips it
  back with the server's words (`toast.quiet`). Loading: the row draws with the toggle in its last known state (from the follows
  read); while that read is pending the toggle shows Follow disabled, never a spinner. Off-season and hidden scores change nothing.
- **Untouched.** The league card's look (approved), Your games, the week's play and its One Chyron Rule, search's team rows, the
  team plate. **Anti-goals:** no yellow on a follow; no confirm dialog; no count of followers as a badge; no second follow entry on
  the card or strip.

*Assumed (no answer round: the prompt and spec settle the task):* the pill shape is kept from today's team toggle rather than made
square; "Your NFL team" uses the league's short name (NFL, NBA; a long one like "NCAA Men's Basketball" reads "Your team in
NCAA Men's Basketball" when it won't fit, judged by length over 6).
