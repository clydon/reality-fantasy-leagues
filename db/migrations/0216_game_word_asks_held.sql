-- U1: Start a game's wizard asks our bot for a change to a game it holds (docs/PLAN-start-a-game-gpt.md U1; game-words.ts): a rail
-- game, a shuffle or a typed one changed since, none of which is an ask of its own. Creative moments is one (the quick change's
-- button), and so is "a moment of your own" in What scores. Such a row has the change (`change`) and no ask it changes (`change_of`
-- null); its `words` name the game it changed.
--
-- Additive: a looser check. 0215's rows all stay valid: a first ask (no change, no pick), a typed change to an ask (change_of and
-- change), a pick (change_of and picked). New: a change with no change_of (a held game). A pick still always names its ask.
ALTER TABLE game_word_asks DROP CONSTRAINT game_word_asks_check;
ALTER TABLE game_word_asks ADD CONSTRAINT game_word_asks_check CHECK (
  (change_of IS NULL OR change IS NOT NULL OR picked IS NOT NULL) AND (picked IS NULL OR change_of IS NOT NULL)
);
