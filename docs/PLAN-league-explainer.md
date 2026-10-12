# Plan: "How this league works" explainer (every joiner, plus late joiners)

**Status:** Built 2026-10-11 (see **As built** at the end). Not committed; What's New entry not written.
Builds the BACKLOG #2 "How this league works" cards that `PLAN-guided-tour.md` set aside (its Classic
and Eliminator Pool chapters). Sits in front of the late-joiner start flow in `PLAN-late-joiners.md`.

## Job and audience

- **Who:** anyone who has just joined a league by code or link, on a phone, usually invited by a
  friend and keen to get going. Some are late joiners (ghosts) coming in mid-season.
- **What they need to learn:** how *this* league's game type works, and for late joiners, what
  catching up means and where to start.
- **Mode:** Read, at the speed of a broadcast package. About 45 seconds, one tap per card, Skip on
  every card.
- **Success:** they tap Done knowing how they score, and late joiners choose a start episode on
  purpose, not by accident.

## Selected direction: "Previously on…"

A short sting card sequence styled like a recap package, using the same Lower Third look as the
*Rise & Fall* tour's host plate. It plays **one made-up episode of this league**: the real cast,
photos, show terms (castaways or bakers or queens) and the league's real scoring rules, with
**randomly generated fake results**. Every card shows a red `MADE-UP RESULTS` caption tag so nobody
mistakes it for a spoiler.

- **One card, one idea.** One host line per card plus a single visual for it. An optional second
  line in smaller type gives the detail when a rule needs it (see **Copy rules**).
- **Advance on Next.** These are explanations, not actions, so Next is fine here. It's the bottom
  primary button in thumb reach. Swiping also works. A back chevron sits top left.
- **The focal moment:** the card where the made-up results land on *your* sample team and points
  count up into a mini standings row. That's what makes the rules stick.

## Copy rules

Clarity beats brevity. Each card has a **headline** (one plain sentence) and, when it's needed, a
**detail line** (one or two sentences) that removes any doubt. The copy below is the draft wording;
quoted lines are meant to be used as written.

- **Say who, what and when.** "Your {castaways}", "each episode", "before the episode airs", never
  "they", "it" or "this week" without a clear subject.
- **Use real numbers from this league.** "+5 points", "3 starters, 2 on the bench", "{n} episodes
  aired". Avoid "more", "some" and "a few".
