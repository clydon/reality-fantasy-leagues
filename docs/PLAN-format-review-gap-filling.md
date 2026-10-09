# Plan: fill the gaps a research draft misses, on the review screen

Builds on `docs/PLAN-stage-3-format-proposals.md` (the review screen itself,
`src/components/admin/format-review-screen.tsx`) and `docs/PLAN-ai-generated-show-formats.md`. Doesn't
change the proposal/review data shape (`Proposal`, `reviewProposal` in `src/lib/game/formats/proposal.js`)
at all -- everything here produces rows that look exactly like ones the chat itself wrote.

## The problem

Testing "Research a new show" against Survivor, The Traitors and The Challenge -- shows that already have
mature, hand-tuned catalogs (`src/lib/game/formats/{survivor,traitors,challenge}.js`) -- to see what a
single copy/paste research pass finds versus years of real play surfaced genuine, trackable gaps a fresh
chat answer won't reliably think to ask about every time: Survivor's "sat out of a challenge," The
Challenge's "Purged" exit method, "called out an opponent," "nominated" (as its own signal, not just
surviving one), Traitors' considered-for-murder-style granularity, and more.

Today, adding one of those to a draft means hand-typing raw JSON into the "Edit all rules" box and getting
a checklist key to line up by eye -- there's no guided way to do it, even though the review screen already
has a fully guided editor for every OTHER part of a rule (`ConditionEditor`, `LeafEditor`, `RuleFields`).
Specifically, today:

- A brand-new checklist **question** can't be added at all. The Questions section
  (`format-review-screen.tsx` ~1104-1127) only lets you change an existing question's `type`.
- A brand-new **event** can only be created as a side effect of picking "+ New event…" from inside an
  existing rule's award/otherwise dropdown (`EventSelect`, ~340-373) -- there's no way to just add one.
- A brand-new **rule** can only be added via the raw-JSON "Edit all rules" textarea (~968-986) -- every
  rule shown elsewhere on the screen can be edited or removed, never created from nothing.

The goal: an admin who knows the show (not the chat, and not a developer) can add a missing, trackable fact
end to end on this one screen -- a question, the event it scores, and the rule connecting them -- with no
raw JSON.

## Decided

- Purely additive UI + a few pure helpers over the existing `Proposal`/`reviewProposal` shape. No new
  storage, no migration, no change to `formatProblems` or any server route.
