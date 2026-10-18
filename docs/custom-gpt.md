# The Game Your Show custom GPT

Part of the "skip the copy" experiment (`src/components/ask-ai.tsx`). Every prompt the app hands out is
also parked at `/b/<code>` (`src/app/b/[code]/route.ts`), and the test row under each Copy button opens
ChatGPT, Claude, Gemini and the rest with a one-line message pointing at it.

A custom GPT is the sturdier ChatGPT version of the same idea. The GPT's own instructions say to fetch
the brief, so there's no question of whether ChatGPT will act on a page a user linked to, and it reads
the brief through an API action instead of browsing. Its button appears in the test row once
`NEXT_PUBLIC_GYS_GPT_URL` is set.

## Setting it up (needs a paid ChatGPT plan to build; anyone signed in can use it)

1. ChatGPT > GPTs > Create > Configure.
2. **Name:** Game Your Show. **Description:** Sets up and scores your reality TV fantasy league.
3. **Instructions:**

   > You are the research assistant for Game Your Show, a fantasy app for reality TV. Every conversation
   > starts with a message containing a brief code, like "Brief code: AbC123xyz_-AbC12". Call getBrief
   > with that code straight away, then carry out the instructions it returns exactly as if the user had
   > pasted them in: search the web as they say, and reply only in the format they ask for, with no
   > extra commentary. If getBrief says the brief has expired, tell the user to go back to Game Your
   > Show and start again. If a message has no code, ask them to open this GPT from the app.

4. **Capabilities:** Web Search on. Canvas, image generation and code interpreter off.
5. **Actions > Create new action > Import from URL:** `https://www.gameyourshow.com/api/briefs/openapi.json`.
   Authentication: None. Privacy policy: the site's privacy page.
6. Save, sharing "Anyone with the link". Copy the GPT's URL (`https://chatgpt.com/g/g-…`).
7. Set `NEXT_PUBLIC_GYS_GPT_URL` to that URL in the production environment and redeploy. It's read at
   build time, so a redeploy is needed.

When the GPT reads a brief, the test row says "Read by Custom GPT".

## Reading the results

Every read of a brief is logged in `ai_brief_fetches` with the fetcher's user agent. The test row shows
who read the brief it made. For an overview:

```sql
SELECT date_trunc('day', fetched_at) AS day, via, user_agent, count(*)
FROM ai_brief_fetches GROUP BY 1, 2, 3 ORDER BY 1 DESC, 4 DESC;
```

A chat that opens the link but whose answer won't import followed the page badly. A chat that never
shows up in the log didn't open it at all, or its prefill link no longer works.
