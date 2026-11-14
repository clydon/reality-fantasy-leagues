# Review decisions

## 2026-11-10 · Evaluate the existing flows before changing the product
- Decided by: user; review scope interpreted by Codex.
- Why: the request was to load ghaida/intent, go through the captured flows and determine what to fix.
- Rejected: applying a broad visual redesign before the user has reviewed the findings.
- Rests on: the current conversation; [screenshot inventory](../OWN-PACE-UI-INVENTORY.md).

## 2026-11-10 · Preserve established game and pace decisions
- Decided by: user in the existing own-pace plan.
- Why: independent progress, the full wizard, per-game plates, draft synchronization, nonblocking waiver warnings and the live next-airtime cap are already product decisions.
- Rejected: narrowing game choices, adding a hard wait on slower friends, merging all game reveals for presentation, or removing the live cutoff.
- Rests on: [PLAN-own-pace-games.md](../PLAN-own-pace-games.md), [PRODUCT.md](../../PRODUCT.md), [DESIGN.md](../../DESIGN.md).

## 2026-11-10 · Use Intent for evaluation and Impeccable for an independent design check
- Decided by: user requested Intent; project guidance requires Impeccable for UI decisions.
- Why: Intent ties each issue to a task, impact and concrete change; the existing project design system supplies the visual constraints.
- Rejected: treating missing local artwork, fixture names or a development indicator as evidence that production styling is broken.
- Rests on: [Intent 1.7.4](https://github.com/ghaida/intent/blob/main/skills/intent/SKILL.md), [Evaluate](https://github.com/ghaida/intent/blob/main/skills/evaluate/SKILL.md), [Journey](https://github.com/ghaida/intent/blob/main/skills/journey/SKILL.md), C:/Users/conor/.claude/skills/impeccable/SKILL.md and reference/critique.md.

Intent was read directly from its repository for this engagement. No global skill installation was performed. Existing PRODUCT.md, DESIGN.md and the own-pace decisions supplied context without another intake interview. Assessment A was delegated to `/root/own_pace_design_review`; Assessment B to `/root/own_pace_evidence_review`, as the Impeccable critique playbook explicitly requires isolated assessments. Assessment A completed before Assessment B findings entered the synthesis.

The walkthroughs are expert predictions grounded in captures and source, not observations from participant usability studies. Assessment A visually inspected 25 representative screenshots across all six groups. Network-failure recovery, assistive technology, keyboard navigation, every game-spec permutation and production asset availability were not established by those captures. Qualitative heuristic judgments are retained without a composite numerical score because the requested Intent evaluation discourages presenting a sum of judgments as a measurement.

The screenshot named `live-boundaries/04-next-airtime-passed.png` is not proof of a correctly stamped deadline boundary: its saved API view still has `late.until = null`. Treat the absent cutoff wording and the static editor instruction as confirmed content issues. Reproduce the actual expiry with both episode air times present before claiming a backend deadline defect.

The caught-up/finish fallthrough was reproduced with the actual engine and game-view code in memory, without database changes. With latest results 3, future episode 4, seasonEnded=false and gameOver=false, marking Episode 3 caught up makes catchUp=null while an Episode 4 pick remains available; the current plate predicate chooses FinishPlate. Evidence is in `captures/own-pace-2026-11-10/caught-up-proof.cjs` and `.json`. The transition was not reproduced in an app browser session. Check a finite selected game span separately; a one-episode game can correctly finish before its season. A currently displayed placement while another person can still play is not necessarily that person's final placement.

The deterministic scan produced 96 advisory font-size findings across six source files, not 96 independent usability defects. Reconcile the documented size ramp separately from the behavioral fixes. Mutable detector injection succeeded on the screenshot gallery, but its sole cream-background result describes the gallery, not the app. No app DOM contrast, focus or accessibility conclusions were drawn from that overlay. The temporary detector server on port 8400 was stopped; the existing screenshot gallery on port 4300 remains available. Full evidence is in `captures/own-pace-2026-11-10/evidence-review.md` and adjacent JSON files.

Questions skipped: no implementation is being committed and existing product decisions resolve the review's scope. The recommended first change is deadline and terminal-state truth. Any later proposal to combine per-game reveals requires its own explicit product decision; this review does not authorize it.

## 2026-11-10 · Correct state truth before reorganizing screens
- Decided by: Codex recommendation, pending implementation discussion.
- Why: placing a stale permission or incorrect terminal state more prominently would amplify it. Existing engine rules can feed a consistent view of current actions without a new game engine.
- Rejected: beginning with typography, color changes, or a universal reveal that changes every game's progress.
- Rests on: [evaluation](evaluation.md), especially lock-window and completion findings.
