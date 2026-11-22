# Following a league (sports-couch A3): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [league-follow-spec.md](league-follow-spec.md), for three surfaces at 390 px: search's league row, the league
sheet's follow row, the team sheet's your-team line.

## The problem

A fan meets a league (typing "nfl", tapping its card) and wants it on their hub, or off it. Today the league row is one button that
opens the league, so following it takes a second screen; the league's sheet never says whether it's on your shows or why; and a
fan of two teams in one league has no way to say which is theirs. Joanna followed the Eagles weeks ago and never the NFL, so a
"Following" on the NFL's sheet is a state she didn't knowingly make.

## The layers

**L0, cognitive load.** Constraint: 3–5 chunks at once (Cowan 2010), and noise costs bandwidth unattended (Hassin et al. 2009).
Violation: a search row that grows a toggle beside its chevron carries five things (mark, name, line, chevron, toggle), two of them
end-of-row cues saying different things. The sheet's follow row could push Your games and the week's play below the first view.
- **R1.** Search's league row holds four things: the mark, the name, one line, and the toggle in the end slot where the chevron was
  (the row's own tap still opens the league). The sheet's follow row is one row (faces, one line that truncates, the toggle), at
  most 52 px, so Your games and the week's play stay in the first view.
- **Citations:** Cowan (2010) for the 3–5 chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

**L1, first impression.** Constraint: the sheet is classified in its first glance (Lindgaard et al. 2006; Leder et al. 2004's
classification stage). Violation: nothing at the sheet's top says what your relation to the league is; it opens on explanation
and buttons.
- **R2.** The follow state is in the first view of each surface, at the top of the league's sheet, where a show's bar keeps its
  own follow, and quieter than any due move (it's state, not a task).
- **Citations:** Lindgaard et al. (2006) for the 50 ms classification; Leder et al. (2004) for the explicit-classification stage.

**L2, fluency.** Constraint: consistent signals read as true and trustworthy (Reber & Schwarz 1999; Alter & Oppenheimer 2009).
Violation: a league Follow drawn or worded differently from the team sheet's makes two kinds of follow to learn.
- **R3.** One toggle everywhere: the team sheet's (Follow outlined, Following filled in the foreground, 44 px, the same words), the
  same faces (24 px, three, yours first) and the same line voice. The league row's toggle is the same component, smaller only in
  padding.
- **Citations:** Reber & Schwarz (1999) for fluency read as truth; Alter & Oppenheimer (2009) for fluency's spread to trust and liking.

**L3, perception bias.** Constraint: people act on predictions, and a mismatch takes attention (Clark 2013). Violation: "Following"
on a league you never followed (a carried-over follow, through a team) predicts nothing you remember doing; a "your team" line for
your only team names a choice that doesn't exist.
- **R4.** Whenever a state comes from something other than your own tap on this league, the line names the cause in the same view:
  "On your shows · you follow the Eagles", "Your game here keeps it on your shows". "Your team" appears only where there's a
  choice (two or more teams followed in the league).
- **Citations:** Clark (2013) for prediction error drawing attention; Nisbett & Wilson (1977) for people not reconstructing why a
  state holds.

**L4, decision architecture.** Constraint: the right choice is the easy one, and consequences shown at the moment beat described
ones (Hertwig & Erev 2009); near actions take concrete words (Trope & Liberman 2010). Violation: a confirm on unfollow describes a
consequence instead of showing it; a your-team button as loud as Follow competes with it for a rare job.
- **R5.** The toggle is never the yellow (the One Chyron Rule: the due move and Play keep it). Unfollow happens on the tap, and its
  consequence is said as it happens (the toast: what leaves, what stays) with the toggle as the undo. "Make them your team" is a
  concrete text button under the line, quieter than the toggle.
- **Citations:** Hertwig & Erev (2009) for experienced over described consequences; Trope & Liberman (2010) for concrete words on
  near actions.

## R1–R5 together

1. R1: four things on the league row, the toggle in the chevron's slot; the sheet's follow row one row, at most 52 px.
2. R2: the follow state at the top of the sheet and on the row, in the first view, quieter than a due move.
3. R3: one toggle, one face stack, one voice, the team sheet's.
4. R4: a state not made here names its cause on the line; "your team" only with a choice.
5. R5: no yellow on a follow; unfollow on the tap, its consequence in the toast; your team a quiet text button.

## The first views

**Search, "nfl".** The eye: the league's caps mark → its name → the toggle at the row's end. Must: the toggle (Follow / Following)
in the first view with the row. Must not: a chevron beside it; a second screen to follow.

**The league's sheet.** The eye: the title (the league) → the follow row (faces, "On your shows · …", Following) → Your games (the
due move in chyron-line) → the week's play. Must: all four in the first view at 390 × 844 when you have one or two games there.
Must not: the toggle in yellow; a line that leaves Joanna asking why she follows it.

**The team's sheet, two teams followed.** The eye: the plate → the follow row ("Your NFL team", or the line and "Make them your
team" under it) → Play the next game. Must: your-team state on the same row as Follow. Must not: your-team words with one team;
the button louder than Follow.

## Against the spec

The spec satisfies R2–R5 as written. **The gap is R1:** the spec keeps the league row's chevron beside the new toggle; the toggle
takes the chevron's slot instead (the row still opens on its tap, as a band does without a chevron: A2's check). No other gap.
