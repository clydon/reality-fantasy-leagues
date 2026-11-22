# A league's page, Chat (sports-couch B1, session 5): the shape brief (Impeccable, step 3)

On [the spec](league-chat-spec.md) and [the first-view requirements](league-chat-first-view.md). Mode: **Operate**. The committed
world: Lower Third (DESIGN.md). Almost nothing new is drawn: the message, reactions, sheet, GIF sheet and composer are the show
Chat's (show/chat.tsx, exported for this), the fold its dashed line.

- **Job:** the couch's talk about the league, a game's talk kept with the game.
- **The threads row** (only with a thread to choose): a 44 px row of chips under the bar, sticky under it (`--league-bar`), the
  chosen chip in ink on the raised panel (Standings' Night switch), the rest outlined muted. "All", then up to three games:
  "Eagles at Jets" over nothing else; live as the red dot before the name (never for a hidden game); "+N" opens a short sheet of the
  rest. Text 14 px semibold; the row scrolls only if three long names don't fit (never essential: All is first).
- **The stream:** the show Chat's (days, runs, bubbles, reactions). A run in a game's thread: its name line reads "Riley · Eagles at
  Jets · 2:14 PM", the game part a button (44 px tall hit area through padding) that selects the thread. Your own runs carry the tag
  above the bubble, right-aligned, 11 px muted.
- **The fold** (per game): the show's dashed panel: "4 messages in Eagles at Jets since it started" / "From Riley and Sam." /
  an outlined **Show the score** (44 px, full width). Never a score or state in its words.
- **The composer:** the show's. Above it, while it applies, an About chip (32 px tall in a 44 px row): "About Eagles at Jets" with
  × (its own 44 px target), muted outline; ×'d, a quiet "+ About Eagles at Jets" brings it back. In a thread, no chip: the
  placeholder says "Message about Eagles at Jets".
- **Empty:** the show's ("No messages yet", "Say something to the couch about the NFL."). **Solo:** "Chat is the couch's. Start a
  couch · Join one" (the Games tab's line). **Loading/failed:** the show's skeleton and EmptyState.
- **Anti-goals:** no yellow; no score, state or winner in a fold, a chip or a push for anyone hiding scores; no second form of a
  message; nothing sideways that's essential.
