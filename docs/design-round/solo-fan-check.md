# Solo (sports-couch C4): the check and its one batch (step 4)

2026-11-23. On the built pages at 390 (the stand-in ESPN, `scripts/dev-test/story-solo-fan.js`: 31 checks), one look through
PFD's lenses (the first view, the load, the eye's order, R1 to R5 of [the first-view requirements](solo-fan-first-view.md)) and
Impeccable's critique (hierarchy, words, states, the one yellow, Night and Studio), then one batch of fixes and one confirming run.
Said plainly: the check was one combined look by the session against those rules, not separate `/perception-first-design:evaluate`
and `/impeccable critique` runs.

## Findings, and the batch

| # | Lens | Finding | Fix |
| --- | --- | --- | --- |
| 1 | PFD R4 / the gap | The weekly move said the engine's "Fill in your sheet · 1 question · Lions calls": the one prompt a solo fan gets said nothing about his team (PFD's predicted gap). | answers.ts `questionMoves`: your calls' move says "Call the Lions game" (from its name, "<team> calls"). ESPN's stored game names are full ("Chicago Bears at Detroit Lions"), too long for the strip. |
| 2 | Impeccable, words | The solo fan band said "Your team" on a team he follows that isn't his team (his NFL team was the Eagles). | "Your calls on the Lions", its record labelled "This season". |
| 3 | PFD R1 / L2 | The season row's none state ("The season · 8–2–1 now · 6 left") sat right above the season chart's own "The season · 8–2–1": the same label and figure twice. | The row asks the question: "Where do they finish?" · "6 games left · one call a season". |
| 4 | Spoilers | Hiding sports scores, the season row still said "Called at 8–2–1" and the called record ("13–3–1"), both results. | Hidden: "5 of 6" (wins called over the games left) and "how it's going is hidden"; no record anywhere (checked). |
| 5 | Impeccable, rhythm | A loose 44 px gap under "You called Lions" before "Yours alone until kickoff · Change". | The solo called row sits right under the call. |
| 6 | Data | A call on a game between two of his teams (Lions at Eagles) counted in both teams' records on This week. | A solo call carries the team whose calls it's in (`CallGame.own`); a row counts only its team's. |
| 7 | States | The wizard opened on the draft for a solo fan but refused ("Games are played on a couch"), and the stand-in Lions had no roster. | The wizard runs with no couch on a sport's season (a show still says a couch first); the story's stand-in gives the Lions a made-up roster. |
| 8 | Words | This week's table said "Your call, above" once called. | Solo, once called: "You called Lions, above". |
| 9 | UI-REVIEW-MAP | The season call's own game page lets him change the answer until the next kickoff (the engine's lock for a question asked once), while the sheet said the call was final once made. | The words follow the engine: "One call a season. It's pinned once their next game starts." (the spec's listed other way; the pin still holds today's record, as no game is played before it). |

## Kept, with why

- **"Your call" with no face** (C2's row draws the fan's face): it's only ever you.
- **The season row's outlined button, never yellow**: the week's call is the page's yellow; a once-a-season call isn't a duty.
- **The stepper's figure doesn't animate**: a number that rolls reads as a slot machine (the shape's).
- **Two "Your call" rows on This week** (the Eagles and the Lions): a row each team (the spec's situation 13); the first uncalled one
  carries the yellow.
- **The draft is the gallery's Game-night draft over the rest of the season**: "everyone drafts three players from the Lions, and every
  one of them scores"; it's the draft a team's season offers today, with three computer players set (Ada, Max, Ivy).

Reviewed per UI-REVIEW-MAP (a new dial value): the season call's and the calls' own game pages (frames `season-game`, `calls-game`) and How
it plays ("How many of the rest do they win? 1 point if you're exactly right."). They read as any game of questions; the generic words
("Everyone answers one question", a table of one) are kept for now: BACKLOG 258 (g).

## The confirming run

All 29 checks pass (`story-solo-fan.js`), no words over words. C2's `story-lone-fan.js` re-run (it shares the call row and fan card).
`npm test` 2,630 pass (the engine's new settle: tests/sports-season-call.test.js; the pure part: tests/sports-own-calls.test.js); tsc
clean; ESLint clean on the changed files.

## Open (listed, not chased)

- **The made-up history in the story** is its own archived calls game (Weeks 1-11): the stand-in world keeps no stored finals, so one
  game over the whole season can't move past Week 1 there. In the app a fan's calls are one game, moving on as each final is read. The
  Games frame shows it as "Lions calls, made up".
- **The season call settled** is shown from the schedule's finals (the row's own reading); the engine's grading of it is the unit
  test's, since the stand-in world doesn't stamp finals into a game.
