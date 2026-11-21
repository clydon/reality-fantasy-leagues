# Settings, Round 0: what each home shows first (Perception-First Design)

> **Status (2026-11-20): Round 0, step 2 of the design process.** A Mode 2 derivation (`/perception-first-design:solve`) on
> Intent's structure ([settings-r0-spec.md](settings-r0-spec.md)). It hands Impeccable the first-view requirements for each home,
> at 390 × 844 on the app's dark "Lower Third" ground. Nothing here is built.

## Step 1: the design problem

People open settings rarely, and always for a reason: a nuisance (the couch's chat buzzing through the episode), a fear (a spoiler
on a show they stream late) or a fix (a name, a game they're out of, a late friend who needs the lock opened). They arrive mid-task,
often annoyed, on a phone, with no map of where anything lives. What they meet first today:
- Settings opens on a stack of open controls (twelve choices in Quick settings), with folds named in the house's words.
- A show's ⋯ mixes things to do, settings, navigation and leaving in one list.
- A runner's page puts the rules of every game they run in one place.

The thing they came for is often not in the first view, is in another home, or goes by another name. So they leave without fixing
it, fix the wrong thing (Hide scores on a show they only follow, where it does nothing), or switch everything off.

## Step 2: the layers, bottom up

### L0 · Cognitive load
- **Constraint:** working memory holds about 3 to 5 chunks, and visual noise the person never consciously reads still spends it.
- **Violation:**
  - Today's Settings first view carries about 12 open options before its first heading: the phone plate's two buttons, chat's
    three, two switches with their lines, and appearance's three.
  - The show's ⋯ sheet interleaves four kinds of row.
- **R1.** Each home's first phone view MUST:
  - hold at most five chunks;
  - give each group one value-first line, collapsed;
  - open no control in the first view, except the one a link or the situation brought you to;
  - never interleave things to do, settings, and leaving.

**Citations:** Cowan (2001) for the 3–5 chunk ceiling; Hassin et al. (2009) for unattended visual noise still consuming working
memory.

### L1 · First impression
- **Constraint:** the first impression forms in about 50 ms. It decides whether attention switches on, and it's classified before
  it's read.
- **Violation:**
  - A show's ⋯ sheet opens on a mixed list with nothing saying "this is about you on this show".
  - Today's Settings greets most accounts with a large yellow plate. Settings D (2026-10-31) put it there on purpose: nothing
    reaches you is the one state worth fixing. But it's the first thing seen, whatever the person came for.
- **R2.** The first glance MUST say whose settings these are and what about:
  - the subject's identity is the title (your face and name; the show's art and name; the couch's faces; the game's title card);
  - a warning plate appears only for a state that's actually wrong for this person, never above that identity.

  The yellow plate stays: it's a settled decision, and its state is real.

**Citations:** Lindgaard et al. (2006) for 50 ms judgments; Leder et al. (2004) for implicit classification before explicit
reading.

### L2 · Processing fluency
- **Constraint:** what's easy to process feels true and trustworthy, and inconsistency between elements erodes that trust.
- **Violation:**
  - One idea goes by up to seven names ("Where you are" has seven).
  - "Settings" names four screens, and Recommended takes four forms.
  - There are at least five ways to save.
  - Folds, sheets and pages hold the same kind of thing.
- **R3.** Every home MUST use:
  - one row grammar: the label says the outcome in plain words, the value sits on the second line, one Recommended mark, a changed
    dot with Reset, and one control per kind of choice;
  - one save behaviour, set by how far the change reaches;
  - one name per thing in every home, and in Start a game.

**Citations:** Reber & Schwarz (1999) for ease of processing read as truth; Alter & Oppenheimer (2009) for fluency carrying into
confidence and trust.

### L3 · Perception bias
- **Constraint:** people act on autopilot and look where their predictions say to look. Route knowledge (from here to there) comes
  before survey knowledge (a map of the whole).
- **Violation:**
  - A couch's chat is quieted in Settings, not on the couch.
  - A game's rules live in "Backstage".
  - A couch's controls sit under your picture.
  - "Hide scores until I reveal" reads like it works everywhere but does nothing on a show you only follow: a prediction broken,
    so the next setting is trusted less.
- **R4.** Every setting MUST:
  - sit behind the door where the person's prediction looks first: the subject's own, as Discord, Slack, WhatsApp and Sleeper have
    taught them;
  - do exactly what its words say, with nothing that silently doesn't apply.

  The You home MUST also be the map: under each group, the exceptions set elsewhere, each a link.

**Citations:** Clark (2013) for prediction-driven attention; Siegel & White (1975) for route knowledge before survey knowledge
(PFD learning l012).

### L4 · Decision architecture
- **Constraint:** build the environment so the right choice is the easiest one. Show consequences rather than describe them.
  Keep option density sparse at decision points and rich only inside expert workspaces.
