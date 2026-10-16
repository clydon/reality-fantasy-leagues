# Plan: rulebooks — Admin > Shows rebuilt around one idea

Designed 2026-10-15/16 with the user (impeccable `shape`). Clickable mockup:
https://claude.ai/artifact/N9fyawYRUfgCJVuUtK9yuE (private; Admin/Commissioner, phone/full width,
Night/Studio, and ten sample rulebooks across all four kinds of show). Nothing here is built yet.

**To build it, use `docs/PLAN-rulebooks-implementation.md`.** It overrides this file in four places
(its section 2): moment ids are camelCase (`immunityChallengeWon`, not `immunity.won`); migrated rules
are frozen verbatim until first edited; leagues keep a cached copy of compiled rules (no
hydrate-on-read); and phase start episodes are confirmed by a person, never inferred.

## The problem

Admin > Shows is hard to navigate, and the rules behind a show are the hardest part of it.

- **Rules are in three places under three names.** Show settings has a "Rules" dropdown (one format for
  the whole show). "Formats & rules" lists formats split into Built in and Researched. Each season has a
  "Rules" tab that is really "check for rule changes".
- **Built in vs Researched is an implementation detail.** Built-in means the rules are code
  (`src/lib/game/formats/survivor.js`); researched means they're a `show_formats` row. Neither tells an
  admin anything about the show. Both imply a show has one fixed set of rules, which isn't true: a
  season can change the game, and so can an episode partway through.
- **The structure is invisible.** Every rules screen is a list of scoring events. How a season actually
  runs (phases, groups, roles, ways to leave, the finale) is in the data, but no screen shows it, to an
  admin or a commissioner.
- **The editing model doesn't scale to 50 shows.** A format is 20–40 events, a research checklist, and
  research and implied rules written in a rule language. An "edit show rules" screen built on that is 20+
  blocks of things that only make sense if you know the engine.

## Decisions (confirmed with the user 2026-10-15)

1. **A season owns its rulebook.** Each season has its own. A new season starts as a copy of the
   previous season's and can be edited freely. A change partway through a season is an entry on that
   season's timeline, from episode N, and it can edit or remove things, not only add them.
2. **There is also a rulebook library**, for starting templates and for building a show's rules from
   scratch.
3. **Commissioners get the same rulebook screens, for their own league only.** By default they read.
   "Make it ours" gives the league its own copy to edit. It never touches the season's rulebook or any
   other league.
4. **The first rulebook made for a season becomes its parent.** On a show or season with no rulebook
   yet (a self-serve researched show), the first commissioner to write one makes the season's starting
   rulebook. Later leagues on that season follow it, and the admin can take it over.
5. **The admin can correct every league at once.** Thousands of leagues each adopting a fix by hand
   doesn't work when a rule is broken. See "How edits reach leagues". This replaces decision 2 of
   `docs/PLAN-season-rule-changes.md` (commissioner adopts every change).
6. **Commissioners can copy their own season's rulebook or build from scratch.** Browsing the whole
   library is for later.
7. **Not every show is a competition.** Series (Below Deck, Scrubs, HBO's Harry Potter), talk and
   variety (late-night shows), and live sport or events (X Games) can be added too. The first question
   when adding a show is what kind it is (see "Layer zero").
8. **A rulebook describes the show; a game type decides how a league plays it.** What players draft,
   pick or mark off belongs to the game type, never to the rulebook. Game types are their own future
   library (see "Rulebooks and game types are separate").

## The core idea: one noun, "rulebook"

"Rulebook" replaces format, rules, ruleset, built-in, researched and rule change everywhere a person
reads it. Every rulebook has:

- **An owner:** a season (the admin's), a league (a commissioner's), or the library (a template or a
  standalone draft).
- **A parent:** one line of where it came from. "Started from Survivor 50", "Researched 3 Oct",
  "Built from scratch", "From the Survivor template". Built-in vs researched survives only here, as
  history.
- **A timeline:** what's in force from episode 1, then each edit from episode N.
- **A status:** draft or in force.
- **A reader:** which wiki connector reads it ("Survivor wiki", "Traitors wiki", "Challenge wiki",
  "Research only"). This is the one honest leftover from the code half (`defineFormat`'s second
  argument). It's shown as one quiet line, never as a category.

## Layer zero: what kind of show is it?

Adding a show starts with one question. It's a full-screen flow (DESIGN.md's create-a-league pattern),
in three steps: **kind → how to start (research, a template, or scratch) → name it**.

| Kind | What it means | Like |
|---|---|---|
| **A competition** | People get knocked out until someone wins | Survivor, Bake Off, The Bachelor, The Amazing Race |
| **A series** | The same cast every week, and nobody's playing to win. Reality or scripted | Below Deck, Real Housewives, Scrubs, Harry Potter |
| **Talk, variety or awards** | A host, guests and bits, different every night. Nobody leaves, nobody wins | Late-night shows, sketch shows, awards nights |
| **A live sport or event** | Athletes or teams compete in events; results arrive as they happen | X Games, the Olympics, a tournament |

