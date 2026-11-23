# Last time's write-up: first-view requirements (Perception-First Design, Mode 2)

On the spec `tonight-writeup-spec.md`. Measured from the user's Below Deck screenshot (2026-11-23) at 390 CSS px: the show hero
ends about 270 px down, "Last time · Ep 2" starts about 305, and the visible page ends about 715 above the tab bar. Today a
player's Your night heading sits near that fold.

## The problem

Someone opening Tonight days after an episode wants to remember what happened in it and get on to their games. Today Last time
gives them the outcome (who left, a stat) but not the episode, so the memory has to come from their own recall or a tap away on
Episodes. What stops them is recall. "Nobody left in Ep 2" doesn't bring the episode back.

## The layers

**L0, cognitive load.** *Constraint:* working memory holds three to five chunks, and a block that already has a plate, a stat
card, a GIF tile and two buttons spends most of them. *Violation (if added whole):* 450 to 600 characters is 10 to 12 lines at
15 px. That's a reading task dropped into a scanning page, and it pushes Your night a full screen down. *R1: collapsed, the
write-up MUST take at most three lines (about 70 px, about 140 characters) and add no new box, border or heading. The rest MUST
be one tap away, in place.*
**Citations:** Cowan (2001) for the three-to-five-chunk ceiling; Sweller (1988) for extraneous load crowding out the task.

**L1, first impression.** *Constraint:* the eye lands first on the highest-contrast, most face-like element, and in Last time
that's the Out plate (a face and a red tag) or, with nobody out, the white stat plate. *Violation (risk):* a bold or large
write-up (the reveal's 28 px lede) would compete with the plate for the first fixation and flatten the block's hierarchy.
*R2: the write-up MUST read as body text, regular weight, the page's own 15 px, slightly below full foreground, on the page
background (no plate, no fill), so the plate stays first and the write-up is read second.*
**Citations:** Lindgaard et al. (2006) for the first glance forming the whole impression; Leder et al. (2004) for perception
(contrast, faces) settling before anything is read.

**L2, processing fluency.** *Constraint:* text that's easy to process feels true, and one inconsistency costs the whole
surface's trust. *Violation:* some write-ups end in raw markdown ("[Source: Paramount+ recap](https://…)"), shown as-is today on
Episodes and the reveal. A truncation mid-word with no sign of more also reads as broken. *R2b (folded into R2's layer): the
write-up MUST be clean prose (no citation markup, anywhere it shows) and set exactly as Episodes' "What happened" paragraph sets
it (same size, leading and tone), so the two places read as one fact.*
**Citations:** Reber & Schwarz (1999) for ease of processing read as truth; Alter & Oppenheimer (2009) for fluency carrying into
trust and liking.

**L3, perception bias.** *Constraint:* people predict an interface from conventions they already know, and a match runs on
autopilot. *Violation (risk):* a bespoke expander (a chevron row, "Show summary", a separate button) has to be learned. *R3: the
cut MUST use the convention people already scroll past on every social app: the text fades or ends in an ellipsis with "more"
on the third line, the whole text is the tap target, and the expanded text ends with "less".*
**Citations:** Clark (2013) for predictions matched running without attention; Nisbett & Wilson (1977) for behaviour following
the familiar over the stated.

**L4, decision architecture.** *Constraint:* the block's next moves are Add your GIF, Discuss Ep N and the recap, and the write-up
is what primes them ("Rob quit over a minor cut?"). *Violation (risk):* the write-up as a door to another page would compete with
"Ep N recap", which already goes there, and pull people away before they react. *R4: the write-up MUST sit above the reactions
and doors, in place (never a navigation), and it MUST NOT add a second way to the Episodes page. Collapsed, it MUST promise
only what the tap gives: the same text, longer.*
**Citations:** Thaler & Sunstein (2008) for ordering the environment so the natural next step is the easy one; Hertwig & Erev
(2009) for the experienced moment (the story just recalled) driving the act.

## The requirements

- **R1** At most three lines collapsed, no new box or heading, the rest one tap away in place.
- **R2** Body text, regular weight, 15 px, below full foreground, on the page; clean prose, set as Episodes sets it.
- **R3** The social-caption convention: "… more" on the cut, the whole text the target, "less" at the end.
- **R4** Above the GIFs and doors, never a navigation, no second door to Episodes.
- **R5 (from R1 and the measurement)** On a player's 390 first view, the Out plate (or with nobody out, the stat plate's top)
  MUST stay in view. Your night MAY move under the fold by the write-up's height, never more.

## What satisfies all five

Under the Out plates (or first, with nobody out), a paragraph in the Episodes paragraph's style clamped to three lines. When it's
longer, the third line ends "… more" in the foreground at semi-bold, and the whole paragraph is a button (aria-expanded) that opens
the rest in place, ending with "less". With no write-up, nothing. "Nobody left in Ep N." moves under it.

## The proposals, tested

| Proposal | R1 | R2 | R3 | R4 | R5 | |
| --- | --- | --- | --- | --- | --- | --- |
| Today: nothing on Tonight, the recap a tap away | | | | | | fails the problem (recall) |
| The whole write-up, always | ✗ | ✓ | n/a | ✓ | ✗ | 10 to 12 lines push Your night a screen down |
| The reveal's look (bold 28 px lede) | ✗ | ✗ | n/a | ✓ | ✗ | competes with the Out plate |
| The first sentence only, then a link to the recap | ~ | ✓ | ✗ | ✗ | ✓ | a sentence can be five lines; a second door |
| Intent's spec: a three-line excerpt that opens in place | ✓ | ✓ | ✓ | ✓ | ✓ | satisfies all five |

## The gap

None of the proposals said how the cut should look. Intent said "opens in place". PFD's addition is that it must be the caption
convention people already know, and that the source markup must go everywhere the write-up shows, not only on Tonight.
