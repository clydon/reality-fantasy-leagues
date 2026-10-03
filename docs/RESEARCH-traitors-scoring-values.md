# Research: what Traitors scoring values should reward

**Status:** Applied as the code defaults, 2026-10-02 (`src/lib/game/formats/traitors.js`, `events`).
A league that has set its own values keeps them; "Use recommended values" resets to these. The catalog
itself (which events exist, and why recaps can report them) is `docs/RESEARCH-traitors-events.md`.

Same two questions as Survivor's `docs/RESEARCH-scoring-values.md`:

1. **Does it reward good gameplay?** Do the people who earn it more often go further?
2. **Can a roster manager act on it?** Does what's known before an episode predict it?

Plus one Traitors-only question: **is a Traitor worth fielding?** Roles are known to the audience,
and so to a league, from episode 1. If Traitors score a fraction of what Faithfuls do, the role
decides the league instead of the manager.

---

## 1. The values

| Category | Event | Was | Now |
|---|---|---|---|
| **Missions** | Won a shield or immunity | 2 | **1** |
| | Won a mission power (Dagger, Seer…) | — | 2 |
| | Credited with carrying a mission | — | 1 |
| | Gave their shield to someone else | — | 0 (tracked) |
| | Blamed for a mission failure or lost money | — | −0.5 |
| **Murder & the Turret** | Chosen for murder but saved by a shield | — | 2 |
| | On the murder shortlist and survived the night | — | 0.5 |
| | Considered for murder by the Traitors and survived | — | 0.25 |
| | Turned down the Traitors' offer | — | 1 |
| | Recruited as a Traitor | 3 | **2** |
| | Murdered | 0 | 0 |
| **Round Table** | As a Faithful, voted out a Traitor | 2 | 2 |
| | As a Traitor, voted out a fellow Traitor | — | 2 |
| | As a Traitor, voted out a Faithful | — | 0.5 |
| | As a Faithful, voted out a Faithful | — | 0 (tracked) |
| | As a Faithful, led the case that banished a Traitor | — | 1 |
| | As a Traitor, led the case that banished a fellow Traitor | — | 1 |
| | As a Traitor, led the case that banished a Faithful | — | 1 |
| | As a Faithful, led the case that banished a Faithful | — | −0.5 |
| | Accused at the Round Table and survived it | — | 0.5 |
| | Received banishment votes but survived | 1 | **0.5** |
| | Zero votes against | — | 0.5 |
| | Banished as a Faithful / as a Traitor | −3 / −3 | −3 / −3 |
| **Leaving / Endgame** | Left the game | −5 | −5 |
| | Finalist (runner-up) | 3 / 5 | 3 / 5 |
| | Finalist who lost to a Traitor (fooled to the end) | — | −3 (on top) |
| | Banished in the finale (instead of −3) | — | −1 |
| | Won the season | 5 / 10 | 5 / 10 |
| | Won as a Traitor (bonus on top) | — | 2 / 3 |

`a / b` = exclusive / shared ownership. The settings inputs now step in 0.25s
(`active-roster-settings-section.tsx`).

---

## 2. Data and method

**Dataset:** the fandom wiki's per-season voting grids (`Template:<Season> Voting History` on
thetraitors.fandom.com, read through its API). Every finished English-language season with the
standard rules: **US1–4, UK1–4, UK Celebrity 1, AU1–3, CA1–3, NZ1–3, IE1–2: 20 seasons, 437 people,
2,975 person-episodes**, 228 banishments, 149 murders, ~2,800 Round Table votes. (US5, US6, CA4 and
UK Celebrity 2 were in progress.)

Each grid cell is `{{c|class|text|colspan|rowspan}}`. The class is the person's status that
episode (shield, shortlisted, Dagger, Seer) and the text is their vote. Banishments come from the
Banishment row, murders and the finale from the person's row, roles from the faction marker and
recruitment from the Traitors' Decision row. Events are mapped exactly as `traitors.js` derives
them, with the role checks (`banishmentVoteEvent`).

**Measures** (as in the Survivor study):

- **Link to going far:** Spearman correlation between how often someone earned an event (per Round
  Table attended, or per episode) and their placement percentile in their season. People with 3+
  episodes only. Faithfuls and original Traitors are measured separately, since their goals differ.
- **Predictability:** AUC of a signal known before the episode (0.5 = coin flip).
- **Balance:** points per episode by role, and where each season's winner ranks on points before the
  finale.