- **No jargon without a gloss.** Snake draft, blind draft, bench, streak, ghost, replay and linked
  league are each explained the first time they appear (for example "Snake draft: you take turns
  picking, and the order reverses each round").
- **The word "ghost" never reaches players.** It's internal. Say "hidden from the league".
- **State what's permanent and what isn't.** "Revealing can't be undone." "You can change your lineup
  until the episode airs."
- **Fake is always labelled.** "These results are made up to show how scoring works."
- **Test:** a friend who has never played fantasy anything should be able to answer "how do I get
  points?" after the cards. If a line needs a third sentence, the rule is too complicated for one
  card: split it into two cards.

## Sequence

### Everyone (2 to 5 cards, depending on game type)

0. **League card.** Show art, league name, the season, "{N} players", the commissioner, the game type
   and ownership in plain words ("Classic: you draft your own team, and nobody else can have your {castaways}"). **Linked leagues:** if
   this league is in a linked group, a stacked row of each linked league with its type and one line
   ("Same cast and episodes, but you make separate picks in each league. When you reveal an episode in one, it's revealed in all of them."). Buttons: **Show me how it
   works** (primary) · *Skip*.
1. **Game type cards** (below). They use a sample team drawn at random from the real cast still in
   play (for late joiners, the cast as of their start).
2. **End card.** "That's how it works. Here's what you'll do each week:", then the weekly loop as three chips: *Watch the episode → reveal the results → set up the next episode*. Normal joiners: **Go to the draft** or **Go to my league**. Late joiners: the late-joiner
   cards follow.

### Classic (3 cards)

1. **"You draft a team of {n} {castaways} before the season starts."**
   Detail (snake): "Snake draft: everyone takes turns picking, and the order reverses each round.
   Once someone picks a {castaway}, nobody else can have them."
   Detail (blind): "Blind draft: everyone picks in private, then all picks are revealed at once. The
   same {castaway} can be on more than one team."
2. **"Your {castaways} score points based on how long they last."**
   Detail: "The last one left scores the most. In this league, the winner earns {x} points and the
   first out earns {y}." A boot-order ladder shows the sample team placed on it at random.
3. *(only if predictions are on)* **"Each episode, you can also guess who goes home."**
   Detail: "A right guess earns {x} bonus points. A wrong guess costs nothing." One made-up guess hits.

### Active Roster (3 cards)

1. **"You draft {n} {castaways}. Each episode, {starters} of them start and {bench} sit on the bench."**
   Detail: the snake or blind draft gloss, as in Classic.
2. **"Only your starters score points. Points earned on the bench don't count."**
   Detail: "Set your lineup before each episode airs. After that it's locked until the next one."
   Made-up events land: a starter gets points, and a bench player's points are greyed out with "not
   counted, on the bench". It shows the league's top 3 or 4 scoring events by point size, for
   example "Won a challenge +5", in the show's words.
3. *(if pickups or swaps are on)* **"If one of your {castaways} goes home, you can pick up a
   replacement."**
   Detail: "Pickups open after an elimination, and you choose from {castaways} nobody has drafted."
   (Swaps get their own sentence when they're on.)

### Eliminator Pool (3 cards)

1. **"There's no draft. Before each episode, pick one {castaway} you think will stay in the game."**
2. **"Each right pick adds one to your streak. A wrong pick resets it to zero."**
   Detail: "Your best streak still counts after it ends." Made-up run: ✓ ✓ ✗.
3. **"You can't pick the same {castaway} again until you've used everyone still in the game."**
   Detail: "And never the same one two episodes in a row. Players are ranked by their longest
   streak, then by total right picks."

### Late joiners only (2 cards, then the existing start step)

1. **"This season has already started. You'll play it as if it's airing now, starting from the
   episode you choose."**
   Detail: "You go one episode at a time and see results only when you say you've watched them. Until
   {commissioner} adds you to the league, you're hidden from the other players, and chat and side
   bets are off." Shows the `● REPLAY | EP n` badge as it will look: "This badge shows which episode
   you're on. Tap it any time to jump to the latest episode."
2. **"How far have you watched {show} {season}?"** A list of episode numbers only (no titles, the
   same spoiler rule as today) plus "I haven't started" and "I'm up to date (episode {latest})".
   Their answer sets the **recommendation** on the existing "Where do you start?" step, which follows
   on:
   - Haven't started → **Episode 1 (Recommended)**: "Play the whole season. Nothing gets spoiled."
   - Watched through N → **Episode N+1 (Recommended)**: "Start at the first episode you haven't
     seen."
   - Up to date → **Live, with the league (Recommended)**: "No catching up. You draft from whoever's
     still in."
   Every option states its trade-off: "Starting at episode {k}: your points count from episode {k}
     on. Anything earlier doesn't score for you." They can still pick any episode. Choosing earlier
   than their answer is fine. Choosing *later* than they've watched gets the existing confirm, worded
   plainly: "Starting at episode {k} shows you the results of episodes {a} to {b}. You can't undo this."

Skip on any late-joiner card goes straight to "Where do you start?" with no recommendation. The
start step itself is never skippable (AuthGate keeps them there, as today).

## Fake results: the rules

- Generated on the client from a seeded RNG (league id + user id), so Back/Next stays consistent.
  Nothing is written to the server or saved.
- **Never real outcomes.** Draw only from the **real scoring events in the league's rules** with
  random recipients. Never use real elimination order: the sample boot ladder is shuffled. For a
  season with results, avoid placing the actual next boot first (a cheap guard against an accidental
  real spoiler).
- **Late joiners:** the pool is the cast as it stood before their earliest possible start (Episode 1).
  Nobody who left later is shown as gone, so the explainer can't spoil.
- **No cast yet** (a league made before its cast was loaded): fall back to the *Rise & Fall* bakers
  and say so: "Sample cast until {show}'s cast is in."
- **Custom scoring rules:** use the league's copy, not the show's defaults.

## Entry points and memory

- Auto-shown **once per league membership**, right after joining (before the draft, or before the
  late-join start step). Stored per membership (`league_memberships.explainer_seen_at`, or a field on
  the player). Skipping or finishing counts as seen.
- Commissioners creating a league don't get it automatically; they chose the type.
- Replay any time: **More → How this league works**. Opening a linked league for the first time shows
  its card 0 (how it differs) only.
- Doesn't run during the *Rise & Fall* guided tour or in demo mode.

## Layout and interaction (390px first)

- Full screen over the app, night ground, show art faint behind card 0 (the same treatment as the
  front door). Top: caption tag `HOW {TYPE} WORKS` · progress shown as ticks · **Skip** (44px target).
- Middle: the visual (photos, ladder, streak). Bottom: host caption plate with the one line, then
  the primary button.
- Motion: points count up and photos slide in on the lower-third rhythm. With reduced motion, final
  values appear immediately.
- The host line is an `aria-live` region; focus moves to the card heading on each card; Skip and Back
  are reachable by keyboard. Esc skips.
- Desktop: the same cards in a centred 420px column.

## States and ranges

- Cast of 8 to 24; sample team of 2 to 6, so the photo rows wrap at more than 4. Show terms come from
  the format.
- Rules with 2 to 30 events: show at most 4 (the largest positive values, plus one negative if one
  exists).
- Linked groups of 2 to 4 leagues: card 0 lists them; more than 3 collapse to "+N more".
- Late joiner when the season has 1 aired episode: card 2 options are "I haven't started" and "I'm up
  to date" only.

## Constraints and open decisions

- Reuse `tour-host.tsx` caption tag/plate styles and the `castaway-avatar` component; no new tokens.
- Game-type copy uses the show's terms (`format.terms`), never Survivor's.
- **Open:** whether replays should reroll the fake results (current plan: same seed, a "Shuffle"
  link on the results card for fun). Whether commissioners get a one-line "you can change this in
  League Settings" note on their own replay.
- What's New entry: the user writes or approves it.

## As built (2026-10-11)

- Code: `src/components/explainer/league-explainer.tsx` (the cards), `src/lib/explainer-sample.ts` (seeded
  made-up results), `src/lib/explainer-store.ts` (open/card/answer). Mounted in AuthGate's shell and on
  `/late-join`. Replay: More -> How this league works (phone), account menu (desktop).
- Memory: migration 0057 `league_memberships.explainer_seen_at`, defaulting to now() so existing members
  and commissioners creating a league count as seen; `join-league.ts` writes null (not for a reclaimed
  seat). `POST /api/leagues/[id]/explainer-seen`; the state route returns `membership.explainerSeen`.
- Open decisions taken: replays use the same seed, plus a "Shuffle the made-up results" link; no
  commissioner note on replay.
- Late joiners (reworked after review, 2026-10-11): the explainer no longer asks how far they've
  watched. Its last card leads to the late-join step, which is now one question, "Which episodes have
  you watched?": a strip of the season (None yet, Episode 1..., All N) where tapping the last one
  finished fills everything up to it as watched and tags the next "You start here". A footer reads it
  back ("You've watched episodes 1 to 3. You'll start at episode 4."). Starting later is a separate
  "Start somewhere else" list that labels what each start would show, then a confirm naming those
  episodes. Nothing is preselected. Rationale: two adjacent number lists (watched, then start) invited
  an off-by-one that spoils.
- Differences from the plan: implied events (Quit, Final Tribal and similar) are left out of the
  made-up episode; a linked league opened for the first time shows the full sequence, not card 0 only;
  bets are explained as side bets (a question, the bet's points, pays only with two or more answers),
  since that's what `bonusEnabled` actually is.
- Verified at 390px (Studio and Night) and at 1280px on cloned Classic, Active Roster, Eliminator Pool
  and late-joiner leagues; the test data was removed.
