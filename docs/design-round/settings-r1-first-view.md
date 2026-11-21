# Settings, Round 1: what each place shows first (Perception-First Design)

> **Status (2026-11-20): Round 1, step 2 of the design process.** A Mode 2 derivation (`/perception-first-design:solve`) on
> Intent's spec ([settings-r1-spec.md](settings-r1-spec.md)), carrying Round 0's R1–R5 ([settings-r0-first-view.md](settings-r0-first-view.md))
> down to the built screens. It hands Impeccable the first-view requirements for Your settings, its Notifications page, a show's
> Notifications, a couch's chat row, the push's button and the bell's foot, at 390 × 844 on the dark Lower Third ground.

## Step 1: the design problem

A notification is the one setting people meet *before* they look for it: the phone buzzes, and the buzz is the question. Someone
arrives annoyed (the couch's chat through the whole episode), puzzled (reminders stopped coming) or worried (results before they've
watched). They want the smallest change that ends this one problem, and to be sure they won't miss the thing they still care about.
What stops them:
- The control that fixes it lives somewhere other than where the buzz came from.
- The words describe the system ("Early results are in", "Final results are in", "On the couch", "Quiet nights") rather than the
  outcome for them.
- Nothing says what they'll still get after a change, so the safe-feeling move is the biggest one: everything off.
- Their own phone's state (off, blocked, not installed) silently overrides every switch, and the switches still read On.

## Step 2: the layers, bottom up