**What this can't measure:** the recap-only events (accused, led the case, considered for murder,
mission standout or blunder, gave a shield, shield saved them) aren't in any table. Their values are
reasoned from the nearest measured event, below. Also, the grids' `immune` class means different
things in different seasons, so immunity isn't counted as a shield here.

---

## 3. Findings

### 3.1 How often things happen (per season, mean of 20)

| Event | Per season | Faithful | Traitor |
|---|---|---|---|
| Zero votes at a Round Table | 86 | 70 | 16 |
| Voted out a Faithful | 56 | 43 | 13 |
| Received votes, survived | 24 | 20 | 5 |
| Voted out a Traitor (Faithful) | 23 | 23 | — |
| Shield | 15 | 12 | 2.5 |
| Murdered | 7.5 | 7.5 | 0 |
| Banished | 11.4 | 7.4 | 4.0 |
| Traitor voted out a fellow Traitor | 4.8 | — | 4.8 |
| On a murder shortlist, survived | 3.5 | 3.5 | — |
| Recruited | 1.7 | | |
| Won a power (Dagger/Seer, from the use) | 0.6 | | |
| Turned down recruitment | 0.3 | | |

There are ~121 Faithful and ~28 Traitor person-episodes per season. Winners per season ranged from 1
to 4 (mean 1.75), and Traitors won 12 of the 20 seasons (15 of 35 winners).

### 3.2 What good play looks like

| Event | Faithfuls | Original Traitors |
|---|---|---|
| Voted out a Traitor | **+0.51** | — |
| Traitor voted out a fellow Traitor | — | **+0.52** |
| Voted out a Faithful | −0.01 | **+0.37** |
| Zero votes | +0.12 | **+0.35** |
| Shield | +0.17 | +0.11 |
| Received votes, survived | +0.01 | +0.06 |
| On a shortlist, survived | +0.02 | — |

- **Catching Traitors is the single best signal of good Faithful play**, and the Traitor mirror,
  sacrificing a partner to stay clean, is the best signal for Traitors.
- **Steering the vote onto Faithfuls is good Traitor play** (+0.37) but means nothing for a Faithful
  (−0.01).
- **Shields barely track good play**, and surviving votes doesn't at all.

### 3.3 What a manager can see coming

| Event | Signal known beforehand | AUC |
|---|---|---|
| Banished | Votes received per Round Table so far | **0.63** |
| Banished | Votes received last Round Table | 0.61 |
| Voted out a Traitor (Faithful) | Catches so far | 0.59 |
| Zero votes | Zero-vote rate so far | 0.59 |
| Received votes, survived | Votes received last time | 0.58 |
| Murdered (Faithful) | Shortlisted before | 0.56 |
| Murdered (Faithful) | Times voted out a Traitor | 0.54 |
| Shield | Shields so far | **0.52** |

And the signal that matters most, since a league knows everyone's role:

| | Banished per episode | Murdered per episode |
|---|---|---|
| Faithful | 6.2% | 6.3% |
| Traitor | **14.6%** | 0% |
| Traitor, first half of the season | 8.2% | |
| Traitor, second half | **25.2%** | |

- **Banishment is the readable risk** (0.61–0.63), and the −3 for it is where roster management
  lives: bench whoever is drawing votes, and a late-season Traitor.
- **Murder is close to unreadable** (0.54–0.56). That's the case for keeping it at 0.
- **Shields are luck** (0.52), and they come in bulk (12–15 in a single mission three times in these
  seasons).
- Weekly scores are noisy under any values, as in Survivor (§3.4).

### 3.4 Old vs new values, on the same 20 seasons

"New" is the final set: the vote split by role and the finale fixes (§3.6, §4). "Before the finale"
excludes the winners' and finalists' last episode.

| | Old | New |
|---|---|---|
| Points per episode, Faithful (before the finale) | +0.52 | +0.67 |
| Points per episode, **Traitor** | **+0.10** | **+0.78** |
| Season total, original Traitor (median) | −0.5 | +4.2 |
| Points per episode vs how far players go | +0.50 | **+0.70** |
| Week-to-week predictability (points so far → above-median week) | 0.56 | 0.61 |
| Winners ranked top 3 in their season on pre-finale points | 22 of 35 | 30 of 35 |
| Share of + points from shields | 24% | 9% |

