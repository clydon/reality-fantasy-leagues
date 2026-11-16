# Chat: the look and the check (step 9, a light review)

**The look (Impeccable).** Operate mode, Lower Third, no new parts. An episode's landmark is the app's episode chip in the stream (the
caption tag, cut corner, secondary fill) with "aired Thu, Nov 12 · 8:00 PM" (just the time when it follows that day's talk) and a
rule; a day divider is plain muted text between rules, a step quieter than the chip; one reveal line per episode carries its day
("Fri, Nov 13 · riley and jordan revealed Ep 5"); the composer's hint is "Message the couch"; your own reaction is outlined in the
foreground, not yellow.

**The check**, once each: [PFD evaluate](step9-chat-pfd-eval.md) 76/100 (L0 72, L1 80, L2 76, L3 70, L4 82); [Impeccable
critique](step9-chat-critique.md) 27/40 (a reviewer that saw neither PFD's findings nor the session's reasoning; the detector: 8
advisory font sizes, nothing else). Frames: `.ui-atlas/stories/step9-chat/{before,after}/` (census-app.js `--only=chat`, its chat
cases now landing at the newest message as the app opens).

## Fixed in the batch

| Finding | From | Fix |
| --- | --- | --- |
| Landmarks with no talk under them (Riley's Ep 2 and Ep 3 stacked; Sam's Ep 5 under a fold) | both | A landmark only where a message or the fold follows it; a run of empty airings collapses into the last |
| A reveal line opening a day of its own ("FRI, NOV 13 / revealed Ep 5 / TODAY") | both | Reveal lines don't start a day; they carry it |
| The fold's Reveal and Show them look the same, so spoiling yourself is as easy as the safe way | critique P1 | Reveal Ep N first, full width; "Show them anyway (may spoil Ep N)" as a quiet link |
| The fold says "Episode 4" beside the landmark's "Ep 4"; the fold's episode also gets a reveal line | PFD | The app's "Ep" form in the fold; no reveal line for the fold's own episode |
| Two date forms on landmarks, repeating the day divider | both | The day divider's form, and just the time when the landmark follows that day's talk |
| Day dividers as loud as the chips | critique P2 | Plain muted text |
| (the confirming look) the fold's Reveal reading grey | this batch | Foreground |

## Open

- Every avatar reads "Z" on the fixture: the face takes its initial from the account's name (zt_nd_…), the bubble shows the chat's
  author name; on real accounts they match. Font sizes off DESIGN.md's ramp (14 px), as step 8 found: the ramp looks out of date.
- A watcher's fold has no "I watched Ep 3" in place (the progress control at the top has it).

## Sports (the short check)

From the code: a landmark is the season's own word and time (`show.words.ep`: "Wk 12 · aired Sun 1:00 PM") from the same episodes
read, so a sport's weeks or games mark its chat with no new code; a slate week is one landmark. Not rendered (no sports chat
fixture).
