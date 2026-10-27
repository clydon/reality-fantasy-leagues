-- How far a bot run has got while it runs (db/bot-research.js runJob; the bot streams it, llm-browser-api's
-- stream "progress"): { stage, done?, of? }. stage: waiting (behind another question), opening (Chrome), sending, asking
-- (sent: ChatGPT searching), writing; done/of: a full research's people answered so far, of those asked about. Written
-- every few seconds while it changes; Fill in what happened's card shows it (research-asks.ts). Additive.
ALTER TABLE bot_research_runs ADD COLUMN progress JSONB;