Under the old values a Traitor was close to a wasted lineup slot until the finale: they can't score
the main weekly event (catching a Traitor), shields go mostly to Faithfuls, and their one big risk
(banishment) costs the same. The new values fix that mainly through the Traitor mirror, zero
votes and the Traitor's vote against a Faithful, not by softening the banishment. Traitors now score
a little more per week than Faithfuls (+0.78 vs +0.67), which fits: they're banished more than twice
as often, so fielding one is a bet.

### 3.5 Variants tried

Starting from the first-pass set (before the vote was split by role), one change at a time (Faithful / Traitor points per episode before the
finale; link to going far; winners ranked top 3 on pre-finale points):

| Change | F / T per episode | Link | Winners top 3 | Verdict |
|---|---|---|---|---|
| **(new set)** | +0.65 / +0.50 | +0.65 | 29/35 | |
| Zero votes 0.25 | +0.50 / +0.35 | +0.62 | 28 | worse on every measure |
| Zero votes 0 | +0.36 / +0.20 | +0.59 | 26 | worse |
| Survived votes 1 | +0.73 / +0.59 | +0.65 | 28 | no better; no link to play (+0.01), and *accused* now covers the moment |
| Shield 2 | +0.75 / +0.59 | +0.61 | 28 | worse link |
| Shield 0.5 | +0.60 / +0.45 | +0.66 | 29 | about the same; 1 is easier to read |
| Voted out a Traitor 3 | +0.83 / +0.50 | +0.64 | 24 | unbalances the roles |
| Traitor mirror 1 | +0.65 / +0.33 | +0.64 | 26 | Traitors fall behind |
| Traitor mirror 3 | +0.65 / +0.67 | +0.65 | 29 | fine too; 2 matches the Faithful catch |
| Banished as a Traitor −2 | +0.65 / +0.64 | +0.65 | 29 | not needed; the late-season risk *is* the decision |
| **Voted out a Faithful 0.5** | +0.83 / +0.71 | **+0.69** | **30** | best on the numbers; see §4 |
| (old values) | +0.52 / +0.10 | +0.50 | 22 | |

### 3.6 The finale

