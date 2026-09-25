# Research: what a fantasy scoring system can actually extract from a show's wiki

**Status:** Research. Survivor is worked through in full; the framework at the end is what to re-run
for Traitors, The Challenge, Big Brother and anything else added later.

**Provenance, read this first.** Everything marked **[verified]** was established by this repo against
real wiki pages — the transclusion structure, the rowspan/footnote-anchor behaviour and the section
names are all recorded in `db/wiki-sync.js` and `docs/PLAN-league-types-and-wiki-connector.md`, and
were confirmed by real fetches in earlier sessions. Everything marked **[expected]** comes from
knowledge of how these pages are built and has **not** been re-checked page by page here (the sandbox
this was written in has no outbound access to fandom.com). Treat **[expected]** rows as strong
hypotheses to confirm with one `--dry` run per season before scoring anything on them.

---

## 1. The finding that matters most: ask for primitives, derive the stats

The current extraction asks the model for **conclusions** — "this person had a `zeroVotesSafe`
event". That is the direct cause of the two bugs found in use:

- a castaway who took votes at Tribal but survived produced **nothing**, because no conclusion in the
  vocabulary described her, and she vanished from the review list entirely;
- `zeroVotesSafe` is a conclusion the model reaches by *counting votes in a column* — inference over a
  rowspan-heavy grid — which is why it carries a low-confidence flag and gets dropped by validation.

Both disappear if the model is asked for the **facts on the page** instead:

> For each castaway, each episode: did they attend Tribal Council, and who did they vote for?

From that single matrix, code computes — deterministically, with no model judgement and no confidence
flag — votes received, votes cast, whether they voted with the majority, whether they attended a
Tribal at all, whether they took zero votes, whether the vote was unanimous, and season totals for
each. **One primitive yields six-plus stats.** A conclusion yields one, and only when the model
happens to draw it.

It is also not more expensive: one vote cell per attendee per Tribal is about the same number of
output tokens as one event per attendee, and it replaces several conclusions for anyone who had a
busy episode (measured in this repo: 52 tokens of event rows vs 30 for the equivalent per-player
record).

**Rule for every show: extract what the table says, compute what you want to score.**

---

## 2. Reliability tiers — where a stat lives decides whether to ask for it

The question "is this notable enough to be found by an AI prompt asking for it" resolves almost
entirely to **where on the page the fact lives**. Four tiers, in descending order of trust:

| Tier | Where it lives | Trust | How to treat it |
|---|---|---|---|
| **A** | Its own column in a structured table | High | Ask for it directly. |
| **B** | Derivable by counting a structured table | Highest — *if computed in code* | Extract the raw cells, derive in code. Do **not** ask the model for the derived answer. |
| **C** | A footnote marker attached to a table cell | Medium | Ask, resolve by anchor (never by number — they differ per season **[verified]**), mark low confidence, review. |
| **D** | Prose only (episode recaps, per-episode articles) | Low | Don't ask. No cross-check exists, and this is where hallucination is unconstrained. |

The connector already resolves footnotes by anchor **[verified]**, which is what makes tier C usable
at all.

---

## 3. Survivor: the catalog

Sources on a season page (e.g. `Survivor 44`): the **Castaways** table (inline), the **episode guide**
and the **voting history** grid — the latter two live on transcluded templates such as
`Template:S44epguide` / `Template:S44votetable`, not on the page itself **[verified]**.

### 3.1 Placement and survival

| Stat | Source | Tier | Notes |
|---|---|---|---|
| Final placement | Castaways table, Finish column | A | Already extracted; the backbone of current scoring. |
| Exit method (voted out / evacuated / quit / lost fire-making / lost final tribal / Sole Survivor) | Finish column | A | Already extracted **[verified]**. |
| Episode eliminated | Vote grid terminal cell + guide | A | Already extracted. |
| Days lasted | Castaways table (present on many seasons) | A/B | **[expected]** — when absent, derive from episode number. |
| Made the merge | Vote grid's column grouping (original / swapped / merged spans) | B | Grid header already read for `mergeEpisode` **[verified]**. |
| Made final Tribal Council | Finish column | A | Finalists are the top 2–3 rows. |
| **Jury votes received** | Jury section at the foot of the vote grid | A | **A quantity, not a flag** — the single best untapped stat. 4–3–1 reads very differently from 8–0. |

### 3.2 Tribal Council and voting — the richest vein

Every row here comes from **one** primitive: the per-episode vote matrix (who voted for whom).

| Stat | Tier | Derivation |
|---|---|---|
| Attended Tribal Council | B | Their row has a vote cell that episode. |
| **Votes received** (per Tribal, and season total) | B | Count cells naming them. The Castaways table also carries a season **total votes against** column **[expected]** — a free cross-check on the whole derivation. |
| Voted with the majority | B | Their vote names the person actually eliminated. |
| Survived a Tribal with zero votes | B | Attended, zero cells name them. *Today a model judgement; should be arithmetic.* |
| Unanimous vote | B | Every vote cast names one person. |
| Went to a revote / tie | B/C | Grid shows a second round; often footnoted. |
| Voted out with votes to spare | B | Margin between top two vote counts. |
| Number of Tribals survived | B | Count of attendances minus the one they left at. |

### 3.3 Challenges

| Stat | Source | Tier | Notes |
|---|---|---|---|
| Individual immunity win | Episode guide, Immunity column | A | Post-merge; already extracted. |
| Tribe immunity win | Episode guide | A→B | Names the *tribe*; expanding to members needs the tribe roster at that point in the season — derive, don't ask. |
| Individual reward win | Episode guide, Reward column | A | Already extracted. |
| Tribe reward win | Episode guide | A→B | As above. Watch for shared/combined reward-immunity episodes. |
| Total challenge wins | — | B | Sum of the above per person. |
| Sat out a challenge | Prose | D | Skip. |

