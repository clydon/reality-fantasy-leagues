# Rivalries (sports-couch C1): first-view requirements (Perception-First Design, step 2)

Mode 2 derivation on [rivalry-spec.md](rivalry-spec.md), once, bottom-up, for the rivalry card on a league's This week and the
Your call sheet at 390 × 844. The card sits under the league's bar (about 130 px) and the move strip when one is due (about 70 px),
so it has about 400 px of the first view before the couch's table starts.

## The problem

Two friends' teams meet this week. A fan wants to call it against the other fan; anyone else wants to say whose side they're on;
everyone wants to know, afterwards, who called it. What gets in the way today: the card shows the matchup as a picture with "Start a
game on it", so the only move is the gallery's generic Pick'em; a spectator has nothing to do; nobody is told they've been called
out; and the result is a bare score.

## The layers

**Foundation, load.** Constraint: about four chunks at once (Cowan 2001); noise that isn't attended still spends working memory
(Hassin et al. 2009). Violation: a head, two teams, two people, two records, two calls, sides with faces and counts, two side
buttons, a call button, a notification line and a link to other games would be a dozen chunks if each were its own line.
- **R1. The card holds four groups, in this order: the head (what this is, when), the two sides (each side one block: team over
  person, the call at its right), the sides line (faces and counts, one line, only once someone's picked), and the one action for
  you. Other games on it is a text link under the action, never a button. The card fits in about 300 px before kickoff, so the
  couch's table still starts in the first view.**
- **Citations:** Cowan (2001) for the four-chunk limit; Hassin et al. (2009) for unattended noise spending working memory.

**L1, the first glance.** Constraint: faces are found before words (the 50 ms first impression, Lindgaard et al. 2006); one colour
that means "act" pops out (Treisman & Gelade 1980). Violation: a VS slab or a big score would lead before the people; a yellow
call button beside a yellow move strip would split the eye.
- **R2. The two people lead each side (face and name beside the team), and nothing is bigger than the team names before kickoff.
  The one yellow is the fan's Make your call, and only when no move strip is yellow above it (else it steps down to outlined: the
  strip is the page's one yellow). Pick a side is two outlined buttons; a picked side is the app's quiet fill with a check
  (A3's follow look), never yellow. Live red only on the live dot.**
- **Citations:** Lindgaard et al. (2006) for the first impression; Treisman & Gelade (1980) for pop-out by one feature.

**L2, fluency.** Constraint: a form already learned reads as right (Reber & Schwarz 1999). The card is B1's (two sides of mark,
team, person); the sheet is B4's (a title, tiles, one decision with its line under it); the picked look is A3's follow toggle.
Violation: a new stepper, a new chip style for a call, or a bar in team colours would be a fourth way to say the same things.
- **R3. Keep B1's side rows, and put each fan's call where B1 put the score (the right edge), in the same type: "Called" before
  kickoff in muted text, "Giants by 6" in the number type once begun, the score taking that place only when live or over. The sheet
  uses B4's tile pair for the winner and one big number with − and + for the margin. The sides line reads left to right as the
  sides do: away's faces and count at the left, home's at the right.**
- **Citations:** Reber & Schwarz (1999) for fluency read as rightness; Alter & Oppenheimer (2009) for fluency and trust.

**L3, what people predict.** Constraint: people act on a prediction of what a tap will do (Clark 2013); concrete words fit near
actions (Trope & Liberman 2010). Violation: a spectator who taps "Giants" can't predict whether that starts a game, whether it's
public, or whether it's final; a fan can't predict who hears about a call.
- **R4. Every action says its consequence in the words beside it: Pick a side's label says it's public and changeable ("Pick a
  side · everyone sees it · change it until kickoff"), a picked side names whose side it is ("With Andrew"); the call's send says
  who's told ("Riley gets one notification") and what stays hidden ("margins stay hidden until kickoff"). A hidden margin shows as
  "?" beside the team, never a blank. After kickoff nothing asks: the calls show in full, the actions leave.**
- **Citations:** Clark (2013) for prediction errors; Trope & Liberman (2010) for concrete words near actions.

**L4, the decision.** Constraint: a default carries most choices (Johnson & Goldstein 2003); a refusal must cost the same as an
acceptance (the Intent anti-pattern catalog's confirmshaming; Thaler & Sunstein 2008 on easy good choices). Violation: a challenged
fan with no easy no would feel pushed; a fan's call that needs a team picked first adds a decision nobody needs.
- **R5. The fan's own team and the sport's typical margin are already chosen, so Make your call is one tap to open and one to send.
  A spectator's side is one tap, no sheet. Challenged, the sheet offers "Not this time" as plain text at the same size as anything
  else plain, with no shaming words; Not this time costs nothing (no message to anyone).**
- **Citations:** Johnson & Goldstein (2003) for defaults; Thaler & Sunstein (2008) for making the good choice easy.

## What satisfies all five

The card, from the top: the head (28 px: swords, "This week's rivalry", "Sun 1:00 PM"); two side blocks of 52 px each (mark 36,
team 16 px bold, person 13 px with an 18 px face, the call at the right); the sides line (28 px; four faces at most a side, then the
count); the action (a 44 px button, or a pair of 44 px buttons side by side, each the mark and the team's name); the text link
(36 px). About 28 + 8 + 112 + 8 + 28 + 12 + 44 + 36 + padding ≈ 300 px.

Per situation:
- **Sam, a spectator, nobody's picked:** head · sides (both "Called" or "No call yet") · no sides line · "Pick a side · everyone
  sees it" over the two outlined buttons · Other games on it.
- **Sam, picked:** the same; the Giants button filled with a check, "With Andrew"; the sides line with his face.
- **Andrew, a fan, no calls:** head · sides · "Make your call" (yellow unless a move strip is) with "Riley gets one notification"
  under it · the link.
- **Riley, challenged:** head · Andrew's side says "Giants by ?" · above the button, "Andrew called Giants. Your call?" · Make your
  call.
- **Both called:** each side "Giants by ?" / "Eagles by ?"; Andrew sees "Change your call" as a text button and no yellow.
- **On now:** calls in full in the number type, the live score beside the team name's line; sides frozen; no action.
- **Over:** a result line under the head in names ("Andrew called it: Giants by 6, 2 off"); each call with "right" or "off by N";
  the losing side muted; the sides line with checks; the record line ("Andrew leads Riley 2–0 this season").
- **Hidden:** calls and sides show; no score, result line, checks or record; the page's Show records.

The sheet's first view: title "Your call" and the matchup line (64) · Who wins: two tiles (64) · By how many: the number (40 px
type) with − and + (64) · the other fan's call when there is one (24) · Make your call (52, yellow) with its line (40) · Not this
time (44). About 400 px: all of it in view.

Must not be in the first view: two yellows; a margin before kickoff (anyone's, yours shown only to you); a score, result or check
for anyone hiding; a VS mark or team-colour slab; a count of sides with no faces.

## The spec's proposals against R1–R5

- One game a meeting, started by the first tap: R5 passes (a side is one tap, nothing to set up).
- The calls at the right of each side: R3 passes (the score's place, the score's type once begun).
- "Make your call" yellow: R2 needs the rule above (it steps down when the move strip is yellow).
- Pick a side on the card, a margin only on the sheet: R1 and R5 pass.
- The result line in names and the record line: R4 passes; R1 holds because they replace the action group after the final.
- Up to two cards a week: R1 fails if both are full cards in the first view; the second is drawn the same but starts below the
  couch's first rows only when the first is live or before kickoff. Accept: two rivalries in a week are rare (Week 12: one).

## The gap

The spec doesn't say what a fan sees of **their own margin** before kickoff: theirs is shown to them ("Giants by 6 · only you see
the margin"), the other's as "?". And it doesn't say how a spectator **takes back** a side: tapping the picked button again clears it
(the follow toggle's own rule).

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