The kind doesn't add blocks. It renames them and hides the ones that don't apply, so no show ever
has more than six:

| Block | Competition | Series | Talk, variety or awards | Live sport or event |
|---|---|---|---|---|
| 1 | Who's playing | The cast | Regulars | Who's competing |
| 2 | The season | The season | The season | The schedule |
| 3 | Each episode | Each episode | Each show | Each event |
| 4 | Ways out | Comings and goings (fired, quit, killed off, new hires) | *hidden* | Withdrawals |
| 5 | Twists | Twists | *hidden* | *hidden* |
| 6 | Points | Points | Moments | Points |

It also sets **where results come from by default**. People watch live, on release, so wikis that fill
in days later can't be the only source (memory: non-competition shows brainstorm 2026-10-11):

- **Competition:** the wiki connector, then research.
- **Series:** research the morning after, then the league answers what it misses.
- **Talk, variety or awards:** the league says what happened, as it watches.
- **Live sport or event:** a results feed, later. Research until then. Sports stay at the level of
  abstractions for now: a pool of people, moments that score per unit, and a results source.

Non-competition shows need one more answer to "Who decides it?": **Nobody**. That's a regular part of
an episode where nothing is contested (a monologue, a charter, a preference sheet meeting). It
generates no moments of its own; the moments are what can happen in it.

## Rulebooks and game types are separate

A rulebook says what the show is and what can happen. It offers two pools:

- **The cast:** the people, pairs or panel (block 1).
- **The moments:** everything blocks 3–6 build, plus moments added by hand.

A **game type** says how a league plays with those pools: Active Roster, Classic, Eliminator Pool, and
in future Bingo, Live react, Predictions only, Quiz and others. A league picks a game type and a
**length**: the whole season, a few episodes, a week, or one night.

Each game type states what it needs from a rulebook, and the app offers only the game types a rulebook
can feed. The rulebook page shows this as "Fits these games":

