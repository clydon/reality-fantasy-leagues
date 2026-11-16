# Chat: page spec (step 9, a light review, competition shows first)

Before frames: `.ui-atlas/stories/step9-chat/before/` (census-app.js `--only=chat`; the chat cases now land at the newest message,
as the app opens, since the census otherwise resets every page to its top).

## The job

**Chat** is the couch's one conversation about this show: talk about the episode you're on, react, send a GIF, and catch up on
what you missed without being spoiled. Phase 0 found it passing all five tests; this round is light: the structure is right, two
things about it aren't.

People: Joanna opens Chat after the episode to see if anyone said anything, reads the last few, reacts, leaves. Andrew taps a push,
reads one message, replies. Conor scrolls back through last week's episode talk.

Ways in: the tab bar; a chat push; the bell doesn't carry chat (its own count on the tab).

## The stream's structure: by day, with each episode as a landmark

Today the stream has one kind of divider (the day: "WED, NOV 11") and the episode only shows up indirectly ("riley revealed Episode
4", twice per episode, once per person). But a couch talks about episodes, not days: "that vote was cold" is about Ep 5, and the
question someone brings to a scrolled chat is "which episode is this about?" (Phase 0's first view for Chat: "which episode's
talk").

**Decision:** keep days (a conversation is in time), and add **the episode's airing as a landmark** in the stream at its air time:
"Ep 5 aired · Wed 8 PM". The airing is public (the TV guide says it), so it spoils nothing. Under it, that episode's reveal lines
fold into one ("riley and jordan revealed it"), and the spoiler fold for it already sits there. Wayfinding: scrolled anywhere, the
nearest landmark above says which episode the talk is about, so the progress control scrolling away is fine.

## Top to bottom (opens at the newest message)

| # | Block | Holds |
| --- | --- | --- |
| 1 | The show bar and the compact progress control (as every tab, step 4) | scrolls away with the stream: the landmarks carry where you are |
| 2 | The stream, oldest above | day dividers; an **episode landmark** at each airing; messages in runs (one name per run); reactions; one reveal line per episode ("riley and jordan revealed it"); the fold for an episode you haven't seen ("5 messages since Episode 4 aired · Reveal Episode 4 · Show them") |
| 3 | The composer | GIF, the box ("Message the couch", one line), Send |

Removed: one reveal line per person per episode (said once per episode, the names together); the placeholder's show name ("Message
the ZT Survivor 51 couch" wraps to two lines; the show is in the bar).

## The drill tree

| Level | Questions | Holds today | Verdict |
| --- | --- | --- | --- |
| The stream | What's been said; about which episode | Days, messages, reveal lines, the fold | **Restructure lightly**: episode landmarks; reveal lines grouped |
| A message | Who; react | Name, time, words, reactions; a long press for the picker | **Keep** (your own reaction not in the move's yellow: Impeccable's) |
| The fold | What did I miss; can I see it | Count, who, Reveal, Show them | **Keep**: it does its job and spoils nothing |
| A GIF | Send one | The GIF sheet | **Keep** |
| A person's name | Who's that | Nothing | **Keep** (their face and position live on Tonight and the hub; chat stays a conversation) |
| Earlier messages | Older talk | A tap at the top reads the 100 before | **Keep** |

## The five lenses

- **Own pace:** the fold per episode you haven't seen (as today); landmarks show airings, which are public.
- **Drafts and stages:** nothing in chat changes; reveal lines name the episode, not a game.
- **Spoilers:** a landmark says "aired", never a result; a grouped reveal line names who revealed, never what happened.

## Sports (the short check)

A sport's landmark is its game or week ("Wk 12 · Sun 1 PM", the season's own word); a slate week shows one landmark for the week's
first game. A sports couch's chat during a live game is the same stream.
