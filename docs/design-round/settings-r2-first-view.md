# Settings, Round 2: the first views (Perception-First Design, `solve`)

> **Status (2026-11-21): Round 2, step 2 of the design process.** PFD's Mode 2 derivation on Intent's spec
> ([settings-r2-spec.md](settings-r2-spec.md)), before anything is built. It owns what's noticed first and how much is at once;
> Intent's structure stands. Phone at 390 × 844, one first view ≈ 690 px under the bar.

## Step 1: the problem

Someone inside a show wants to change how *that show* treats them (be spoiled or not, be pinged or not, be seen or not, leave), or
to bring someone onto their couch. Today they can't predict where: the show's ⋯ mixes doing and setting and hides half of it a sheet
down; the same mark has three editors that save three ways; the couch's door is two sheets under the hub's picture. They give up,
or pick the bluntest control that's visible (leave everything, mute everything).

## Step 2: layer by layer

**Foundation (attention and the entry gesture).** Constraint: a person arriving from a show is carrying one question, and the first
thing that matches their predicted location wins (information scent). Violation: two icons on the bar (gear, ⋯) look alike in
weight; if both carry settings-ish rows, scent splits and people pick the familiar ⋯, find no settings, and stop.
- **R1. The gear is the only door to things about you; the ⋯ holds only things to do, and says once where your settings went.**
  The gear and the ⋯ must differ in meaning, not only shape: no setting row survives on the ⋯.
  **Citations:** Pirolli & Card (1999) for information scent deciding where people look; Norman (1988) for mappings people predict
  from.

**L1 (pre-attentive: what's seen in the first 200 ms).** Constraint: identity and state pop before words are read: art, a face, a
red row, a yellow mark. Violation: a settings page that opens on plain rows reads as "generic settings", not "this show"; a red Leave
inside the first view is the most salient thing on it and pulls the eye to the one irreversible act.
- **R2. The subject's identity first (the show's art and name; the couch's faces), then rows; the only colour in the first view is
  the house's, never a warning; red rows sit below the first view.**
  **Citations:** Treisman & Gelade (1980) for colour and form popping out before reading; Lindgaard et al. (2006) for the judgement
  formed in the first 50 ms.

**L2 (working memory: how much at once).** Constraint: about four chunks held at once. Violation: the show's page has six rows plus
leaving; Where you are on a 30-episode season is 30 rows; the old ⋯ interleaved doing, setting and leaving.
- **R3. At most five value-first rows in a show page's first view, every control collapsed; one group of doing on the ⋯; Where you
  are's one shortcut (I've watched them all) above the list, the list scrolling inside its own frame, Save fixed under it.**
  **Citations:** Cowan (2001) for about four chunks; Sweller (1988) for split attention between interleaved kinds of item.

**L3 (meaning: reading a row right the first time).** Constraint: people read a row's value as what will happen, and a word they
predict from ("Muted", "Hidden") must mean the same everywhere. Violation: "Where you are", "Through Ep 5", "you're up to" and
"Spoiler-safe" for one fact; "Your default" without saying what it is; a per-show choice with no hint it differs from the account's.
- **R4. One name per fact, with its value spelled out: "Episodes you've watched · Through Ep 5 · Wed, Nov 12"; a row that follows
  your default says the default's value ("Your default: after you've watched"); a row set here says "here". The episode is named by
  its air date, never by number alone.**
  **Citations:** Reber, Schwarz & Winkielman (2004) for fluency making a reading feel right; Trope & Liberman (2010) for concrete
  words on near actions.