| Game type | Needs | Fits |
|---|---|---|
| Active Roster | A cast whose moments score | Competitions, series, sport |
| Classic | People leaving one by one, and a winner | Competitions |
| Eliminator Pool | Someone going home most episodes | Most competitions (not Love Island's irregular dumpings) |
| Bingo | Plenty of moments | Everything with five or more moments |
| Live react | Moments the league can call as they happen | Everything |
| Predictions, Quiz | Anything | Everything |

So a late-night show isn't "a moments show": it simply has no ways out and no fixed cast, so it fits
Bingo, Live react, Predictions and Quiz. A game-type library, and configurable lengths, deserve their
own plan. This plan only needs to keep the rulebook's two pools clean and expose what each one
contains.

## The six blocks

A rulebook is six blocks. The first five describe the show. The sixth, Points, is mostly built from
them. Each block is a short list of items, and each item is a few plain questions with fixed answers.
Nobody writes a rule.

| Block | Answers | Typical size |
|---|---|---|
| **1. Who's playing** | Who's in the cast (people, pairs, a panel), what one and more than one are called, the usual size, whether they're in groups and how those change | One page of questions |
| **2. How the season runs** | Phases (when each starts and what changes), and the finale | 1–4 phases + the finale |
| **3. Each episode** | The segments, in broadcast order | 1–4 segments |
| **4. Ways out** | How people leave, and how they finish (finalist, winner, an ending) | 3–7 |
| **5. Twists** | Secret roles, advantages, comebacks and arrivals, side trips. Optional | 0–3 |
| **6. Points** | What each moment is worth, plus moments added by hand | built, + 0–5 added |

### Vocabulary (decided 2026-10-16)

One word per idea, everywhere: the editor, the research prompt, the data, player-facing pages.

| Say | Not | Meaning |
|---|---|---|
| **Rulebook** | format, ruleset, rules, built-in, researched | Everything about how a season is played |
| **Segment** | beat, round, event | A regular part of an episode: a challenge, a vote, a monologue |
| **Moment** | event (in rulebook screens) | Something that can happen and score |
| **Way out** (series: **coming or going**) | exit method | How someone leaves or finishes |
| **Advantage** | power, idol (as the generic) | A twist someone holds and uses |
| **Comeback** | return, re-entry | Someone who left coming back, or someone new arriving |
| **Side trip** | journey, exile (as the generic) | Someone sent away from the main game for a while |
| **Phase** | stage, era | A stretch of the season that plays differently |
| **Viewers** | the public, audience | People at home who vote |
| **Fix a mistake** / **The show changed** | patch, delta, rule change | The two kinds of edit |

A segment's type is never shown as a noun to choose. It's the answer to **"Who decides it?"**:

| Answer | Tag on its plate | Examples |
|---|---|---|
| **The result** | Contest | Immunity challenge, mission, a leg of the race, a quest, a technical bake, a weigh-in |
| **Judges** | Judged | Star Baker, a maxi challenge, DWTS scores, a photo shoot, firing in the boardroom |
| **A vote** | Vote | Tribal Council, eviction, the Round Table, the murder (a secret group), viewers' vote |
| **Someone picks** | Pick | A rose ceremony, a recoupling, nominations, chair turns, a Shark's deal |
| **Head to head** | Head to head | A lip sync, an elimination round, fire-making, a Floor duel, a fight |
| **Nobody** | No contest | A monologue, a charter, a preference sheet meeting |

### Every question, and its answers

These are the editor's exact questions. The same list, with the same help text, is what the research
prompt asks for and what the data stores, so editor, prompt and data are generated from one schema
(`src/lib/game/formats/rulebook-schema.js`: each option is `[data value, label, help]`). Add an answer
there and it appears in the editor, the prompt and the validator together.

**Who's playing** (one page; a live summary line on top, like "18 castaways, in tribes. Tribes change
at set points."):
- *Who's in the cast?* People · Pairs (two who play as one) · A panel (they judge or invest)
- *One of them is called* / *More than one* (two text fields, side by side; used everywhere in the app
  and to find the cast on a wiki)
- *How many, usually?* (a check on cast lists; each season sets its own)
- *Are they split into groups?* No · Yes, into sides (tribes, teams, houses) · Yes, into couples ·
  Yes, into coaches' teams
- *One group is called* (when there are groups)
- *Do the groups change?* Never · At set points (set under How the season runs) · All the time
- Removed: "Players draft…". That belongs to the game type (decision 8).

**A phase** (How the season runs → a phase, or **Add a phase**):
- *What's it called?*
- *When does it start?* At an episode (+ which) · When this many are left (+ how many) · When the show
  says so
- *What changes?* (any of) Groups end · Groups are reshuffled · A jury starts · Viewers start voting ·
  New people arrive · Different segments run
- *In a sentence* (shown to players under How the season works)

**The finale:** *How is it decided?* A jury votes · Judges decide · Viewers vote · The cast votes ·
Last one standing · First to the finish · Most points · A group wins · Nobody wins. *How many reach
it?* *In a sentence.*

**A segment** (Each episode → a segment, or **Add a segment**, which starts with "Who decides it?"):
- *What's it called?* (the show's own name)
- *Who decides it?* (the six cards above)
- *Who votes?* The cast · Viewers · A jury · The judges · A secret group (votes only)
- *Who picks?* One person · Each of them · A panel (picks only)
- *Who takes part?* Everyone · Groups · Groups, then each person · Only those at risk
- *What does it decide?* Who wins · The top three · Best and worst · The full order · A score
- *What's on the line?* Nothing · A reward · An advantage · Safety · Puts someone at risk · Sends
  someone home
- *How often?* Every episode · Some episodes · Only in one phase (+ which)
- *What it scores*: the moments its answers build, each with a switch to turn off one this show doesn't
  do, then any moments added to it by hand, and **Add a moment to it**.

**A way out** (**Add a way out**; on a series, **Add a coming or going**): *What's it called?* · *What
does it mean?* They're out · They reached the end · They won · An ending · *What causes it?* (one of
the show's segments, or) Their own choice · Medical · Removed by the show · The story (scripted) ·
*Suggested points*.

**A twist** (**Add a twist** asks which kind first). Every twist has *What's it called?* and *In a
sentence*, then:
- **A secret role:** *What are the roles?* (the secret one first: "Traitor, Faithful") · *When is it
  revealed?* When they leave · At the finale · Viewers know; the cast never finds out · *Can someone
  switch?* No · Yes, they can be recruited
- **An advantage:** *What's one called?* ("an idol", "a shield") · *How do they get it?* They find it ·
  They win it in a segment (+ which) · Someone gives it to them · The show hands it out · *What does
  it do?* (any of) Keeps them safe · Cancels votes · Saves someone else · Hurts someone else · An extra
  vote · Skips a task · *How long does it last?* Until it's played · One use · One episode
- **Comebacks and arrivals:** *Who comes in?* People who left · New people · *How?* They win their way
  back · Viewers vote them back · The show brings them in
- **A side trip:** *What's one called?* ("a journey") · *Who goes?* Someone chooses them · Random · They
  win it · *What can they come back with?* (any of) An advantage · A disadvantage · Nothing

**A moment added by hand** (Points → **Add a moment** → "Something that happens", or a segment's **Add
a moment to it**):
- *What happens?* (written the way a recap would: "Got in a fight")
- *Where does it happen?* Anywhere · (one of the show's segments)
- *How is it counted?* Once an episode · Each time it happens · Per amount
- *Who answers it?* Research · The league
- *How reliably do recaps report it?* Reliably · Usually · Patchily (research only)
- A preview of the exact question: Research asks: "This episode, who got in a fight?"
- *Suggested points* (per time, or per amount, when counted that way)

### Moments are built, not written

Each segment's answers build its moments (today's "events"), each with suggested points the league can
change:

