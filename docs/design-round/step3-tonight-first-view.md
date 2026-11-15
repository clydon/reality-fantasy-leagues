# Tonight's first view: requirements (step 3)

Mode 2 derivation on [the page spec](step3-tonight-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md). Today's Tonight in each situation: `.ui-atlas/stories/phase0/census/tonight-*.jpg`,
`bench-show-*-tonight.jpg` and `atlas-tonight.*.jpg`, each with its measures in the `.json` beside it.

## The problem

Someone opens a show: from the hub's plate, from a push, or by tapping back to Tonight inside it. In one look they want to know
how far they are and how far their people are, whether something is theirs to do and by when, and what happened last time. Today
the first view answers all three in different places and none of them once: a 54 px name, a chip with the next episode, a line of
numbered faces, a phase heading with the next episode again, then a carousel of move cards (the lock time a third time) or a
plate saying results are waiting. Last time's result, the couch's GIFs and the games' standings start between 700 and 1,800 px
down. The first view reads nearly the same whether a lineup is due, set, locked or revealed.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and unattended noise spends it.

**Violation.** Across 22 census frames, today's first view holds 9 to 13 controls, 75 to 134 words and 6 to 13 type sizes
(median 12). The next episode's time is said in the chip, the phase heading and the move card (`tonight-alex`: "Ep 6 · in 4
days", "Wed 8:00 PM · in 4 days", "Due Tue 8:00 PM"). Progress is said in four forms: the chip, the numbered faces, "3 caught up",
the phase heading. The carousel shows a second card's edge, a chunk nobody asked for.

**R1.** The first view holds four chunks at most: the show (art and name), where you and your couch are (one control), what's
yours to set (one strip), and the top of last time. Each fact once: the next episode and its time in the control only; the lock
time in the strip only; the reveal in the control only. At most five type sizes and 40 words above the fold, excluding names on
faces. No partial card at the edge.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

## L1 · First impression

**Constraint.** Appeal and meaning are judged in about 50 ms, and that judgment switches attention on or leaves it off.

**Violation.** The 50 ms read today is the show's name in 54 px caps over the art, which says which show and nothing about this
visit. The couch's faces are 24 px squares with 12 px numbers under them: present, but too small to read as people at a glance.
`bench-show-due-tonight` shows "You finished it · 3rd of 4" in a white plate as the brightest thing on screen, for someone whose
lineup is due.

**R2.** The anchor is the show's art with the couch on it: the faces at their marks on one scale, large enough to read as people
(28 px or more), you set apart by a ring. The name stays (identity is the brief's first item) at a size that leaves the art and
faces the larger share of the header. The brightest element in the first view is the one thing due for you, never a past result.
A show without art gets the same header on its colour.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgment; Leder et al. (2004) for classification following perception.

## L2 · Processing fluency

**Constraint.** What is easy to process feels true and trustworthy, and inconsistency across one surface erodes that.

**Violation.** The same fact takes different forms a scroll apart: a move is a numbered card on Tonight, a fixed bar (the dock)
on Episodes, a row on Games; progress is a chip, a face line, a plate, and a spoiler line with Change on four other tabs. A done
move uses teal ticks, the morning update a teal slab, a survived pick teal type: teal means "done", "good news" and "safe" at once.

**R3.** One form per fact across every show tab: the progress control in the show bar (tall on Tonight, a line elsewhere), the
strip directly under it in the same place on every tab. Words follow one template, "Ep N" then what's true ("Ep 6 · Wed 8:00 PM",
"Through Ep 5", "All set for Ep 6"). Colour carries one job each: yellow fill only for what's due for you, teal only for a win or
a good result, the live red only for on air or out.

**Citations:** Reber & Schwarz (1999) for ease of processing read as truth; Spence (2011) for coherence across signals.

## L3 · Perception bias

**Constraint.** People predict what they'll see; a match runs on autopilot, a violation is what draws attention.

**Violation.** Each way in predicts something different, and today's top answers none of them specifically. A push saying "Your
lineup locks tonight" lands on a heading and a carousel whose first card may be a different move. A push saying "Episode 5
results are in" lands on a plate below the moves. A head-to-head player predicts "who I play" and finds a 3rd-place tile 1,600 px
down. With nothing due, the top looks the same as with something due, so the absence of a task isn't news either.

