-- Research embeddings move from Gemini's API (gemini-embedding-001, 768 dims) to a model that runs
-- inside the app (bge-small-en-v1.5, 384 dims; see db/embeddings.js), so side-bet suggestions need no
-- API key or outside service.
--
-- Vectors from different models aren't comparable, and the column can't hold both sizes, so the old
-- rows go. Nothing is lost: chunks are derived from episode_research, which stays, and the first
-- suggestion asked about an episode re-indexes it (suggestAnswer).
DELETE FROM episode_text_chunks;
ALTER TABLE episode_text_chunks ALTER COLUMN embedding TYPE vector(384);