| Segment | Answers | Moments built |
|---|---|---|
| Immunity challenge | The result · groups, then each person · the top three · safety | Won it · 2nd · 3rd · Tribe won it |
| Tribal Council | A vote · the cast · sends someone home | Zero votes · Received votes and survived · Voted with the majority · Voted against the majority · (the way out) Voted out |
| Judging (Bake Off) | Judges · best and worst · sends someone home | Won it (Star Baker) · Among the best · Among the worst · (the way out) Eliminated |
| Rose ceremony | Someone picks · one person · sends someone home | Picked · Picked first · (the way out) No rose |
| Performance (DWTS) | Judges · a score | Each point · Top of the leaderboard · Perfect score |

Ways out and twists build theirs the same way. An advantage that keeps them safe and cancels votes
builds Got one · Played one · Played one that cancelled votes · Saved by one · Went home holding one. A
secret role builds role-aware votes for every vote segment ("As a Faithful, voted out a Traitor at the
Round Table"), which is what today's `voteByRole` built-in does.

### Adding anything research missed

Every block has its own **Add**, and each opens the same sheet you'd edit it with. Points also has one
**Add a moment** button, because that's where people look when a score is missing. It asks **"Where does
it belong?"** and files the answer in its block:

- **Something that happens** → a moment added by hand (anywhere, or during one segment)
- **A way to leave or finish** → Ways out
- **A twist** → Twists
- **A whole new segment** → Each episode

Filing it in its block is what keeps it working: a way out scores automatically, a segment's moments
get asked about at the right point in the episode, and the research prompt asks about it next time.
Nothing lives in Points alone except its value.

### What the editor promises, and what it won't try (pushback, 2026-10-16)

- **The rulebook never simulates the show; it only says what to look for.** "Cancels votes" doesn't
  make the app recount a vote. It means "Played one that cancelled votes" is a moment worth scoring and
  asking about. Research reports what happened; the engine scores it. That keeps every answer in
  this editor codeable, and it's why there's no rule language outside Advanced.
- **A phase that starts "when the show says so" is never guessed.** Research flags the episode it
  happened in (a per-episode question) and the admin confirms it. Inferring a merge from cast counts or
  recap prose would silently mis-score phase-limited segments.
- **Moments added by hand are only as good as their question.** "Got in a fight" works; "funniest
  moment" doesn't. Research rates each one Reliably / Usually / Patchily. Patchy ones default to "The
  league answers", and only yes/no, counts and amounts are offered, never judgement calls.
- **Live, on-release shows can't wait for recaps.** For talk shows and live calls, the league is the
  source by default (see Layer zero). Research fills in what it can the next morning.

### Templates: room to grow, and worth it

Templates are cheap (data only), and they're the single biggest lever on research quality: the prompt
includes the nearest template as a starting skeleton, so the chat corrects a shape instead of inventing
one. But each one must earn its place. **Add a template when two real shows share its shape**, and let
the library grow from approved rulebooks ("Save as template") rather than pre-building a long tail.

Today: nine (five competition, two series, one talk and variety, one live event). Proposed, from the
show list and the non-competition kinds:

| Kind | Proposed template | Shows |
|---|---|---|
| Competition | Brackets and duels | The Floor, Physical: 100, The Ultimate Fighter |
| Competition | Auditions to live shows | The Voice, America's Got Talent, American Idol |
| Competition | Game show | Jeopardy!, Wheel of Fortune (new contestants most episodes: per-episode games only) |
| Series | Docuseries | Drive to Survive, Selling Sunset |
| Talk, variety or awards | Awards night | The Oscars, the Emmys (one night of categories: Predictions and Bingo) |
| Live sport or event | Season and playoffs | NFL, NBA |
| Live sport or event | Tournament bracket | March Madness, the World Cup, Wimbledon |
| Live sport or event | Race series | Formula 1, NASCAR |

The mockup's library shows these as dashed "Proposed" cards.

### The data, and the research prompt

The research chat returns exactly the rulebook's data, and the editor edits exactly that data. In
outline (the mockup's **Edit rulebook → Advanced → As data** shows a full example):

```
{ kind, show,
  cast:     { unit, singular, plural, usualSize, groups: { type, singular, change } | null },
  season:   { phases: [{ name, starts: { type, n? }, changes: [], summary }], finale: { decidedBy, finalists? } },
  segments: [{ id, name, decidedBy, voters?, pickers?, takesPart?, decides?, onTheLine?, often, phase?, momentsOff? }],
  waysOut:  [{ name, means, cause: { segment } | ownChoice | medical | removed | story, suggestedPoints }],
  twists:   [{ type, name, ...that type's answers }],
  customMoments: [{ label, during?, counted, answeredBy, reliability, suggestedPoints }],
  leftOut:  ["anything that didn't fit, one sentence each"] }
```

The prompt (**Advanced → The research prompt**) lists every field with its allowed values and each
value's help text, generated from the schema. Three rules keep answers parseable:

1. **Only listed values.** The compiler rejects anything else, field by field. That's the same
   row-by-row "N problems to fix" verdict as today's format review.
2. **The show's own names** for segments, ways out and twists. Names are free text; their behaviour
   never is.
3. **`leftOut` instead of forcing a fit.** Anything the choices can't describe goes here as a sentence.
   The admin sees it under Advanced → "What didn't fit", which replaces today's "Needs a developer".

"Check for changes" uses the same schema: it returns a patch over these fields from episode N, so a
mid-season change can touch any answer, not just add events.

### Survivor in six blocks (from today's `survivor.js`)

- **Who's playing:** 18 castaways, in tribes that swaps reshuffle and the merge dissolves.
- **How the season runs:** Tribes (from episode 1). Merged (when about 12 remain: no groups, the jury
  starts). Finale: fire-making at the final four, then a jury vote between three.
- **Each episode:** Reward challenge, Immunity challenge, Tribal Council, and Fire-making (final four
  only).
- **Ways out:** Voted out, Lost fire-making, Quit, Medically evacuated, Finalist, Sole Survivor.
- **Twists:** Idols and advantages (an advantage: found, played, cancelled votes, used against them).
  Journeys and Exile (a side trip: chosen, can come back with an advantage or without their vote).

That's about ten cards, and it generates the same ~28 events in the same six categories the code has
today. The categories already line up with segments and twists: Challenges, Tribal Council, Idols & Advantages,
Journeys & Exile, Endgame, Leaving. The Traitors' do too: Missions, Murder & the Turret, Round Table,
Endgame, Leaving. That match is the evidence the blocks fit the engine.

## Coverage: the 50 shows

Five starting templates, one per kind of show, cover 49 of the 50. Each row is the template a show starts
from and the segments it uses (named here by who decides them: Challenge = the result, Judging =
judges, Showdown = head to head). This is a first pass from general knowledge of each format, to be checked
when each show is actually added.

**Voted out by the cast**

| Show | Each episode | Twists and notes |
|---|---|---|
| Survivor, Survivor: Australia | Reward challenge, Immunity challenge, Tribal Council (Vote), Fire-making (Showdown, final four) | Idols and advantages; tribes, merge, jury |
| Big Brother | Head of Household (Challenge → advantage), Nominations (Pick), Veto (Challenge → advantage), Eviction (Vote) | HoH and Veto as advantages; jury |
| The Traitors | Mission (Challenge, a number: money), Murder (Vote, a secret group), Round Table (Vote) | Secret roles Traitor/Faithful, recruitment; shields and mission advantages |
| The Mole | Mission (Challenge, a number), Quiz (Judging, a number: lowest goes home) | Secret role: the Mole; exemptions |
| The Circle | Games (Challenge), Ratings (Vote → Influencers get an advantage), Blocking (Pick) | Secret role: catfish |
| Squid Game: The Challenge | Game (Challenge: many go home at once), Vote | Prize pot as a number |
| The Devil's Plan | Main match (Challenge, a number: pieces), Death match (Showdown) | |
| The Challenge | Daily (Challenge → advantage), Nominations (Vote), Elimination (Showdown) | Teams or pairs; captain as a role for an episode |
| The Biggest Loser | Challenge (→ reward or advantage), Weigh-in (Challenge, a number: % lost), Elimination (Vote) | |

**Judged each week**

| Show | Each episode | Twists and notes |
|---|---|---|
| The Great British Bake Off, The Great American Baking Show | Technical (Challenge, full order), Judging (Star Baker, bottom, going home) | Extra: Hollywood handshake |
| MasterChef | Mystery box (Challenge → advantage), Team challenge (Challenge, groups), Elimination test (Judging) | Immunity pin; returns |
| Top Chef | Quickfire (Challenge → immunity), Elimination challenge (Judging) | Last Chance Kitchen (a return) |
| Next Level Chef | Platform cook (Challenge, mentors' groups), Judging | Mentors' teams |
| Hell's Kitchen | Team challenge (Challenge → reward), Dinner service (Challenge, groups), Nominations (Pick), Elimination (Judging) | Black jackets phase |
| RuPaul's Drag Race | Mini challenge (Challenge), Maxi challenge (Judging), Lip sync (Showdown) | Returns |
| Project Runway, Face Off, Glow Up | Challenge (→ immunity), Judging, (Glow Up: Face-off Showdown) | Saves, immunity |
| Lego Masters | Build (Judging) | Pairs; Golden Brick (advantage) |
| America's Next Top Model | Challenge (→ reward), Photo shoot (Judging, full call-out order) | |
| The Block | Room reveal (Judging, a number: scores) | Pairs; finale auction (a number: profit) |
| The Apprentice | Task (Challenge, groups), Boardroom (Pick), Firing (Judging) | Project manager as a role for an episode |
| Forged in Fire | Rounds (Judging) | **New cast every episode** (see gaps) |

**Performed for a public vote**

| Show | Each episode | Twists and notes |
|---|---|---|
| Dancing with the Stars | Performance (Judging, a number: scores), Results (Vote, public and judges) | Pairs (celebrity and pro) |
| The Voice | Blind auditions (Pick: coaches), Battles and Knockouts (Showdown, a coach decides), Live shows (Vote, public) | Coaches' teams as groups; steals and saves as advantages; phases change the segments |
| America's Got Talent | Auditions (Judging), Live shows (Vote, public) | Golden Buzzer (advantage) |
| American Idol | Auditions (Judging), Live shows (Vote, public) | Judges' save |
| The X Factor | Auditions (Judging), Live shows (Vote, public), Sing-off (Showdown) | Mentors' groups |
| The Masked Singer | Performance (Vote → unmasked) | Secret identity (role); guessing fits Predictions |
| So You Think You Can Dance | Performance (Judging), Results (Vote, public), Solo (Showdown) | |
| I'm a Celebrity...Get Me Out of Here! | Bushtucker trial (Challenge, a number: stars), Public vote (Vote) | |

**Race and endurance**

| Show | Each episode | Twists and notes |
|---|---|---|
| The Amazing Race, The Amazing Race Canada | Leg (Challenge, full order: last place goes home, except non-elimination legs) | Pairs; Express Pass, U-Turn, Fast Forward as advantages |
| Special Forces: World's Toughest Test | Tasks (Challenge), Removal (Pick: the staff) | Most exits are by choice; ending: "Passed" |
| Alone, Naked and Afraid | No segments; a number: days lasted | Exits by choice (tapped out); last one wins |
| American Ninja Warrior | Course (Challenge, a number: distance or time) | "Didn't advance" as a way out |
| Physical: 100 | Quest (Challenge: losers go home), One on one (Showdown) | |
| 99 to Beat | Game (Challenge: last places go home) | |
| The Floor | Duel (Showdown, a number: squares) | |
| The Ultimate Fighter | Fight pick (Pick: coach), Fight (Showdown) | Coaches' teams |

**Dating and couples**

| Show | Each episode | Twists and notes |
|---|---|---|
| The Bachelor, The Bachelorette, The Golden Bachelor | Dates (Pick: date roses), Rose ceremony (Pick → going home) | First Impression Rose (advantage); ending: engaged |
| Love Island USA | Challenge, Recoupling (Pick → single at risk), Public vote (Vote), Dumping (Vote) | Couples as groups that change; Casa Amor (a phase); bombshells (arrivals) |
| Love Is Blind | Pods (Pick: engagement) | No winner: endings "Married" / "Said no" |
| Temptation Island | No segments; moments added by hand | Endings: left together / apart / with someone new |

**The one outlier: Shark Tank.** The recurring cast is the panel (the Sharks). Each pitch is a Pick by
the Sharks, recording a number (the money). It fits the blocks if "Who's playing" allows a panel, and it
has no ways out.

### Gaps the blocks must cover (each is one answer, not a new block)

- **Pairs as the cast unit:** The Amazing Race, Lego Masters, Dancing with the Stars, The Block. Who's
  playing: "pairs".
- **Numbers:** DWTS scores, Alone's days, The Floor's squares, money, % lost. A segment can decide "a
  number", and its moment is points per unit.
- **No single winner:** Love Is Blind, Temptation Island. The finale has endings instead of a winner.
- **Roles for one episode:** a captain, a project manager. A role can last one episode.
- **A new cast every episode:** Forged in Fire, and Shark Tank's pitchers. A draft doesn't work, so only
  per-episode games fit (Eliminator Pool, predictions). The rulebook says so and the league picker
  respects it.
- **Hidden identity as the game:** The Masked Singer, The Traitors, The Mole. Roles stay hidden until
  revealed. Guessing them is the Predictions feature.

## How edits reach leagues

A league either **follows** its season's rulebook (the default, and almost every league) or plays **its
own copy**.

When the admin saves an edit, they say what kind it is:

- **"The show changed"**, from episode N. Earlier episodes keep their scores.
  - Leagues following the rulebook get it automatically. Their own points stay. New moments arrive at
    the suggested points.
  - Leagues with their own copy are offered it. Their commissioner adopts it or not, as
    `PLAN-season-rule-changes.md` designed.
- **"Fix a mistake"**, from episode N (usually 1). Scores are recalculated from that episode.
  - It reaches every league following the rulebook, and by default every own copy too. The admin can
    narrow it to followers only.
  - Where a league's copy edited the same card, the fix wins and the commissioner is told what changed.

A league sees what changed in its rulebook's timeline. It's gated like everything else: a league that
hasn't revealed episode 8 doesn't see an update that takes effect at episode 8.

At scale, an edit is one write to one rulebook. Leagues reference the rulebook's version and don't each
need writing (see engine changes).

## Navigation

Still Shows → Show → Season, two levels deep (DESIGN.md: no breadcrumbs).

- **Shows** opens with a segmented control: **Shows · Rulebooks**. The library stops being a link at the
  bottom of the list.
  - Each show row says where it stands now, not which rules it uses: "Season 51 airing · 3 results to
    review", with a chyron dot when it needs you.
- **A show's page:** each season row gets two lines, its status and its rulebook ("From Season 50 · 1
  update from ep 8"). **Add season** asks what it starts from (default: the latest season's rulebook).
  - Show settings loses the Rules dropdown. In its place: what new seasons start from.
- **A season's page:** tabs **Episodes · Cast · Rulebook · Setup**. The Rulebook tab, top to bottom:
  1. Where it came from, and who uses it: "Started from Season 50 · 212 leagues follow it · 9 play their
     own copy".
  2. **How the season works:** blocks 1–5 as a read-only rundown. This is what the commissioner
     couldn't see.
  3. **Points:** the moments, grouped by the segment or twist that builds them, with suggested points.
  4. **Timeline:** in force from episode 1, each update after it, any draft, and **Check for changes**
     (today's paste-first rules check, now producing an edit to any block). Its details stay behind
     "Show episode results", because a mid-season change is a spoiler.
  5. **Edit** (the page's primary action) opens the six-block editor.
- **The rulebook editor:** the six blocks as settings-style index rows (60px, the block's name, its
  current value as the summary line). Each opens a page of cards, and each card opens a bottom sheet
  with its questions. The sheet shows a live list of the moments the card generates. Save asks "The show
  changed / Fix a mistake" and shows who it reaches.
- **The rulebook library:** starting templates (the five kinds above), drafts, **Build from scratch**,
  and **Research a show**. Each entry lists the seasons and leagues descended from it.
- **New show:** three ways in: research its rules, start from a template, build from scratch.
- **Commissioner (League Settings > Scoring & rules → "Rulebook"):** "How the season works" first, then
  Points with this league's values (editable as today in Active Roster), then the timeline.
  - "Following Survivor 51's rulebook" or "Your own copy, from Survivor 51 · 2 updates since".
  - **Make it ours** (in the page's ⋯) creates the league copy and opens the same editor.

### On a phone (rules for the build, found by testing the mockup at 390 and 360px)

The editor is a lot of tapping through sheets, so these are requirements, not polish:

- **Never lose your place.** Tapping an answer re-renders, and it must keep the page's and the sheet's
  scroll position. In the first mockup it jumped to the top of the sheet on every tap.
- **Typing never re-renders.** Text fields update only what shows them (the sheet title, the question
  preview, the cast summary). A full re-render on blur swallowed the next tap and lost typed text.
- **44px targets everywhere:** answer chips, and a moment's on/off is its whole 48px row, not a switch.
- **Sheet footers are one row:** Cancel and the action side by side (like the reveal sheet). Remove
  goes last inside the sheet, in red. A stacked Done/Cancel/Remove took about 170px of an 844px screen.
- **Open on what you came to change.** An existing segment's "Who decides it?" is one line with
  Change, not six cards above the fold.
- **Headers hold at 360px:** the back link ellipsizes before it touches the title. Phase names wrap,
  never truncate. The unsaved-edits note is a count on phones; the list shows on desktop.

### Making the data easier to read along the way

- One status-line grammar everywhere: where it is · what's next ("Airing · ep 7 of 14 · 3 results to
  review"). This replaces "No wiki page yet", "Leagues decide results" and the like.
- Jargon out:
  - "implied" becomes "automatic, from how they left"
  - "tier C" becomes "patchy reporting"
  - "checklist" becomes "what research asks"
  - "exit method" becomes "way out"
  - "event" becomes "moment" in rulebook screens. Scoring screens keep their own words.
- The season Rules tab's pre-redesign insides (`season-rule-check.tsx`, still on the old
  Badge/Button/xs UI) are replaced by the Timeline section.
- Raw JSON and the rule language live only under **Advanced** in the editor. That's the escape hatch for
  a mechanic the blocks can't express, and the "needs a developer" flag.

## Engine changes

The engine is kept. The blocks are a new authoring layer that **compiles** to today's format data
(`FormatData`: events, eventCategories, research checklist, research and implied rules, exitMethods,
hasMerge, hasGroups, roles, recap). Scoring, research and the wiki read don't change shape.

1. **The compiler:** `src/lib/game/formats/compile.js`, pure CommonJS. Rulebook blocks → `FormatData`.
   - Moment ids are stable (`segmentId.kind`, e.g. `immunity.won`). A built-in rulebook carries an alias
     map to its legacy event ids (`immunity.won` → `individualImmunity`), so no existing league's
     points or recorded events change.
   - Tests: Survivor, Traitors and Challenge expressed as blocks must compile to the same scoring as the
     code today. Use the byte-identical regression harness approach from `PLAN-show-formats.md` phase 1.
2. **One table:** `rulebooks` (`id`, `name`, `owner_kind` season/league/library, `season_id`,
   `league_id`, `parent_kind`, `parent_id`, `parent_version`, `blocks` jsonb, `compiled` jsonb,
   `version`, `status`, `reader`, `visibility`, `created_by`, timestamps).
   - It absorbs `show_formats` (library or season owner) and `league_rulesets` (league owner); its
     parent columns are theirs.
   - `show_seasons.rulebook_id`; `leagues.rulebook_id` replaces `ruleset_id`; `shows.new_season_from`
     replaces `shows.format`.
3. **Timeline edits:** `rulebook_edits` generalises `season_rule_changes` (`kind`: show_changed/fix,
   `from_episode`, `patch` over any block, `reach`, `status`, `version`).
   - Gating stays `fromEpisode`/`untilEpisode` (`season-changes.js`).
   - Additive-only goes away. An edit can change or remove a card, because a patch on blocks recompiles
     cleanly; patching compiled rules didn't.
4. **Resolution:** `resolveSeasonFormat(db, seasonId, episode)` reads the season's rulebook plus its
   edits up to that episode. `formatOf(state)` reads the league's cached compiled data plus edits.
5. **Reaching leagues at scale:** today every league caches `settings.showFormatData`, and a change is
   pushed to each one.
   - With rulebooks, a following league stores only `{ rulebookId, version }`. The server attaches the
     compiled data when it loads league state. Game logic still never reads the database.
   - A fix's rescore re-runs decision-apply from its episode for each affected league, as a background
     job. Research-derived events are stored at apply time, so they need that re-run. Implied events
     re-derive on read already.
6. **Migration (data only, nothing scores differently):**
   - Each built-in becomes a library template, with its blocks hand-written and checked by the
     compiler test.
   - Each season gets a rulebook copied from its show's current format plus its approved
     `season_rule_changes`.
   - Each `league_rulesets` row becomes a league rulebook.
   - Old tables stay read-only until the cut-over is verified.
7. **Research prompts get simpler.** "Research a show" and "Check for changes" ask the chat for the six
   blocks, not for events plus rules. That's a far smaller target, and every answer is a choice the
   compiler can validate.

## Order of work

1. **Read-only first, no engine change.** Add the "How the season works" view, derived from today's
   `FormatData`, on the season page and the commissioner's Scoring & rules. Also the Shows · Rulebooks
   segmented control, the status-line grammar and the jargon pass. Ships value immediately and tests
   the vocabulary.
2. **The compiler and its tests.** Survivor, Traitors and Challenge as blocks, compiling to identical
   scoring. No UI. The rulebook carries `kind` from the start, and the compiler handles shows with no
   winner and no ways out (`winnerExitMethod` null), and segments nobody decides.
3. **The rulebooks table and migration,** with season ownership. `formatOf` and `resolveSeasonFormat`
   read through it.
4. **The editor** (six blocks, card sheets, generated moments) for admins on season rulebooks.
5. **Timeline edits** with show-changed/fix and reach, replacing the season Rules tab.
6. **Commissioner copies** on the new model ("Make it ours", the same editor), and first-creator-
   becomes-parent for self-serve shows.
7. **The library and the new-show flow:** layer zero's kind question, nine starting templates (five
   competition, two series, one talk and variety, one live event), build from scratch, research
   targeting blocks. "Fits these games" on each rulebook, with today's three game types.
8. **Separately, a game-type library plan:** Bingo, Live react, Predictions only, Quiz, and lengths
   (season, a few episodes, a week, one night). The first non-competition pilots (Below Deck, Scrubs)
   need at least one of these, because Classic and Eliminator Pool don't fit them.

## Open points

- **Rescore notifications:** how a fix that changes past scores is announced in a league (an alert
  strip item? a line in the episode recap?), and how it interacts with the spoiler reveal.
- **A league's own copy vs a fix on the same card:** the fix wins. Confirm the commissioner's notice
  copy when it happens.
- **A new cast every episode:** confirm the league picker only offers per-episode games for these
  shows.
- **Library browsing for commissioners:** later (decision 6). Note `league_rulesets.visibility` and
  `review_status` already exist for it.
- **Who answers league-level moments by default** for series and talk shows: the commissioner, with
  a player flag (recommended in the 2026-10-11 brainstorm, not yet decided).
- **Awards nights** sit under Talk, variety or awards. They're really one episode of category
  predictions; check they don't need their own kind once the game-type library exists.