### L0 · Cognitive load
- **Constraint:** about 3–5 chunks in working memory; noise that isn't read still spends it.
- **Violation:**
  - Notifications today are split across a plate, a three-way choice and a fold of six switches, each moment covering three to five
    push types the person never sees named.
  - The show's sheet repeats six switches with no hierarchy between "quiet this show" and "turn off one kind".
  - The You page opens with about twelve controls (Round 0's finding).
- **R1.** Each first phone view MUST:
  - hold at most five chunks above the fold, with Your settings' groups each one collapsed line (name over value);
  - present a notification kind as one outcome the person recognises, never the types behind it;
  - put a single "quiet all of this" control (Mute) above the per-kind list on a show, so the per-kind list is optional reading;
  - keep the fixed facts (invites always come; GIFs show when you post one) as plain lines, not as controls that look adjustable.

**Citations:** Cowan (2001) for the 3–5 chunk ceiling; Hassin et al. (2009) for unattended noise still consuming working memory.

### L1 · First impression
- **Constraint:** the first impression forms in about 50 ms and is classified before it's read; it decides whether attention
  switches on.
- **Violation:**
  - "Settings" opens on a heading ("Quick settings") and a large yellow plate, so the glance reads "a warning page" for an account
    whose notifications are off, and "a form" for everyone else.
  - A show's Notifications sheet looks like Settings' fold: nothing in the first glance says it's about this show.
  - The bell's foot is a warning ("Off on this phone") with no way to the settings when the phone *is* on.
- **R2.** The first glance MUST say whose settings these are and what about:
  - Your settings: your face and name first; the plate under it, only while nothing reaches you;
  - a show's Notifications: the show's name in the title area, "every season" said once;
  - a couch's chat row: the couch's name in the row's words ("Chat notifications on ZT Extra"), since the sheet's title is far above it.

**Citations:** Lindgaard et al. (2006) for 50 ms judgments; Leder et al. (2004) for classification before explicit reading.

### L2 · Processing fluency
- **Constraint:** what's easy to process feels true; inconsistency between places erodes trust in all of them.
- **Violation:**
  - The same kind goes by different words in Settings, the show's sheet and the push.
  - Saving differs by place (Undo here, none there; a confirm here, none there).
  - Recommended is a badge in one place and a word in another.
  - Chat's choice has three names for one idea ("Quiet nights", "Quiet on episode nights", "Catch up when you reveal").
- **R3.** Every place MUST use:
  - one name per kind, the same on You, the show, the couch, the push's button and the bell ("Reminders before your moves lock",
    "Results", "Your couch's activity", "Couch chat");
  - one value grammar: what it's set to on the second line, in the same muted tone, with the same "your default" phrasing wherever a
    place can override the account;
  - one Recommended mark and one Reset ("Use my default" where the default is yours, "Reset to recommended" where it's ours);
  - one save: at once, with Undo in the toast; a confirm only where Undo can't undo (results straight away).

**Citations:** Reber & Schwarz (1999) for ease of processing read as truth; Alter & Oppenheimer (2009) for fluency carrying into
confidence and trust.

### L3 · Perception bias
- **Constraint:** people act on predictions and look where they expect; when a prediction breaks, trust in the next setting drops.
  Route knowledge (from here, the way to there) comes before a map of the whole.
- **Violation:**
  - A switch reads On while the phone it would ring is off: the prediction "on means I'll hear it" breaks.
  - "Hide scores" didn't work on followed shows.
  - From a push, the route to "stop these" is: open the app, find the hub, tap the picture, Settings, a fold. None of it starts at the
    push.
  - Muting has no "for how long", so people predict they'll forget to undo it, and avoid it.
- **R4.** Every notification control MUST:
  - start its route where the buzz came from (the push's button, the bell's foot, the show, the couch), landing on the exact control;
  - read as off when the phone is off ("Off on this phone" is the value, not "On"), so On always means "you'll hear it";
  - say when a mute ends, in the mute's own value ("Muted until Fri 8 PM").
  Your settings MUST also be the map: each group's page lists what's set elsewhere, and the "Your shows, couches and games" row
  names them.

**Citations:** Clark (2013) for prediction-driven attention; Siegel & White (1975) for route knowledge before survey knowledge.

### L4 · Decision architecture
- **Constraint:** the environment should make the right choice the easy one; show consequences rather than describe them; a reversal
  should cost no more than the original choice.
- **Violation:**
  - Over-muting: the global "Never" sits nearest, while "this couch" or "this show" needs a hunt.
  - No change says what you'll still get, so turning a kind off feels like a gamble, and the safe gamble is everything off.
  - Undoing a mute or a couch's override has no visible way back ("where did I set that?").
- **R5.**
  - The narrowest fix MUST be nearest to the buzz: Mute this show on the show, this couch's chat on the couch, the kind for every
    show on You.
  - Every notification choice MUST carry a "what you'll still get" line that changes with the choice, in concrete words: "Muted until
    Fri: results, your couch's activity and chat stay quiet. Reminders before your moves lock still come." / "Off: they still land in
    the bell." / "Never: read it when you open the chat."
  - Turning something back on MUST take no more taps than turning it off (Unmute is the muted row's one action; "Use my default" is
    the overridden row's), and every exception MUST be listed under its group on You, each a link.
  - Recommended MUST be the default and marked; a confirm only where Undo can't reverse it.

**Citations:** Hertwig & Erev (2009) for decisions from experience over description; Trope & Liberman (2010) for concrete words on
near actions.

## Step 3: the requirements

| # | Must |
| --- | --- |
| R1 | Five chunks or fewer above the fold; each group one name-over-value line; kinds as outcomes, never types; Mute above the per-kind list; fixed facts as lines, not controls |
| R2 | Identity first (your face; the show's name; the couch's name in its row); the plate only while nothing reaches you, under the identity |
| R3 | One name per kind everywhere; one value grammar; one Recommended and one Reset; one save (Undo), a confirm only where Undo can't reverse |
| R4 | Every route starts at the buzz and lands on the control; values read "off" while the phone is off; a mute says when it ends; You lists every exception |
| R5 | Narrowest fix nearest; a "what you'll still get" line under every notification choice, changing with it; reversal ≤ the original change; Recommended default |

## Step 4: the solution, place by place

### 1. Your settings (first view, 390 × 844)

In the eye's order:
1. **Header:** "Your settings", Back to wherever it came from.
2. **You:** face (44), name, "On ZT Extra and ZT Survivor 51"; Edit at the right.
3. **The plate** (only while nothing reaches you): its tag, "Notifications are off on this phone", one line of cost ("Reminders before
   your moves lock and results wait in the bell"), Turn on · Not now.
4. **Five group rows**, each an icon tile, the name, the value under it, a chevron (a disclosure caret for Appearance):

| Row | Value while this phone is off | While on |
| --- | --- | --- |
| Notifications | "Off on this phone" | "On · reminders, results, your couch" |
| When results show | "After you've watched · sports live" | same |
| Privacy | "Your couches see how far you've watched" | same |
| Appearance | "Dark" | same |
| Your shows, couches and games | "3 shows · 2 couches" | same |

- **Must not be in the first view:** any open control; Your account's rows; anything for running a game.
- **Below the fold:** Your account (one row), Help (three rows), Site admin, Sign out (red, with "Also turns off notifications on
  this phone").
- **Chunk count above the fold:** identity, plate, groups as one scannable list: 3 with the plate, 2 without. **Five-second test:**
  "my settings; my notifications are off; spoilers wait; I'm visible to my couch."

### 2. Notifications (pushed)

1. **This phone**, as one row with its single action (Turn on / Turn off), or the blocked or not-installed words with their way
   forward. Under it, "Your phones: 2 get notifications" as a quiet link.
2. **"What comes to your phones"**, a heading; while nothing reaches you, a line under it, "None of these reach you until
   notifications are on", and the three switches dimmed, showing what's chosen.
3. Three switches, title as outcome, coverage as the line, and the line turns into its consequence when off ("Off · they still land
   in the bell"). Then the fixed line: "Invites and join requests always come: someone's waiting on you."
4. **"Couch chat, on every couch"**: the three choices side by side, Recommended on Skip possible spoilers, and a line that changes
   with the choice ("Messages that might be about an episode you haven't watched wait until you've caught up").
5. **"Set on a show or a couch"**: the exceptions as rows (a show's art or a couch's faces, its name, the exception), each a link.
6. The bell's line.

- **First phone view:** items 1–3. The chat choice and the exceptions sit under the fold, by design: the phone and the kinds are
  what most visits come for.

### 3. A show's Notifications (sheet)

1. **Title** "Notifications", subtitle "Survivor · every season".
2. **Mute Survivor**, first, as a row with its value ("Not muted"); a tap opens For a day · For a week · Until I turn it back on in
   place. Muted, the value is the end ("Muted until Fri 8 PM") and the row's action is Unmute.
3. **The "what you'll still get" line** directly under Mute, always visible, changing with it:
   - not muted: "Mute quiets results, your couch's activity and chat from Survivor. Reminders before your moves lock still come."
   - muted: "Quiet until Fri 8 PM. Reminders before your moves lock still come, and it all stays in the bell."
4. **"Just this show"**: the four kinds, dimmed while muted (except reminders), each with "Off everywhere, in Your settings" when the
   account has it off.
5. A link: "Your settings for every show".

- **Must not:** the phone's plate above the show's name (it goes under Mute, only while nothing reaches you).

### 4. A couch's chat row (in its details sheet)

One row, placed after the invite code and before the seasons (a setting about you sits with the couch's own facts, above leaving):
"Chat notifications on ZT Extra", its value ("Your default · skip possible spoilers" or "Never · just this couch"), a caret. Open:
the three choices, the consequence line, and "Use my default" once it's set here.

### 5. The push's button and the bell's foot

- **The push:** one button, "Notification settings", on phones that show buttons. It lands on the narrowest place: the show's
  Notifications for a show's push, else Your settings' Notifications. Never "Unsubscribe" or "Turn off all".
- **The bell's foot:** a quiet text link, "Notification settings", under the list, beside or under the "Off on this phone" foot when
  that shows. It mustn't compete with the list (it's the last line, muted).

## Step 5: the proposals, tested

| Proposal | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Today (Settings D, the show's six switches, no couch row, no push button) | fails: 12 open controls; kinds as types | partly | fails: three names for chat; Undo varies | fails: switches read On while the phone's off; no route from the push | fails: no "still get" line; Never nearest |
| Intent's spec (settings-r1-spec.md) | passes | passes | passes, if the names hold on the push and the bell | passes | passes, with the line under Mute and under each kind |
| A Notifications page that opens every kind and the chat choice on You's first view | fails: R1 (back to twelve) | passes | passes | passes | partly: nearest becomes "everything" again |

## Step 6: the gap

The spec's structure passes. What it didn't yet specify, and Impeccable must build, is the **value-as-consequence** pattern: the
same muted second line that says a setting's value must turn into what that value *leaves you with*, wherever the setting changes
what reaches you. "Off" alone is a gamble; "Off · they still land in the bell" is a decision. One pattern, used on You's rows, the
kinds, Mute and the couch's chat, is also what makes the four places feel like one system (R3).

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
