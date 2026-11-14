# Watching at your own pace

## Anti-pattern verdict

Inconsistent mental models need correction. The priority issues concern episode context, action permissions and completion. No deceptive or manipulative pattern was established in the inspected flows.

## Priority issues

### Major — Make lock instructions agree with the action window

The completed-season lineup editor says **“Saving doesn’t lock anything. Airtime does.”** After saving, the same flow says **“change it until you reveal.”** Someone playing an episode that aired months ago cannot use both instructions. The live accommodation also needs its next-airtime limit wherever it promises late editing. [Editor screenshot](../../captures/own-pace-2026-11-10/solo-and-sync/09-lineup-editor.png), [saved lineup](../../captures/own-pace-2026-11-10/solo-and-sync/10-lineup-saved.png), [late-player screen](../../captures/own-pace-2026-11-10/live/02-jordan-tonight-late.png).

**Change:** Have the editor, saved card, game page and player sheet describe the same existing server window:

| Situation | Instruction |
| --- | --- |
| Ordinary live play | “Change until [airtime].” |
| A whole game at your own pace | “Change until you reveal Episode 4.” |
| A late seat in a live game | “Change until you mark Episode 6 watched or Episode 7 airs, whichever comes first.” Include the next airing's date and time when available. |
| The window has closed | State the episode, the reason it closed and whether the saved move or carried lineup applies. Present the next available action. |

Use the existing eligibility rules to derive this explanation; wording must not create another deadline calculation in the client. Retain the established cap at the next airtime. A failed save keeps the selection and shows the reason beside the save control.

**Why:** Consistency and standards; visibility of system status; error prevention. A reassuring sentence is harmful when it promises an action the server will refuse.

**Verify:** Save and reopen a lineup on a finished season; a live game before airtime; a late-enabled seat before watching; the same seat after watching; and the previous episode after the next episode airs. The displayed permission and an attempted save agree in each case.

**Implementation:** [dock.tsx](../../src/new/show/dock.tsx), [moves.ts](../../src/new/show/moves.ts), [your-move.ts](../../src/new/show/your-move.ts), [lineup-sheet.tsx](../../src/new/show/lineup-sheet.tsx), [own-pace-seats.ts](../../src/lib/server/own-pace-seats.ts).

### Major — Make the viewer's episode the primary action context

The late player's page leads with **Episode 7**, then asks for an **Episode 6** lineup and offers Episode 6 results. Another screen says **“You’re set for Episode 7”** while the viewer still needs Episode 4. A still-airing season can also show one game's “pick before Episode 4” and another game's “reveal Episode 4 first” without strong enough game labels to explain the difference. [Late player](../../captures/own-pace-2026-11-10/live/02-jordan-tonight-late.png), [several episodes behind](../../captures/own-pace-2026-11-10/live-boundaries/03-multiple-behind.png), [mixed games](../../captures/own-pace-2026-11-10/solo-and-sync/11-airing-season-own-pace.full.png).

**Change:** Lead with **“Your Episode 6”**, the game name and the next available move. Put **“Next on TV: Episode 7 · [time]”** in secondary schedule context. Scope completion messages: **“Episode 7 moves are set”** does not imply the earlier episodes are done.

Keep the accepted plate per own-pace game. Where games target different episodes or have different lock rules, show the game name and episode on every move and reveal action. Keep one visually dominant next action; other games and scheduled actions remain accessible. Preserve per-game reveal behavior rather than merging reveals as a layout shortcut.

Use **“Seen through Episode 3”** for completed viewing and **“Episode 4 next”** for the upcoming personal episode. Friends' labels should make the same distinction. A total such as **“of 13”** comes from the selected game's known range or season metadata, not the highest episode currently present in its state. If the total is unknown, omit the denominator.

**Why:** Match with the real world; recognition rather than recall; aesthetic and minimalist design. People should not have to reconcile three episode clocks before tapping.

**Verify:** A viewer can identify the episode and game affected by every primary button without opening a sheet. Cover one game, several games at the same episode, and several games at different episodes. A future broadcast never displaces an available personal move.

**Implementation:** [tonight.tsx](../../src/new/show/tonight.tsx), [pace-plate.tsx](../../src/new/show/pace-plate.tsx), [up-next.tsx](../../src/new/show/up-next.tsx), [season-games.ts](../../src/lib/server/season-games.ts).

### Major — Distinguish caught up, personally finished and final standings