**L4 (decision: choosing without fear).** Constraint: people avoid choices whose outcome they can't foresee, and fall to the
extreme (mute forever, leave everything) when a smaller one isn't visible. Violation: Mute with only clock lengths, none tied to why
people mute (tonight's episode); Leave these games as the only leave; owner hand-off with no confirm.
- **R5. The smallest effective choice is offered first and says when it ends ("Until the next episode · until Thu 8 PM"); each
  choice carries what you'll still get or what it costs; Recommended is the default and marked; the irreversible asks or holds.**
  **Citations:** Hertwig & Erev (2009) for decisions from description needing the outcome stated; Johnson & Goldstein (2003) for
  defaults carrying most choices.

## Step 3: the requirements

| # | Must |
| --- | --- |
| R1 | The gear is the only door to settings about you on a show; the ⋯ only things to do, with one line saying where settings went |
| R2 | Identity first (art and name, or faces); no warning colour in a first view; red below the fold |
| R3 | ≤ 5 collapsed value-first rows in the first view; one kind of item per group; long lists scroll in their own frame |
| R4 | One name per fact, value spelled out, defaults named by value, episodes by air date |
| R5 | Smallest effective choice first, with when it ends; consequences in the line; Recommended default; irreversible held |

## Step 4: the solution, view by view

**1. A show's settings for you** (`?page=you`)
- **First view, in the eye's order:** (1) the show's art band with "YOUR SETTINGS" over "Survivor 51" (R2); (2) Episodes you've
  watched, its value with the air date (the most-asked row leads); (3) When a new episode airs (a followed, airing show) or When
  results show here; (4) Notifications, with "until Thu 8 PM" when muted; (5) Hide this show from my couch, its switch drawn in place.
- **Below the first view:** the rest of the five rows when a followed show has them all; Leave all my games here / Remove from my
  shows, red, after a gap.
- **Not in the first view:** any opened choice; Leave/Remove; Invite or How it works (R1).
- **Five-second test:** "this is about me on Survivor: I'm through Ep 5, it's not muted, my couch sees it."

**2. The show's ⋯, after**
- **First view:** the show's name; Backstage's plate only while something needs a runner; then up to six rows of doing, verbs
  first (Invite a friend, Plan a watch along, How it works, Draft room, Recent changes); the foot line "Your settings for this show
  are under the gear ⚙" with the gear drawn in it (R1: the move is taught where the old habit lands).
- **Not:** any switch or value about you; anything red.
- **Five-second test:** "things I can do with this show."

**3. Where you are**
- **First view:** the season's line ("Survivor 51 · Ep 7 is the latest"); **I've watched them all** as a full-width button while
  you're behind; the ledger's rows around your boundary (scrolled so "You're here" is in view, not Ep 1 on a long season); Save, fixed
  at the sheet's foot, yellow only once it would change something (step 4's rule).
- **Not:** Keep me live; any second switch; a pointer to another screen unless it's a link in one short line under Save.
- **Five-second test:** "I'm through Ep 5; tap the ones I've seen, or all of them."

**4. The hub's header and Your couches**
- **Header:** the wordmark, then the couch's name on its own line under it with a small chevron, in the muted colour so it reads as
  a place, not a headline (R2: the hub's Up next stays the first thing noticed).
- **Your couches, first view:** the current couch as a card (faces, name, "4 people · you run it", Couch settings ›); other couches
  as plain rows, each switching; Start and Join last.
- **Five-second test:** "I'm on ZT Survivor 51; tap to switch."

**5. This couch**
- **First view:** faces with the Invite tile (identity, and the one action people come for); the invite code; Chat notifications on
  this couch, its value first.
- **Below:** seasons together; the owner's rows; Leave, red, last.
- **Make someone else the owner:** a pick, then one sentence saying what moves and that you stay, the safe choice (Keep it) on the
  left, filled (Round 1's confirm style).
- **Five-second test:** "my couch: who's on it, and how to bring someone."

**Across all five:** a choice that changes what reaches you or what's shown says what you'll still get; a mute says when it ends
in the person's own words for time ("until Thu 8 PM", "until tomorrow 10 PM").

## Step 5: the proposals, tested

| Proposal | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Today (⋯ with settings, Everything else, Where you are with Keep me live) | fails: doing and setting mixed, a sheet in a sheet | partly | fails: Where you are's 34 controls on a long season; the ⋯'s three kinds | fails: four names for the mark | fails: mute by clock only; leave all only; hand-off unconfirmed |
| Intent's spec | passes, with the ⋯'s foot line | passes if Leave/Remove fall below the first view | passes | passes, with air dates | passes |

## Step 6: the gap

Intent's spec moves every setting off the ⋯, but habit will still send people there for a while (they learned Notifications and
Where you are on it). Nothing in the spec catches that habit at the moment it misfires. The non-obvious requirement is the **⋯'s
foot line with the gear drawn in it**: the one place the old path lands is where the new path is taught, so a miss costs one look,
not a lost setting. Second gap: on a long season the ledger opens at Ep 1 with "You're here" off-screen; it must open scrolled to
the boundary.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