- **Violations:**
  - **Over-muting.** Joanna's right choice (quiet this couch, or this show) is three to five taps away, while "Never" for every
    couch sits in Quick settings, one tap from the top. So she over-mutes.
  - **Consequences only described.** The consequence of "Hide scores" is a paragraph, not a picture.
  - **Destruction too close.** Leaving and deleting sit among everyday rows.
  - **The runner's rules always open.** Before Round 4 a runner's rules were always-open blocks; Round 4 fixed one page of it.
- **R5.**
  - The smallest change that solves the reason MUST be the nearest: this couch or this show before everything, this game before
    all of them.
  - Every setting that changes what reaches you or what others see MUST show its result before or as it applies: who sees what;
    what you'll still get.
  - Recommended MUST be the default, and marked.
  - Destructive rows MUST sit last, behind a hold.
  - A runner's page may be dense below its first view, because it's an expert workspace, but only behind its own door, never on a
    player's screen.

**Citations:** Hertwig & Erev (2009) for decisions from experience over description; Trope & Liberman (2010) for concrete words on
near actions.

## Step 3: the requirements

| # | Must |
| --- | --- |
| R1 | At most five chunks in a home's first view, each group one collapsed value-first line; never interleave things to do, settings and leaving |
| R2 | The subject's identity first; a warning plate only for a real problem, never above the identity |
| R3 | One row grammar, one save behaviour, one name per thing |
| R4 | Every setting behind its subject's own door, doing exactly what it says; the You home lists the exceptions set elsewhere |
| R5 | The smallest effective change is the nearest; show what a change does; Recommended is the default; destructive last, held; density only behind a runner's own door |

## Step 4: the solution, home by home (Shape 1)

**1. You** (pushed from the hub's picture)
- **In the first view, in the eye's order:**
  1. your face, name and "On ZT Survivor 51 · 2 couches";
  2. the yellow plate, only while no phone gets your notifications;
  3. four group rows, each one line with its value:

| Group | Its value line |
| --- | --- |
| Notifications | "On for this phone · reminders, results, your couch" |
| When results show | "Wait until I've watched" |
| Privacy | "Your couches see how far you've watched" |
| Appearance | "Dark" |

- **Below the fold:** Your account, Help, Sign out (last, red).
- **Not in the first view:** any open control (chat's three choices, switches); the tour; credits.
- **Five-second test:** "my settings: notifications, spoilers, privacy, the look". One thing named, not three.

**2. This show**, the ⋯ sheet
- **In the first view, in order:**
  1. the show's name over a strip of its art, with "For you" under it;
  2. four rows, value first:

| Row | Its value line |
| --- | --- |
| Episodes I've watched | "Through Ep 5" |
| Notifications for this show | "On" or "Muted until Fri" |
| Results on this show | "Your default: wait until I've watched" |
| Hide this show from my couch | "Off" |

  3. then one line of things to do: Invite · Plan a watch along · How it works.
- **Below:** "When a new episode airs" (a followed show), "Games you run here" for a runner, and Leave or Remove last.
- **Not in the first view:** a runner's job plate (jobs go to the strip); anything for the site admin.
- **Five-second test:** "this is about me on Survivor".

**3. This couch** (pushed from the couch's name)
- **In the first view:**
  1. the couch's name over its faces;
  2. Invite, with the code, as the one primary action;
  3. Chat notifications for this couch, with its value.
- **Below:** the owner's Rename, New code and Make someone else the owner; Leave last.
- **Five-second test:** "my couch: who's on it, and how to bring someone".

**4. Manage this game** (pushed from the game's ⋯)
- **In the first view:**
  1. the title card, with "You run this game" (or "Game admin: you can open or close this episode's lock");
  2. this episode's lock, with its action in words while something's due;
  3. the rules as value-first lines, about seven.
- **Below:** who's playing, the draft, the season's rules, the change history, rename; Stop last.
- **Not in the first view:** anything a player sees about their own game; Stop.
- **Five-second test:** "this game's settings, and the lock closes at 8 PM".

**Across all four:** a notification setting gets the same kind of live line privacy has. "Muted until Fri: you'll still get
reminders before your moves lock" is what makes muting safe to choose (R5).

## Step 5: the proposals, tested

| Proposal | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Today (Settings D, the show's ⋯, Backstage) | fails: about 12 open options | partly: the plate leads | fails: many names, many saves | fails: subjects split | partly: Recommended marked; no "what you'll still get" |
| Shape 1, homes by subject | passes, as above | passes | passes, if Round 1 holds the grammar | passes | passes, with the notification line |
| Shape 2, one Settings scoped | fails: the scope tabs are a fifth decision before any setting | passes inside a tab | passes | **fails**: "which tab?" isn't where prediction looks; a couch and a show tell apart by one word | passes |
| Shape 3, ask first | passes, if five questions or fewer show | passes | passes | partly: right for someone starting from the hub, wrong from inside a show or a game | **risk**: "Get fewer notifications" opens every notification control at once |

## Step 6: the gap

No proposal so far shows what a notification change leaves you with. Privacy already has its live preview ("What riley sees about
you"). Notifications have none, so muting feels like a gamble, and the safe gamble is "Never". The non-obvious part of the
solution is a "what you'll still get" line under every notification choice, at every level: You, a show, a couch.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