The own-pace plate renderer falls through to its finish component when no catch-up step, draft, team selection or waiver checkpoint exists. The absence of a catch-up step does not by itself establish that a still-airing game's selected end has been reached. Its finish component says **“You finished it”** and refers to **“final standings.”** An in-memory run of the actual engine and game-view code reaches this branch after Episode 3, with Episode 4 still ahead, `over=false` and an Episode 4 pick available. [Plate selection and finish component](../../src/new/show/pace-plate.tsx), [game-view state](../../src/lib/game/game-view.ts), [reproduction output](../../captures/own-pace-2026-11-10/caught-up-proof.json).

The completed-season finish capture also presents **“3rd of 4”** while another human is still playing Episode 4. That person's later moves can still affect the ordering. [Finish screenshot](../../captures/own-pace-2026-11-10/finished-season/09-finish-plate.png).

**Change:** Render the following states explicitly:

| State | Main message | Next action |
| --- | --- | --- |
| Latest available results reached; the game continues | “You’re caught up through Episode 5.” | Show the next airing or the next available move. |
| The next episode aired but its results are missing | “Episode 6 results aren’t ready yet.” | Keep a truthful saved/locked move summary; offer the existing results-recovery route to someone who has permission. |
| This person's selected game has ended; others still play | “You finished your game.” | Personal result plus “Currently 3rd · Riley is still playing.” Standings remain spoiler-safe for Riley. |
| All active participants have reached the selected end and scoring is settled | “Final standings.” | Final result and episode history. |

A one-episode or custom game may legitimately finish before its season ends. Use that game's selected end, not just the season's status. Do not invent a final episode from the current results horizon. Keep **“Done for now”** and avoid automatically starting another game or episode.

**Why:** Visibility of system status; match with the real world. “Caught up” promises more later; “finished” promises completion. Those have different next actions.

**Verify:** Follow an own-pace game from behind to the latest results on a still-airing season; then add the next episode. Separately finish a one-episode game, finish a whole-season game while a friend remains behind, and finish it with everybody. The terminal message and rank's finality agree with the selected end and outstanding play.

**Implementation:** [pace-plate.tsx](../../src/new/show/pace-plate.tsx), [game-view.ts](../../src/lib/game/game-view.ts), [season-games.ts](../../src/lib/server/season-games.ts).

### Major — Explain pace and checkpoints before starting

The completed-season wizard presents duration, a game rail, three editable rule steps and variations. The start summary says **“everyone picks 1, before Episode 5”** without explaining independent viewing or the selected game's synchronization points. **“Start from”** names the game-template rail, although here it also sounds like an episode-origin control. [Wizard screenshot](../../captures/own-pace-2026-11-10/finished-season/02-start-sheet.png).

**Change:** Keep the full wizard and every supported game type. Make these three decisions visibly distinct:

| Decision | Labels |
| --- | --- |
| Where the game starts | “Episode 5 · where you are” / “Episode 1 · from the top.” Keep custom episode selection. |
| How long it runs | This episode / Rest of season / Custom. |
| What the game is | “Choose a game,” followed by the existing game choices and editable card. |

Put a short pace sentence on the selected game card and in its final start summary. Examples: **“Play one episode at a time, whenever you watch.”** Or **“Play at your own pace. Draft together; regroup for replacements.”** Describe additional settlement checkpoints only when the selected rules require them. These sentences describe what the game does, not implementation machinery.

**Why:** Recognition rather than recall; help and documentation; consistency and standards. The group needs to know the commitment before creating the game.

**Verify:** Start from the viewer's position and from Episode 1 on both an old season and one still airing. Check solo, shared ownership and exclusive ownership. Keep the same wizard capabilities; do not substitute a restricted own-pace game list.

**Implementation:** [start-wizard.tsx](../../src/new/couch/start-wizard.tsx), [start-spec.ts](../../src/lib/server/start-spec.ts), [existing own-pace decisions](../PLAN-own-pace-games.md).

### Minor — Give solo play a personal result

With one human and no bots, the game page still shows a one-row **“The season”** table and then **“1st of 1.”** Tonight also leads its game summary with a rank. [Solo game page](../../captures/own-pace-2026-11-10/solo-and-sync/02-solo-game.png), [solo Tonight](../../captures/own-pace-2026-11-10/solo-and-sync/01-solo-tonight.png).

**Change:** Lead with that game's own measure: current and best streak, points, lines or completed episodes. Before the first result, show the next move with a brief empty-state sentence. Omit the opponent grid and rank while this game has only one participant. Show them automatically when another participant joins; a game with a computer opponent is competitive play. Watching friends on the couch does not make this single-player game multiplayer.