### 3.4 Advantages and idols

| Stat | Source | Tier | Notes |
|---|---|---|---|
| Idol played | Vote-grid footnote | C | Already extracted, low confidence **[verified]**. |
| Votes nullified by an idol | Vote-grid footnote | C | A quantity; pairs with "votes received" to explain a survival. |
| Shot in the Dark played, and whether it was safe | Footnote / dedicated marker (S42+) | C | **[expected]** — season-gated; check before scoring. |
| Other advantage played (steal-a-vote, extra vote, block-a-vote, Knowledge is Power) | Footnote | C | **[expected]** — naming the *kind* is less reliable than detecting that one was played. |
| **Idol found** | Prose recaps; *some* newer seasons have an advantage summary table | D (sometimes B) | The connector deliberately excludes this today because the tables have no source for it **[verified]**. Worth re-checking per season: when a summary table exists it jumps to tier B. |
| Idol held at elimination ("went home with it in their pocket") | Prose | D | Skip — a fan-favourite stat that isn't reliably on the page. |

### 3.5 Twists and status

| Stat | Source | Tier | Notes |
|---|---|---|---|
| Original tribe | Castaways table | A | Already extracted. |
| Tribe swap membership | Castaways table's later tribe columns | A | **[expected]** — column count varies by season; the reason to read them by header, not position. |
| Exiled (Exile Island / Ghost Island / Edge of Extinction) | Episode guide column when the season has one | A | Already extracted as its own kind **[verified]**. |
| Returned to the game (Edge/Redemption) | Finish column phrasing | A/B | **[expected]** — rare, but it breaks "eliminated is final", so it matters for correctness, not just scoring. |

### 3.6 Not worth asking for

Confessional counts (not on the wiki at all — fan-tracked), screen time or edit metrics, alliance
membership, "big moves", blindside-ness. All either absent or subjective. Asking a model for these
produces fluent answers with nothing behind them.

---

## 4. Suggested scoring shape (a proposal, not a decision)

Points are a product decision — this is a starting point to react to, drawn so that the *derived*
stats carry most of the weight, since they're the reliable ones.

| Event | Points | Tier | Why this weight |
|---|---|---|---|
| Survives an episode | +1 | B | The baseline pulse; rewards picking durable players. |
| Individual immunity win | +5 | A | Rarest repeatable achievement. |
| Tribe immunity win | +2 | A→B | Common, shared by the whole tribe. |
| Individual reward win | +3 | A | |
| Tribe reward win | +1 | A→B | |
| Zero votes at a Tribal they attended | +1 | B | Now arithmetic rather than a guess. |
| Voted with the majority | +1 | B | Rewards reading the room. |
| Each vote received against them | −1 | B | The stat that started this: it makes a survivor's bad night *count*. |
| Idol/advantage played | +3 | C | |
| Votes nullified by an idol they played | +1 each | C | |
| Made the merge | +5 | B | |
| Each jury vote received | +3 | A | Scales the finale instead of flat-rating a win. |
| Sole Survivor | +15 | A | |

---

## 5. The framework for other shows

Every elimination-competition show reduces to the same four primitives. Find these and the rest is
derivation:

1. **A roster with a per-person status** (in / out / special role).
2. **A periodic elimination event** with a method.
3. **A periodic safety or advantage event** (immunity, shield, a win).
4. **A selection mechanism that produces a matrix** — who chose whom.

The show-specific work is finding which table holds each one, and what one extra dimension the show
adds that Survivor doesn't have.

| Show | Elimination | Safety | The matrix | The extra dimension |
|---|---|---|---|---|
| **Survivor** | Voted out at Tribal | Immunity (individual/tribe), idols | Vote grid | Advantages |
| **The Traitors** | Banishment at the Round Table; **murder** overnight | Shield | Round-table vote grid | **Role** (Faithful / Traitor), hidden and revealed late — plus recruitment and seduction changing it mid-season. Scoring wants role-relative credit: a Faithful banishing a Traitor is worth points a Traitor banishing a Faithful isn't. |
| **The Challenge** | Elimination-round loss | Daily-challenge win | Who *sent* whom in (house vote / winners' pick) | **Money** — a running prize pot, and teams/partners that change. |
| **Big Brother** | Eviction vote | HOH, Veto | Eviction vote tallies + nomination pairs | Two safety mechanisms interacting (Veto changes the nominees the vote applies to). |

Two things to carry into every new show:

- **The `[verified]` / `[expected]` discipline.** Do one `--dry` extraction per show and confirm where
  each primitive lives before anything is scored on it. Section names differ per wiki — this repo
  already handles that with candidate lists rather than constants **[verified]**.
- **Per-show vocabulary, shared core.** The person × episode record is show-agnostic
  (attended / eliminated / safe-by-what / chose-whom). Everything else is a per-show extension block.
  That keeps one extraction path instead of three.

---

## 6. What this research could not check

- **No page-by-page survey.** Nothing below tier A was re-confirmed against a spread of seasons here;
  every **[expected]** row needs one real `--dry` run to promote or demote it.
- **Season-to-season drift is the main risk.** Advantage mechanics (Shot in the Dark, Edge of
  Extinction, the Do-or-Die era) come and go, and the columns that carry them come and go with them.
  A schema that treats them as optional per-episode fields survives that; one that assumes a fixed
  column set does not.
- **No model comparison was run** (no credentials in this environment). `db/compare-extractions.js`
  exists to run it in one command when a key is available.
