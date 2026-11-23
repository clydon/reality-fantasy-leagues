# Rivalries (sports-couch C1): the shape brief (Impeccable, step 3)

On [the spec](rivalry-spec.md) and [the first-view requirements](rivalry-first-view.md). Mode: **Operate**. The committed world:
Lower Third on Night and Studio. The card is B1's `RivalryCard` restructured in place (src/new/screens/league-page.tsx), its parts
moved to `src/new/sports/rivalry.tsx` (`RivalryCard`, `CallSheet`, `useRivalries`) so a team's page or the game sheet can draw them
later. The sheet is the app's `Sheet`; the call's winner tiles are B4's `TypeTile` look; the send is the sheet's yellow plate
(`PlayPlate`'s form); a picked side is A3's quiet fill with a check. Nothing new in the palette.

- **The thesis: the friendship is the score.** Before kickoff the card's right edge, where a scoreboard puts the score, holds each
  fan's call ("Called", or yours in full); once it's on, the call in the number type and the live score beside the team's name; once
  it's over, the result line in names over the record. The focal moment is the result: "Andrew called it" in the caption type, the
  one line on the card drawn in Archivo's condensed display, so the story reads before the numbers.
- **The sides:** one line, away's faces stacked left, home's right, a hairline between them whose split is the share (ink on the
  leading side, the line colour on the other; the bar is 3 px, a reading aid, never a team colour). The count in words under the
  faces at 13 px ("3 with Andrew", "1 with Riley"). No line until a side is picked. A big couch: four faces, then "+N".
- **The action**, one row by who you are: a fan's **Make your call** (the yellow plate, 48 px, the line under it "Riley gets one
  notification" at 13 px muted; outlined when the move strip above is yellow); challenged, "Andrew called Giants. Your call?" at 14 px
  semibold over it; called, "Change your call" as a 44 px text button and your margin under your side in muted ("Giants by 6 · only
  you see the margin"). A spectator's **Pick a side**: a 13 px label "Pick a side · everyone sees it", then two 48 px outlined
  buttons side by side, each the team's xs mark and short name; picked, the quiet fill with a check and "With Andrew" for its name
  (tap again to clear), the other button stays outlined; under the pair, "Add a margin" as a 13 px text link (the sheet).
- **Other games on it:** a 13 px bold underlined text link at the card's foot, into B4's sheet.
- **Your call sheet:** title "Your call", the matchup and when at 14 px muted; "Who wins" two tiles (the team's xs mark, the short
  name; yours chosen: the white plate with a check, the app's chosen look); "By how many" one number in the number-hero type (44 px)
  between − and + 48 px square buttons (1 to 50; the sport's typical start); the other fan's call when made ("Riley called Eagles ·
  margin hidden until kickoff"); the yellow "Make your call" / "Save your call" with its line; challenged, "Not this time" as a 44 px
  plain text button.
- **Over:** the result line (caption-md, 19 px) under the head; each side's call with "right" (safe teal text) or "off by 4" muted,
  the losing side muted (B1's); each face in the sides line with a 12 px teal check when its side won; the record at the foot, 13 px
  ("Andrew leads Riley 2–0 this season · 3–1 since 2026").
- **States:** loading (the card's sides only, no sides line or action, a 48 px skeleton bar where the action goes); the rivalry read
  failed ("Couldn't load sides · Try again" as the action row); saving (the tapped button's label stays, a spinner replaces its check
  for under a second; optimistic); a save failed ("Didn't save · Try again" under the pair); postponed (the status says Postponed, no
  action); hidden (calls and sides, no score, result or checks; the page's Show records).
- **Motion:** one moment: a picked side's button fills from the tap (the follow toggle's 150 ms), and its face slides into the
  sides line (opacity and 6 px, 200 ms, ease-out; nothing under reduced motion).
- **Anti-goals:** no VS graphic or slab; no team-colour bar; two yellows never; no margin before kickoff but your own (to you); no
  score, result, check or record for anyone hiding; no shaming refusal copy; no countdown.
