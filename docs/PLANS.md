# Plans

Every plan and working doc, with its status, and the order of the big work. Written 2026-11-19 after an audit of every plan
against the code and git. Each plan file now opens with a dated **Status** line that says the same as its row here.

The small and medium work is in [BACKLOG.md](BACKLOG.md); what's live and in flight is in [HANDOFF.md](HANDOFF.md).

---

## The order of the big work

1. **Dated work** (BACKLOG's "Dated"): before Survivor 51's Ep 10 (Wed 2026-11-25) and its finale (Wed 2026-12-16).
2. **The quick sessions** (BACKLOG's "Now"): stale checks, small engine fixes, a UI polish pass, the Designs-needed words batch
   and the production check-ups. Any session can take one.
3. **The two branches in flight:** game preview (BACKLOG 155) and the local game writer (156). Each waits on the user, then
   merges.
4. **Sports in good shape** ([PLAN-sports-ready.md](PLAN-sports-ready.md)), a lane of its own beside Start a game: first the
   data you can trust and the rules a season game needs (its Phases 0–2), then a whole recorded NFL season replayed as the gate
   (Phase 3), then the design round's step 10, Sports in full (Phase 4), then live points (Phase 5). Its words pass (4.0) can
   ship any time. The user's calls are BACKLOG 212–219 and 175.
5. **Start a game, E3**, in [PLAN-start-a-game-redo.md](PLAN-start-a-game-redo.md): C8 (the 2-on-1 head to head) first; then
   the pair and pick-many answers (BACKLOG 94), stages that take turns (160), the overall by places (84), the creative ask and
   instant answer choices in Describe, and cast properties' chunk 7. Then E5–E10.
6. **Design rounds from the explorer's Designs needed:** answers that settle (BACKLOG 139), waivers (140), then a game in
   stages (141, after `preview` merges).
7. **After the finale:** remove the classic app (step C, BACKLOG 45), then S3 (177) and R3 (178).
8. **A15, live calls on the episode's clock** (BACKLOG 179), then the watch-along round.
9. **The design round's steps 11 and 12:** the story-show flavor (once a story show can be added and played), then the tour,
   couches, account settings and Where you are's eight controls.
10. **The design sweep** (the explorer plan's §6B): every game's every screen, once `preview` has merged, the Designs-needed
    rounds have run and review packets exist.

The gameplay explorer's own steps run alongside, when a step above needs them (the explorer plan's "Next").

---

## Active

| Plan | Status | What's next |
|---|---|---|
| [PLAN-start-a-game-redo.md](PLAN-start-a-game-redo.md) | Active | Rounds 1–5, B1–B4, E1, E2 and E3's first slice live 2026-11-19. Next: C8, the rest of E3, then E5–E10. |
| [PLAN-game-preview.md](PLAN-game-preview.md) | Active, on branch `preview` | Round 5's review (BACKLOG 155), the rebase and merge, then P1 ("See it play" in Start a game), then A or B for the drill-ins. |
| [PLAN-local-game-writer.md](PLAN-local-game-writer.md) | Active, on branch `writer` | Merge, and the user picks the way on (BACKLOG 156). |
| [PLAN-sports-ready.md](PLAN-sports-ready.md) | Active (Phase 0 and Phase 1 but 1.1 done 2026-11-19, branch sports-phase0, not merged) | Step 1.1 toward live scores (BACKLOG 215 answered), then Phase 2 (the user's calls 213, 214, 219) and 4.1. The user's calls: BACKLOG 212–214, 216–219. |
| [PLAN-GAMEPLAY-SCENARIO-EXPLORER.md](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md) | Partly done | Its status table and "Next" list at the top; Designs needed (§6A); the design sweep (§6B). The working guide is [GAMEPLAY-EXPLORER.md](GAMEPLAY-EXPLORER.md). |
| The design round ([DESIGN-PROCESS.md](DESIGN-PROCESS.md), [DESIGN-ROUND-PACKET.md](DESIGN-ROUND-PACKET.md), [design-round/](design-round/)) | Steps 2–9 live | Steps 10 (Sports in full, now PLAN-sports-ready.md's Phase 4), 11 (story shows) and 12 (tour, couches, settings) not started. decisions.md is the record; an index of the folder is BACKLOG 153. |

## Partly done

| Plan | What's left |
|---|---|
| [PLAN-start-a-game-gpt.md](PLAN-start-a-game-gpt.md) | Its "Where this plan stands" table: A15 (179), R3 (178), S3 (177), C8 (next), C9 (172), L9's IR, FAAB, trades and other sports' slots. |
| [PLAN-new-design.md](PLAN-new-design.md) | Step C, removing the classic app (BACKLOG 45). Everything else is live. |
| [PLAN-rulebooks-implementation.md](PLAN-rulebooks-implementation.md) | Phase 9 (retiring show_formats, league_rulesets and season_rule_changes), with step C. |
| [PLAN-researched-survivor.md](PLAN-researched-survivor.md) | S3: Survivor 51 off the built-in reader (BACKLOG 177). |
| [PLAN-cast-properties.md](PLAN-cast-properties.md) | Chunk 7 (the redo plan's E3), and BACKLOG 132 and 138. |

## Parked

| Plan | Why |
|---|---|
| [PLAN-ai-access.md](PLAN-ai-access.md) | Tabled by the user (2026-11-16) until charging or ads are on the table, the bot is blocked or slow, or the couches pass a few dozen (BACKLOG 113). |

## Done (history, kept for the reasoning)

Each one's Status line says what was built and when.
- **Games and the engine:** [own pace](PLAN-own-pace-games.md), [maker scoring](PLAN-maker-scoring.md),
  [late joiners](PLAN-late-joiners.md), [classic live scoring](PLAN-classic-live-scoring.md) (still how Outlast scores),
  [league types](PLAN-league-types-and-wiki-connector.md), [waivers v2](PLAN-waivers-v2.md),
  [mid-season waivers](PLAN-midseason-waivers.md).
- **Shows and research:** [getting it ready](PLAN-getting-it-ready.md), [rulebook research](PLAN-rulebook-research.md),
  [bingo bank](PLAN-bingo-bank.md), [show formats](PLAN-show-formats.md), [cast import prompt](PLAN-cast-import-prompt.md),
  [universal season cast](PLAN-universal-season-cast.md).
- **Sports:** [sports data](PLAN-sports-data.md), [sports by team](PLAN-sports-add.md).
- **The app:** [desk parity](PLAN-desk-parity.md), [the first-time tour](PLAN-first-time-tour.md),
  [up next](PLAN-up-next.md), [GIF reactions](PLAN-gif-reactions.md), [playtests](PLAN-playtests.md),
  [dashboard, invites and reclaim](PLAN-dashboard-admin-reclaim-invites.md).

## Superseded (history)

Built, then replaced, or overtaken before being built. Each Status line names what replaced it.
- **By the new design (the 2026-10-22 site mock):** [couch and episode night](PLAN-couch-and-episode-night.md),
  [league tabs](PLAN-league-tabs.md), [UX redesign](PLAN-ux-redesign.md), [UX declutter](PLAN-ux-declutter.md),
  [settings order](PLAN-settings-order.md), [league explainer](PLAN-league-explainer.md),
  [new-user onboarding](PLAN-new-user-onboarding-flow.md), [linked league groups](PLAN-linked-league-groups.md),
  [linked late join](PLAN-linked-late-join.md), [spoiler-free catch-up](PLAN-spoiler-free-catch-up.md),
  [rollout order](PLAN-rollout-order.md).
- **By the first-time tour:** [guided tour](PLAN-guided-tour.md), [commissioner tour](PLAN-commissioner-tour.md),
  [practice round](PLAN-practice-round.md).
- **By rulebooks and our bot's research:** [admin shows rulebooks](PLAN-admin-shows-rulebooks.md) (built, the design
  reference), [scoring rules as data](PLAN-scoring-rules-as-data.md), [season rule changes](PLAN-season-rule-changes.md),
  [stage 3 format proposals](PLAN-stage-3-format-proposals.md), [AI-generated show formats](PLAN-ai-generated-show-formats.md),
  [format review gap filling](PLAN-format-review-gap-filling.md),
  [episode research compiled cache](PLAN-episode-research-compiled-cache.md).
- **By the GPT plan's track L:** [sports live](PLAN-sports-live.md).

---

## Working references

Current, and worth reading for their area:
- **Product and design:** `README.md` (architecture and history), `PRODUCT.md`, `DESIGN.md`,
  [ARCHETYPES.md](ARCHETYPES.md), [APP-REVIEW-DESIGN-BRIEF.md](APP-REVIEW-DESIGN-BRIEF.md),
  [DESIGN-PROCESS.md](DESIGN-PROCESS.md), [DESIGN-ROUND-PACKET.md](DESIGN-ROUND-PACKET.md).
- **Hosting:** [HOSTING.md](HOSTING.md) (behind for 2026-11-16 to 11-19: BACKLOG 154).
- **Games and the engine:** [ENGINE-CAPABILITIES.md](ENGINE-CAPABILITIES.md) (generated), [GAME-PIECES.md](GAME-PIECES.md),
  [CORE-GAME-CATALOG.md](CORE-GAME-CATALOG.md) (stale until regenerated: BACKLOG 151).
- **Tools:** [UI-ATLAS.md](UI-ATLAS.md), [GAMEPLAY-EXPLORER.md](GAMEPLAY-EXPLORER.md),
  [GAMEPLAY-COVERAGE.md](GAMEPLAY-COVERAGE.md), [GAME-PAGE-SITUATIONS.md](GAME-PAGE-SITUATIONS.md),
  [PARALLEL-SESSIONS.md](PARALLEL-SESSIONS.md), [VISUAL-ASSETS.md](VISUAL-ASSETS.md), [NANO-BANANA.md](NANO-BANANA.md).
- **Research:** [PLAN-bot-research.md](PLAN-bot-research.md) (how the bot's research works),
  [PLAYTEST-REPORT.md](PLAYTEST-REPORT.md), [RESEARCH-show-art-and-cast-photos.md](RESEARCH-show-art-and-cast-photos.md),
  [RESEARCH-traitors-events.md](RESEARCH-traitors-events.md),
  [RESEARCH-traitors-scoring-values.md](RESEARCH-traitors-scoring-values.md),
  [RESEARCH-scoring-values.md](RESEARCH-scoring-values.md), [STUDY-added-moments.md](STUDY-added-moments.md),
  [STUDY-format-changes.md](STUDY-format-changes.md).

## History (superseded references)

[GAMEPLAY-BENCH.md](GAMEPLAY-BENCH.md) (the v1 pilot, kept for sports recipes),
[OWN-PACE-UI-INVENTORY.md](OWN-PACE-UI-INVENTORY.md), [ADDING-A-SHOW-FORMAT.md](ADDING-A-SHOW-FORMAT.md),
[PROMPT-stat-research.md](PROMPT-stat-research.md), [LAYOUT-MAP.md](LAYOUT-MAP.md),
[RESEARCH-extractable-stats.md](RESEARCH-extractable-stats.md), [custom-gpt.md](custom-gpt.md), and the review folders
[show-soul-review/](show-soul-review/), [own-pace-review/](own-pace-review/), [show-overview-review/](show-overview-review/)
and [cast-props/](cast-props/), which the design round and the own-pace work absorbed.

[archive/](archive/) holds the trackers this cleanup replaced, word for word: the old backlog (with a table of what happened
to each closed number), the old handoff's build log, the roadmap of 2026-10, UX-IDEAS, and the explorer's resume prompt.

---

## Keeping this page true

- **A new plan:** `docs/PLAN-<name>.md` with a dated Status line at its top, and a row here.
- **A plan finishes:** change its Status line to Done with the commit, move its row to Done, and carry any live leftovers to
  BACKLOG.md with new numbers.
- **The order changes:** edit "The order of the big work" above, and the "Next" list in HANDOFF.md.
