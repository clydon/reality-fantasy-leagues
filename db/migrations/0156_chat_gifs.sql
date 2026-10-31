-- GIFs in the couch chat (the user, 2026-10-31; src/lib/server/gifs.ts, KLIPY): a message may be a GIF, kept as Watch along's
-- reactions keep one ({ id, url, w, h, title }, only from KLIPY's own media hosts: watch-along.ts cleanGif). Its text stays
-- "GIF", so classic's chat, the push and anything that reads text still say something; the new design draws the picture. Folded
-- like any message (couch-chat.ts linesOf), and not editable.
ALTER TABLE chat_messages ADD COLUMN gif JSONB;
