# A league's page, Chat (sports-couch B1, session 5): the page spec (Intent, step 1)

2026-11-22, the `sports-couch` lane. Intent's `journey`, once. On round 1's line ("Chat: the couch's room for the league, with a
thread per game (the game row's chat count opens it)": [sports-space-spec.md](sports-space-spec.md)), round 2's ("Chat is the room
plus a thread per game": [sports-couch-play-spec.md](sports-couch-play-spec.md)), the show's Chat as step 9 designed it
([step9-chat-spec.md](step9-chat-spec.md): days, landmarks, the fold, the composer) and the four tabs before it. The last of B1.

## The job

**The couch's talk about the league: the week's trash talk and calls in one room, and talk during a game kept with that game, so
nobody hiding sports scores is spoiled by it.** The show's Chat is one room about one season; a league runs many games at once,
so a message about a game carries that game, and the game is what the fold and the threads go by.

## What exists today (the chat map, 2026-11-22)

- Every sports game a couch starts is a season of its own, and each has its own chat (couch-chat.ts: a couch's chat about a
  season). The NFL with a Pick'em, a draft and a team's season is three chats, and no room spans the league.
- chat_messages holds a game's (league_id) or a couch's about a season (couch_id + season_id); reactions, edits, deletes, GIFs,
  read marks and the badge go through chat.ts and couch-chat.ts; the show's Chat screen draws a message, the composer and its sheet
  (show/chat.tsx).
- Folding is by episode airtime on the server. Sports scores are hidden on the phone (useGameScore), by the game.

## Structure, in rank order

1. **The threads row** (only when there's a thread to choose): **All** and each game with talk or on today among the couch's
   teams' games, at most three, live first ("Eagles at Jets · On now"), then "+N". All is the room with every message; a game's
   chip shows only that game's talk. A hidden game's chip never says live or final: "Started" (the 2026-11-09 rule).
2. **The stream** (newest at the bottom, as the show's Chat): days; runs of one person; a message in a game's thread carries the
   game on its first line ("Riley · Eagles at Jets · 2:14 PM"), tappable to that thread. Reactions and the message's sheet as the
   show's (react, copy, edit, delete).
3. **The fold, per game**, for anyone hiding sports scores (or watching that game as if live): every message in a game's thread
   written after its start, until you've shown its score, as one dashed line where the first was: "4 messages in Eagles at Jets
   since it started · From Riley and Sam" with **Show the score** (the same reveal as everywhere: showScore, which tells the server
   and unfolds). Talk before kickoff isn't folded.
4. **The composer:** "Message the couch". While a couch game is on (or you're in its thread), an **About** chip names it
   ("About Eagles at Jets ×"): on by default while it's live, so talk during a game lands in its thread; × posts to the room.
   GIFs as the show's.

**Where a message goes** is the author's choice, defaulted by the moment: in a thread, there; in All while a couch game is on,
that game (the chip says so); otherwise the room. The default is what keeps the fold honest.

## Situations, in rank order

| # | Who, when | First need |
| --- | --- | --- |
| 1 | Andrew, Sunday 2 PM, the Giants on: "did you see that" | type, send, it lands in the game's thread |
| 2 | Joanna, hiding scores, recording the game | the room readable, the game's talk folded, nothing spoiled |
| 3 | Riley, Wednesday: trash talk before the Eagles at Jets | the room, no thread needed |
| 4 | Conor scrolls back through Sunday's game | the game's chip: its whole thread |
| 5 | A push: "Riley in Eagles at Jets" | opens the thread (hidden: folded, says so) |
| 6 | Solo (no couch) | one line: Chat is the couch's; Start a couch · Join one |
| 7 | A spectator on the couch (follows the league, no team) | the room as everyone's |
| 8 | Off-season | the room; no threads row |
| 9 | Nothing said yet | "No messages yet. Say something to the couch about the NFL." |

## Flows and return paths

- **Tap a message's game tag** → the thread (the chip row selects it); **All** goes back. The thread is a filter, not a page:
  Back leaves the tab as before.
- **Show the score on a fold** → that game's score shows everywhere for the visit and its messages unfold in place.
- **A push** → `/league/<sport>/<code>/chat?thread=<event>` opens on that thread.
- **Send in a thread** → the message appears at the bottom of the thread and in All.

## Each surface and its verdict

| Level | Questions (casual · sweat) | Data held | Today | Verdict |
| --- | --- | --- | --- | --- |
| The tab | What's the couch saying about the NFL? | none (a chat per game's season) | none | **new screen** (a league room) |
| The threads row | What's being said about this game? | messages' game, the week | none | **new display** |
| A message | who, when, which game | the show chat's message | show/chat.tsx Line | **keep** (the game on its first line: one added tag) |
| The fold | what did I miss, is it safe | the game's start, Hide sports scores, shown | the show's fold by episode | **restructure** (by game, on the phone) |
| The composer | send, to where | | the show's | **keep** + the About chip |
| The message's sheet | react, copy, edit, delete | | the show's | **keep** |
| A game's own chat (a Pick'em's season) | that game's players' talk | couch-chat.ts | its show space's Chat | **keep** (a fantasy game's chat, not a real game's thread; see the flaw) |

## The data

**A migration (0314, additive):** chat_messages gains `sports_league` (the room: "football/nfl", with `couch_id`), `sports_event`
(a thread: the provider's game id) and `sports_event_at` (its start, so the fold knows when talk turned live); the place check
admits a league room (couch and league); a `league_chat_reads` table (couch, league, person) for the badge. Reactions, edits,
deletes and GIFs reuse chat.ts. Routes under `/api/sports/league/chat?league=&couch=` mirror the season chat's (read with a `v`
fingerprint, post, react, edit, delete, read, unread). Polled every 5 s while open, the badge every 30 s, as the show's; a small
read on the database only, no external call. Pushes: couch members who follow the league (or a team in it), as the couch chat's,
with a thread message's text held back for anyone hiding sports scores.

## A flaw, raised (not designed around)

**Two places to talk about the same game.** A couch's Pick'em on Sunday's games has its own chat (its season's, in its show
space), and this room has a thread for each real game. They answer different questions (the fantasy game's players about their
game, everyone about the football), but on game day both will fill. The fix would be one conversation: a game season's chat
shown inside the league room (its messages tagged by the games it covers), as linked leagues already share one chat. That's a
change to how game chats are scoped, beyond this tab. For the user.

## Left out, and why

- **A game row's chat count** (round 1: "the game row's chat count opens it"): the shared scorebug is used by the hub's strip and
  Scores alike; a count there is its own small step once this room exists.
- **Server-side folding** for sports: scores are hidden on the phone everywhere (the week read carries them); the chat follows the
  same rule. A thread message's text is held back from a hider's push.
- **The room's latest line on This week** (round 2's item 5): a small follow-up once the room exists.