**Why:** Aesthetic and minimalist design; match with the real world. The player has started a personal game, not an empty competition.

**Verify:** Capture the same game before its first result, after a result, after someone joins, and after adding a computer opponent. The game continues without recreating it.

**Implementation:** [game-page.tsx](../../src/new/show/game-page.tsx), [game-page model](../../src/lib/game/game-page/model.ts), [existing solo direction](../PLAN-own-pace-games.md).

### Minor — Start with human progress language

Before the first episode, the watch-only plate says **“You’re up to Episode 0 of 8.”** The same screen's spoiler chip already says **“not started yet.”** [Not-started screen](../../captures/own-pace-2026-11-10/watching/01-not-started.png).

**Change:** Under **“Episode 1”**, use **“You haven’t started this season yet.”** After the first reveal, use **“Seen through Episode 1.”** Remove duplicate episode headings when the action plate already owns that context. Do not show an empty Extras heading. After the viewer has finished the whole season, change the invitation from “pick before you watch” to an explicit rewatch option. [Finished watching](../../captures/own-pace-2026-11-10/watching/08-finished.png).

**Why:** Match with the real world; consistency and standards. Episode zero is a storage value rather than the viewer's progress.

**Verify:** Not started, one episode seen, an intermediate episode, all available episodes seen, and the selected game finished.

**Implementation:** [up-next.tsx](../../src/new/show/up-next.tsx), [tonight.tsx](../../src/new/show/tonight.tsx).

## Flow walkthrough

| Flow | State to correct | Finding |
| --- | --- | --- |
| Follow an old season without a game | Before Episode 1 | Start with human progress language. |
| Start a game on an old or still-airing season | Origin, duration, game choice, final summary | Explain pace and checkpoints before starting. |
| Play alone | First move and personal history | Give solo play a personal result. |
| Set a pick or lineup before watching | Edit, save, reopen, deadline | Make lock instructions agree with the action window. |
| Play with friends at different episodes | Tonight, game detail and progress sheet | Make the viewer's episode the primary action context. |
| Reveal after watching | Episode outcome and exit | Preserve the results sheet and “Done for now.” Keep the affected game explicit. |
| Draft together | Waiting and active draft | Preserve the shared start and cast as it stood before the starting episode. |
| Reach a replacement checkpoint | Friend behind, acknowledgement, all present | Preserve the explanation, named waiting players and freedom to continue. |
| Play late in a live game | Personal move, opponent waiting, saved-late marker | Make lock instructions agree with the action window. |
| Reach the current results horizon or the game's end | Caught up, waiting for data, personally done, everyone done | Distinguish caught up, personally finished and final standings. |

## Positive findings

- **Pick → Watch → Reveal** gives a recurring action a clear shape. The saved pick and Change action remain visible before reveal.
- The results sheet connects the episode to its personal consequence, then offers both a next move and **“Done for now.”**
- Ahead-of-friend warnings and waiver explanations preserve independent progress. A friend's absence does not become a new hard lock.
- Watched confirmation explains what will appear. Future chat stays folded; waiting matchups have an explicit pending explanation.
- The television graphics, condensed headings and caption plates suit the product. The fixes can preserve the current brand and components.

## Heuristic verdicts

| Heuristic | Verdict | Deciding finding |
| --- | --- | --- |
| Visibility of system status | Broken | Distinguish caught up, personally finished and final standings. |
| Match with the real world | Broken | Make the viewer's episode the primary action context. |
| User control and freedom | Holds | Optional continuation, sheet exits and the results sheet's stopping point. |
| Consistency and standards | Broken | Make lock instructions agree with the action window. |
| Error prevention | Broken | Make lock instructions agree with the action window. |
| Recognition rather than recall | Broken | Explain pace and checkpoints before starting. |
| Flexibility and efficiency | Holds | Independent progress, late play and the full game wizard. |
| Aesthetic and minimalist design | Strained | Give solo play a personal result. |
| Error recovery | Strained | Keep lock instructions and save errors beside the action. |
| Help and documentation | Broken | Explain pace and checkpoints before starting. |

## Recommended actions

- Make lock instructions agree with the action window.
- Distinguish caught up, personally finished and final standings.
- Make the viewer's episode the primary action context.
- Explain pace and checkpoints before starting.
- Give solo play a personal result.
- Start with human progress language.