Three finale fixes were tested on whole-season totals (finale included), against how each person
actually finished (winners, then finalists who didn't win, then by exit order):

| Fix | Season total vs result | Finale week for the person affected | Verdict |
|---|---|---|---|
| (before) | +0.899 | banished −2.3, fooled finalist +6.3, sole winner +14.8 | |
| Banished in the finale −1 instead of −3 | **+0.914** | banished −0.3 | **adopted**: measurably better |
| Fooled to the end −3 | +0.899 | fooled finalist +3.3 | **adopted** (see below) |
| Sole winner +3 | +0.899 | sole winner +17.8 | **dropped**: a winner already tops their season's total in all 20 seasons |

- **Finale banishment.** 2.4 per season (the last Round Table and the Fire of Truth). Reaching the
  final handful is an achievement, and the −3 was making these people's best week their worst.
- **Fooled to the end.** In all 20 seasons, **every finalist who didn't win was a Faithful beaten by
  a Traitor**: when the Faithfuls win, everyone left shares the pot. So the finalist points (+5
  shared) were in practice points for being fooled. 12 cases, including US4's Maura. It doesn't
  change any ranking, but it stops rewarding the outcome the game counts as a loss. Netting +2 still
  credits reaching the end.
- **Sole winner.** Half the seasons had a shared win (2–4 winners), but the winner already outscores
  everyone either way, so a bonus would only widen a gap that's already decisive.

---

## 4. Reasoning per value

- **Voted out a Traitor 2, Traitor mirror 2.** The strongest good-play signal on each side,
  predictable from history (0.59), and about 30% + 6% of all positive points. Equal by default; the
  split lets a league value a sleuth and a backstabber differently.
- **Led the case: the same four pairings as the vote (not measured).** A Faithful catching a
  Traitor +1, a Traitor sacrificing a partner +1, and a Traitor framing a Faithful +1. Each sits on
  top of the matching vote, for whoever drove the outcome, and below the vote because "who led" is a
  judgement call. **A Faithful leading the table to banish a Faithful costs −0.5.** Unlike a wrong
  vote, leading is one person's deliberate push. The data can't back this value, so check it once a
  season has been read from recaps.
- **Zero votes 0.5.** The most common event (86 per season), so small, but it tracks good play
  (+0.12 Faithful, +0.35 Traitor), it's readable (0.59), and every variant without it was worse.
  It's the same role Survivor's zero-votes-safe plays.
- **Survived votes 1 → 0.5, accused 0.5 (not measured).** Surviving votes has no link to going far,
  but "in danger and lived" is a real roster read (0.58), and accusation and votes usually come
  together. 0.5 each keeps the combined moment at the old 1.
- **Voted out a Faithful: split by the voter's role, 0.5 for a Traitor, 0 for a Faithful** (decided
  after the first pass, at the league owner's prompting). Tested on the 20 seasons, with Faithful /
  Traitor values: 0 / 0 gives link +0.65 and 29/35 winners in the top 3; **0 / +0.5 gives +0.67 and
  30/35**, the best tested; 0 / +1 overshoots (Traitors +0.92 a week); −0.25 / +0.5 gives +0.65 and
  29; −0.5 / +0.5 gives +0.63 and 27. Penalising a Faithful's vote makes every measure worse: the
  average Faithful casts 2.2 such votes a season (max 8), so it punishes being in the room on a bad
  week. What follows was the reasoning for the unsplit event: it was the best single change on the numbers (+0.69 link, 30 of 35 winners in the top 3),
  because deep players vote more and Traitors steering the vote is genuinely good play. But for a
  Faithful it pays for being wrong, which reads badly ("+0.5 for banishing your own"). Left at 0 with
  the tested value in the code comment; **a league can switch it on.**
- **Shield 2 → 1.** Luck (0.52), weakly tied to play, sometimes handed to a dozen people at once, and
  it was 24% of points.
- **Shield saved them 2 (not measured).** Rare (1 in the three US seasons read) and the payoff for
  fielding a shield-holder the night the Traitors come for them. The shield itself adds 1, for 3 in
  total.
- **Shortlist 0.5, considered 0.25 (considered not measured).** Surviving the shortlist has no link
  to play (+0.02) and murder is barely readable, so these stay small. "Considered" is lower because
  recaps report the turret's options most weeks, so it would quietly become a large passive
  category.
- **Won a power 2.** Rare (0.6 per season) and decisive (a double vote, the Seer's reveal), the
  nearest thing to an individual immunity win.
- **Mission standout 1, blunder −0.5 (not measured).** Mirrors Survivor's challenge placings and
  sit-outs. Kept small because recaps only sometimes name anyone.
- **Gave a shield 0 (tracked).** Can't tell generosity from a Traitor's tell (Danielle, US3).
- **Turned down recruitment 1.** Rare; a loyalty moment that a league might want to see score.
- **Recruited 3 → 2.** Recruits already score well: they play the longest (9.1 episodes on average,
  vs 7.3 for original Traitors and 6.5 for Faithfuls), and their median season total is the highest
  of any group (+9).
- **Won as a Traitor +2 / +3.** Traitors win most seasons, but usually alone and after surviving
  the late-season banishment risk (25% per episode). (US4's Rob R. ranks 1st in his season on
  pre-finale points under the new values, against 13th under the old.)
- **Banished −3 either way; murdered 0; left −5; finalist and winner unchanged.**

---

## 5. Open decisions

- [x] "Voted out a Faithful": split by role, 0.5 for Traitors, 0 for Faithfuls.
- [ ] Re-run when US5, US6, CA4 and UK Celebrity 2 finish.
- [ ] Once a season has been read from recaps, check the not-measured values (accused, led the case,
      considered, standout, blunder) against how often they actually fire.

## 6. Re-running this

The scripts are in `docs/research-scripts/traitors/` (Python 3, standard library only):

1. `fandom.py`: fetches a page's wikitext through the fandom API (`api.php`; plain page URLs are
   behind a bot check).
2. `grid.py`: parses a voting grid, with rowspan and colspan, into person rows and label rows.
3. `dataset.py`: builds one row per person per episode for the seasons listed at its top (fetching
   any grid not already in `grids/`). Merges
   identical neighbouring sub-columns into one Round Table. Takes banishments from the Banishment
   row. Run the scripts from this folder: `python dataset.py && python simulate.py`.
4. `analyze.py`: frequencies, links and predictability. `simulate.py`: scores the seasons under
   value sets and compares them.

## Sources

- The Traitors fandom wiki, per-season `Template:<Season> Voting History`:
  https://thetraitors.fandom.com
- Survivor method: `docs/RESEARCH-scoring-values.md`
