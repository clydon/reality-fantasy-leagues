# Chat (step 9): Perception-First Design evaluation

Built frames at 390 px: `.ui-atlas/stories/step9-chat/after/` (chat-alex, chat-sam, watchonly-riley-chat), against `before/`.
Against [the spec](step9-chat-spec.md) and [the first-view requirements](step9-chat-first-view.md). A light review, run once,
read-only; the corpus' HTML rebuild step was skipped as out of proportion for a light round.

## Score: 76 / 100

| Layer | Score | Why |
| --- | --- | --- |
| Foundation (L0) | 72 | Reveal lines halved, hint on one line; but a day divider plus a reveal line still frame single messages: alex's first view is 7 chrome rows to 5 messages |
| L1 first impression | 80 | Opens at the newest with the composer under it; the white own-message bubble is the brightest thing on a dark screen |
| L2 fluency | 76 | "EP 5" chip reads apart from the centred day rule; yellow gone from the reaction (now a white outline); but the fold still says "Episode 4" and the airing date takes two forms |
| L3 prediction | 70 | Every message has a landmark above it; a behind viewer meets an empty Ep 5 landmark whose talk is counted in Ep 4's fold |
| L4 decisions | 82 | Reveal and Show them where the fold is met; GIF, box, Send kept; the watch-only fold has no in-place "I watched" |

## Requirements

| | Met? | Evidence |
| --- | --- | --- |
| R1 one reveal line per episode; landmark + day merge | **Met** | "riley and jordan revealed Ep 4" once; riley's Ep 3 landmark replaces the TUE, NOV 10 divider |
| R2 newest first, composer below, hint on one line | **Met** | "Message the couch", one line in all three |
| R3 "Ep 5" form, unlike a day divider; no yellow off the move | **Partly** | Landmarks and reveal lines say "Ep"; the fold's title and button still say "Episode 4"; yellow removed |
| R4 a landmark above every message; a fold under its own episode | **Partly** | Ep 4's fold sits under Ep 4; sam's Ep 5 landmark stands empty, its three messages counted in Ep 4's fold |
| R5 fold actions and composer controls kept | **Met** | Unchanged from before |

## Findings (by severity)

1. **Major, L3: an empty landmark for a behind viewer (chat-sam).** "EP 5 aired Thu 8:00 PM" is followed directly by FRI, NOV 13,
   so it reads as "nobody talked about Ep 5", while the Ep 4 fold's "5 messages" quietly includes Ep 5's talk and today's.
   A landmark that predicts the wrong content breaks the scroll model the round added it to fix (Clark 2013).
   **Fix:** count the fold per episode: Ep 4's fold holds Ep 4's talk ("2 messages"), and under the Ep 5 landmark a one-line fold
   "3 messages · reveal Ep 4 first" with no buttons (only the earliest unseen episode carries Reveal).
2. **Major, L0: the reveal line sits on its own day, not under its landmark (chat-alex, chat-sam).** "FRI, NOV 13 / riley and
   jordan revealed Ep 5 / TODAY" is three chrome rows around nothing; the spec put the grouped line under the landmark.
   **Fix:** carry the reveal on the landmark's row or directly under it ("EP 5 aired Thu 8:00 PM", then "riley and jordan
   revealed it"), and drop a day divider whose day holds only a reveal line. Alex's view gains two message rows (Cowan 2010).
3. **Minor, L2: "Episode 4" survives in the fold (chat-sam, watchonly-riley-chat).** Under "EP 4 aired Nov 5", the fold repeats
   "5 messages since Episode 4 aired" and "Reveal Episode 4": the same fact twice, in the other form (Reber & Schwarz 1999).
   **Fix:** under its landmark the fold says "5 messages · riley and jordan have seen it", buttons "Reveal Ep 4" and "Show them".
4. **Minor, L0: the reveal said twice in four rows (chat-sam).** The fold's "riley and jordan have revealed it" and, right below,
   "riley and jordan revealed Ep 4". **Fix:** when a fold sits under the landmark, the separate reveal line for that episode is
   not drawn; the fold carries it.
5. **Minor, L2: two date forms on landmarks, and the day repeated (chat-alex).** "aired Nov 5" vs "aired Thu 8:00 PM", each
   under a day divider that already names the day. **Fix:** under a day divider the landmark gives the time ("aired 8:00 PM");
   only a landmark that carries the day gives day and time ("aired Tue, Nov 10 · 9:00 PM").
6. **Minor, L4: the watch-only fold offers no way past it (watchonly-riley-chat).** "They unfold when you've seen it" with only
   Show them; "I watched Ep 3" is up in the progress strip, which scrolls away. **Fix:** "I watched Ep 3" beside Show them,
   matching the competition fold's two actions where the question is met (Hertwig & Erev 2009).

Noted, not ranked: the own-message bubble is near-white, the strongest luminance on the screen, outranking the fold's Reveal
when both are in view (pre-attentive salience); a slightly lifted dark tint would keep "mine" without leading the eye.
Not new this round; Impeccable's call.

*Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*