- Applies to both a fresh draft and editing an already-approved format's rules -- the review screen is
  already the same component for both (Stage 3's handoff notes: "the exact same screen... rather than a
  second, staler, read-only copy").
- `season-rule-check.tsx` reuses `RuleLine`/`RuleFields` for a different shape (`SeasonCheck`, from
  `season-check.js`, not `Proposal`) and is **out of scope**. The new "+ New question…" affordance must be
  optional everywhere it's threaded through, so that caller keeps compiling and behaving exactly as today
  without passing it. Whether a season rule change should ever introduce a brand-new checklist question is
  a separate decision for later.
- A question added this way defaults to **tier A**. A chat's tier is a guess it has to make about research
  reliability; an admin adding one by hand already knows it's reliably reported, or wouldn't bother -- there
  is no inference to make. (Compare: `addEvent` already defaults new events to tier C, deliberately -- a
  new *scoring idea* earns the same "unproven" default the chat's own additions get. That stays as-is.)

## The pieces

All in `src/components/admin/format-review-screen.tsx` unless noted.

1. **`addQuestion(label)`**, next to `addEvent` (~834): pushes
   `{ key, type: 'answer', question: label, note: '', tier: 'A', where: '' }` onto `proposal.questions`,
   with a fresh camelCase key (same `camelId` + dedup-by-suffix pattern `addEvent` already uses). Returns
   the key.
2. **Thread `onCreateQuestion`** alongside the existing `onCreateEvent`, through `ruleFieldProps` (~768),
   `RuleLine`, `RuleFields`, `ConditionEditor`, and `LeafEditor` -- the exact path `onCreateEvent` already
   takes down to `EventSelect`. Optional (`onCreateQuestion?:`) at every level, so a caller that doesn't
   pass it (`season-rule-check.tsx`) just doesn't get the new option.
3. **`LeafEditor`'s question dropdown** (~125-140) gets a "+ New question…" option when `onCreateQuestion`
   is given, using the same `window.prompt` pattern `EventSelect` already uses (~356-358).
4. **`RuleFields`'s `field`-typed param dropdown** (~497-505 -- this is what renders a built-in's
   `vote`/`votes`/`accusations` param, e.g. `votedForLeaver`, `voteByRole`, `caseLeadByRole`) gets the same
   "+ New question…" option. It's the other spot a question gets picked from a dropdown, and today it has
   the identical gap `EventSelect` used to have before `onCreateEvent` existed.
5. **The Questions section stops being read-only** (~1104-1127):
   - `updateQuestion(key, patch)`, sibling to the existing `updateQuestionType`, for `question`/`note`/
     `tier` -- same inline `<Input>`/`<Select>` pattern already used for events just above it.
   - `removeQuestion(key)`, mirroring `removeRule`: just drops it from `proposal.questions`. Don't bother
     pre-checking whether a rule still reads it -- `reviewProposal` already raises "a rule reads a missing
     question" as a problem on save/approve, the same way every other kind of dangling reference on this
     screen is already caught. Consistent with `removeRule` itself, which already lets an event end up with
     zero rules (a warning, not a block).
   - a **"+ Add question"** button in the section header, for sketching out a question before any rule
     reads it yet (e.g. "did they sit out of a challenge" written down first, rule built second).
6. **"+ Add rule" per event**, inside each event's rules block (~1053-1072, and visible even when
   `ev.rules.length === 0`): pushes `{ when: { answer: '', is: 'yes' }, award: ev.id }` onto
   `proposal.rules.research`. `reviewProposal` picks it up on the next render as one of that event's own
   rules (it already addresses rules by `rules.research[i]`/`rules.implied[i]` -- nothing new needed there),
   and it renders through the exact same `RuleLine`/`RuleFields` every other rule uses, just starting from a
   blank condition instead of the chat's text.
7. **A generic "+ Add rule"** in the "Other rules" section (~1083-1102), for a rule that doesn't award a
   shown event (e.g. one that only `stage`s a fact for a built-in to read later, like Survivor's `exiled`
   or Traitors' `role` staging rules) -- same mechanic, no default `award`.

## Order of work

1. `addQuestion` + threading `onCreateQuestion` through every level (pure plumbing; no visible change yet,
   nothing should break -- a good point to run the existing test suite as a baseline).
2. The two question-dropdown sites (`LeafEditor`, the `field`-param case in `RuleFields`) get
   "+ New question…".
3. The Questions section becomes editable: `updateQuestion`, `removeQuestion`, "+ Add question".
4. "+ Add rule" in the events list and in "Other rules".
5. **Smoke test, by hand:** on a real draft (or a copy of one of the three built-in shows' data pasted
   into a throwaway draft), add Survivor's missing "did they sit out of a challenge" end to end -- new
   question, new event (or reuse `satOut`-equivalent), new rule connecting them -- save, confirm
   `reviewProposal` shows no problems, approve, confirm it scores on a test episode.
6. Gates per `docs/HANDOFF.md`'s working conventions: `npx tsc --noEmit -p .`, `npx eslint src`,
   `npm test`. No new test file is strictly required -- this is UI plumbing over an already-tested
   `reviewProposal` -- but if `removeQuestion` grows any logic beyond a plain filter, add cases to
   `tests/format-proposal.test.js`.

## Risks

- **Removing a question a rule still reads.** Deliberately *not* pre-blocked (see piece 5) -- leans on
  `reviewProposal`'s existing dangling-reference problem, consistent with how `removeRule` already works.
  Worth confirming by hand during the smoke test that the resulting problem message is clear enough to act
  on without reading code.
- **`season-rule-check.tsx` regressing.** Entirely avoided by making `onCreateQuestion` optional at every
  level and gating the new dropdown option on its presence -- that file's own `ruleFieldProps` (~360-367)
  doesn't change at all in this plan.
- **Scope creep into "diff against the show's current rules."** That's a different, larger idea (comparing
  a fresh research draft against an existing show's live catalog) that came up and was explicitly set aside
  in favor of this one -- the actual ask is a faster way to add a fact the admin already knows is missing,
  not an automated comparison. Don't let implementation wander into building that too.
