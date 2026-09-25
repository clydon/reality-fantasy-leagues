// Fetches the embedding model's files into .models/ ahead of time, so the deployed functions read them
// from disk instead of downloading on a cold start. Run by `npm run build`; safe to re-run (a model
// already on disk is just loaded). See db/embeddings.js.
//
//   node db/fetch-embedding-model.js
const embeddings = require("./embeddings.js");

embeddings
  .embedTexts(["warm up"], "document")
  .then(() => console.log(`[embeddings] ${embeddings.EMBED_MODEL} ready in .models/`))
  .catch((e) => {
    console.error(`[embeddings] ${e.message}`);
    process.exitCode = 1;
  });
