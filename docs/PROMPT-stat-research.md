# Reusable prompt: surveying a show's wiki for fantasy-scoring stats

Hand this to an AI that can actually browse the wiki. Fill in the four fields at the top and paste
the rest verbatim. Written for Survivor first, but the whole point is that it's show-agnostic — see
`docs/RESEARCH-extractable-stats.md` for the framework it encodes and for the Survivor answer to
check a response against.

Two things make it work, and are worth preserving if you edit it: it forces every claimed stat to
name **where on the page it lives**, and it separates **primitives** (cells you can read) from
**derived stats** (things you compute). Without the first you get a fantasy-rules brainstorm with no
regard for whether the data exists; without the second you get conclusions an extractor has to guess
at instead of facts it can read.

---

## The prompt

> **Show:** `{SHOW, e.g. Survivor (US)}`
> **Wiki:** `{WIKI, e.g. https://survivor.fandom.com}`
> **Seasons to check:** `{SEASONS, e.g. a spread of at least 12: 3-4 early (S1-S10), 3-4 middle (S20-S30), and 4+ recent (S40-present), named explicitly}`
> **What the show calls a contestant / a group:** `{TERMS, e.g. castaway / tribe}`
>
> ---
>
> You are helping design the data layer for a fantasy-league scoring system built on top of this
> show's fan wiki. I need to know **what can actually be extracted**, not what would be fun to score.
>
> **How the data gets used, so you can judge relevance:** an LLM is given the wikitext of specific
> sections of a season's page (and the templates those sections transclude) and asked to fill a
> strict JSON schema. That output is validated in code, then turned into per-contestant, per-episode
> fantasy points. So a stat is only worth anything to me if it is **on the page, in a form that
> repeats season after season**. A stat that exists only in an episode's prose recap, or only in some
> seasons, is close to worthless — worse than worthless if it looks extractable and isn't, because
> the model will confabulate a plausible answer and nothing downstream can catch it.
>
> ### What to do
>
> 1. **Open the actual season pages listed above.** Also open the templates they transclude — on many
>    wikis the voting grid and episode guide are not on the season page itself but on separate
>    template pages that the season page pulls in.
> 2. For each page, inventory **every per-contestant fact that appears in a structured form**: a
>    table column, a grid cell, a footnote marker attached to a cell, or an infobox field.
> 3. Note **how consistent each one is across the seasons you checked** — present in all of them, or
>    only in a run of seasons, or renamed along the way.
>
> ### How to classify what you find
>
> Sort every fact into exactly one tier:
>
> - **A — its own column or field in a structured table.** Directly readable.
> - **B — derivable by counting or comparing structured cells** (e.g. how many votes someone received
>   is not a column, but you can count the cells naming them). These are the most valuable of all,
>   because they can be computed in code from raw cells with no model judgement at all.
> - **C — encoded in a footnote marker** attached to a cell, resolved via a notes block.
> - **D — prose only.** Episode recaps, per-episode articles, trivia sections.
>
> ### What to give me back
>
> **Table 1 — Primitives.** The raw facts a model should be asked to read off the page, one row each:
> `fact | where it lives (page → section → template → column/footnote) | tier | present in which of
> the seasons you checked | boolean or quantity | notes`.
> Keep this list as small as it can be while still supporting Table 2. A primitive is something you
> can point at on the page, not a conclusion.
>
> **Table 2 — Derived stats.** Everything computable from Table 1, one row each:
> `stat | computed how (name the primitives) | boolean or quantity | why a fantasy league would care`.
> Be exhaustive here — this is free, it's arithmetic. Include season totals, streaks, margins, and
> ratios, not just per-episode flags.
>
> **Table 3 — Drift and gotchas.** Anything that changed across the seasons you checked: mechanics
> that came and went, columns that were renamed or reordered, formats that break the pattern
> (all-star/returnee seasons, tribe swaps, twist eras, non-standard finales). Say which seasons.
>
> **Table 4 — Don't bother.** Facts a fantasy system would obviously want that are **not** reliably
> on the page, with a one-line reason each. I want this list explicitly — knowing what to refuse to
> ask for is as valuable as knowing what to ask for.
>
> **Finally, a recommended minimal primitive set:** the smallest set of Table 1 rows that yields the
> largest set of Table 2 rows, and a sketch of the JSON shape you'd ask a model to fill per episode.
>
> ### Rules
>
> - **Name the pages you actually opened.** If you did not open a page, do not make claims about it.
> - **Do not list a stat you have not seen on a page.** No inference from how the show works on TV.
> - **Prefer quantities to booleans** wherever the page carries a number (how many votes, how many
>   days, how many jury votes) — a number can always be collapsed into a flag later, not the reverse.
> - **Flag your uncertainty inline.** "Present in S41-S47, absent earlier" is far more useful than a
>   confident yes.
> - Where a mechanic is unique to this show, say so plainly — I'm running this same survey for other
>   shows and need to know which parts of the answer are show-specific and which generalise.

---

## Checking the answer that comes back

- Does every Table 1 row name a **specific column or footnote**, not just a page? If it says "the
  season page", it hasn't been looked up.
- Is Table 2 substantially **longer** than Table 1? If it isn't, the primitives were chosen badly —
  the whole point is that a few raw cells fan out into many stats.
- Are quantities preserved as numbers? "Received votes: yes" is a wasted row where the grid gives a
  count.
- Does Table 4 exist and have real entries? An answer with nothing in it is a model telling you what
  you want to hear; every show has facts that live only in prose.
- Spot-check three rows against the wiki yourself before anything gets scored on them.