**R4.** The top answers each way in within the first view: the strip names the move a push named, the control names the reveal a
push named, and with nothing due the strip says "All set for Ep N" in a quiet form, so its yellow form is a change the eye catches.
Head to head's opponent is in its game's mini, the first thing in Your games. Only one yellow in the first view, ever.

**Citations:** Clark (2013) for prediction errors drawing attention; Seckler et al. (2015) for trust following visual coherence.

## L4 · Decision architecture

**Constraint.** People take the easiest visible path; near commitments want concrete words, and decisions from experience beat
decisions from description.

**Violation.** The casual path today is good once found (the move card's yellow button opens Your moves), but two cards compete
and the second hides at the edge. The sweat's path, how a game went and why, is a "Your night" line far down and a tile that only
says a place. The reveal's consequence ("every game at once") is said nowhere near its button.

**R5.** One tap from the strip to the due move, with the move's game and episode named in the button's words ("Set your lineup for
Ep 6"). One tap from the control to the reveal, with "every game at once" beside it. For the sweat, each game's mini shows the last
result as numbers in the game's own measure and opens the ledger (who scored what) in place, one more tap to the game page; back
returns to the same scroll position with the ledger still open.

**Citations:** Trope & Liberman (2010) for concrete words at near commitments; Hertwig & Erev (2009) for showing the numbers
rather than describing them.

## R1–R5, together

1. **R1** Four chunks: show, where you are, what's yours to set, last time. Each fact once, five type sizes, 40 words.
2. **R2** The art with the couch's faces on one scale (28 px or more), you ringed; the brightest thing is what's due.
3. **R3** One form per fact on every tab: the control in the bar, the strip under it; yellow is due, teal is a win, red is live.
4. **R4** Each way in finds its answer in the first view; "All set" quiet so "due" is news; one yellow.
5. **R5** One tap to the move and to the reveal, each named with its episode; each game's numbers open in place.

Lower layers win conflicts: the art and faces (R2) and the four-chunk limit (R1) together mean the name shrinks, not the faces.

## The first view, in the eye's order

| Situation | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| A move due | The art with the couch on the scale; your ring at Ep 4 | **The strip, yellow**: "Set your lineup for Ep 5 · locks Sun 8:00 PM" | The control's line: "Through Ep 4 · Ep 5 Sun 8:00 PM" | Last time · Ep 4's top (who left) |
| All set | the same | The strip, quiet: "All set for Ep 5" with a tick | the same | Last time's top, then a game's mini |
| Results to reveal | The art; your ring behind the others | **Reveal Ep 4 in the control, yellow** ("every game at once"), unless a move is due | The strip, quiet: "after you reveal Ep 4" | Last time · Ep 3 (your last seen) |
| On air | The art; "Ep 5 · on air now" with a live dot | Watch along in the control | The strip, quiet: "Locked for Ep 5" | Last time |
| Watching only | The art; the couch on the scale | I watched it / Watch along in the control | (no strip) | Last time |

Never in the first view: a move editor; the lock time twice; a reveal per game; Start a game; a past result brighter than what's
due; a partial card at the screen's edge.

## Test of today's page against R1–R5

| | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Today's Tonight | fails: 9–13 controls, the time three times | partly: art yes, faces too small, a past result brightest in one state | fails: progress in four forms, the move in three | fails: due and set look alike; no opponent | partly: the move card works; the sweat's numbers are far down |
| The data round 3 study (A pace, A ledger) | not measured as a composed page | passes for the pace axis | passes inside its own page | not composed | passes for the ledger |

## The gap

No version so far composes the progress control and the strip as parts of the show rather than of one tab. Until the control owns
"where you are" on every tab, each tab keeps its own spoiler line and Tonight keeps its phase heading, and R3 can't pass anywhere.
The non-obvious move is that the reveal belongs to the control, not to the strip: it changes where you are, and putting it there
lets the strip mean exactly one thing everywhere.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
