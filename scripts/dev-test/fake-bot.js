// Dev-only: a stand-in for the ask-AI bot (llm-browser-api, src/lib/server/ask-bot.ts), so a check can drive One tap and
// the bot's scheduled runs (docs/PLAN-new-design.md step 6c) without ChatGPT or production's VM. It answers GET /health
// and POST /ask like the real one; each question is answered by the check's own `answer(prompt)` (a string, or a promise
// of one), after an optional delay, and every question asked is kept in `asked` (with `stream`: "progress" when it was
// asked to stream how far it's got, as the real bot does: halfway through the delay, half the answer's written).
//
//   const bot = await require("./fake-bot").start({ answer: (prompt) => "...", delayMs: 1500 });
//   // point the dev server at it for a request or a browser: header  x-gys-bot: bot.url   (next dev only, loopback only)
//   bot.answer = (prompt) => ...;  bot.delayMs = 0;  bot.down = true (health and asks fail);  bot.asked;  await bot.close();
//
// No database, no server of the app's own: it's only the bot's side. The app reads the header in botFor (ask-bot.ts).
const http = require("http");

/** What kind of question a prompt is: the quick check, the full research, the schedule check, the rulebook prompt (step
 *  6c part 2: what a show change the couches confirmed adds), or Make it a game's two (step 10 part 2a): how a new show
 *  works ("setup", the rulebook prompt with no change) and who's in it ("cast"); bingo's squares ("bingo") and their check
 *  ("bingoCheck", docs/PLAN-bingo-bank.md step 2). */
function kindOf(prompt) {
  if (/These are bingo squares for people watching/.test(prompt)) return "bingoCheck";
  if (/Write \d+ bingo squares/.test(prompt)) return "bingo";
  if (/Start from this skeleton/.test(prompt)) return "full";
  if (/Answer two things/.test(prompt) && /Who left the game in this episode/.test(prompt)) return "quick";
  if (/when does episode \d+ air/i.test(prompt)) return "schedule";
  if (/as a rulebook for a fantasy game/.test(prompt)) return /changed how the game is played/.test(prompt) ? "rulebook" : "setup";
  if (/List the full starting cast of/.test(prompt)) return "cast";
  return "other";
}

async function start(opts = {}) {
  const bot = { answer: opts.answer || (() => "{}"), delayMs: opts.delayMs ?? 0, down: false, asked: [], url: null, busy: 0 };
  const server = http.createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/health") {
      if (bot.down) return send(503, { status: "down" });
      return send(200, { status: "ok", busy: bot.busy ? ["chatgpt"] : [] });
    }
    if (req.method === "POST" && req.url === "/ask") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", async () => {
        if (bot.down) return send(503, { detail: "the stand-in bot is down" });
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          return send(400, { detail: "bad body" });
        }
        const prompt = body.prompt || "";
        // stream "progress" (the real bot's, llm-browser-api): a line asking, half the delay, a line with half the answer
        // written (its pattern counted in it), the other half, then the answer on a line (a failure as { detail }).
        const streamed = body.stream === "progress";
        bot.asked.push({ kind: kindOf(prompt), prompt, at: Date.now(), stream: streamed ? "progress" : null });
        bot.busy++;
        const started = Date.now();
        const wait = (ms) => (ms ? new Promise((r) => setTimeout(r, ms)) : null);
        const line = (o) => res.write(JSON.stringify(o) + "\n");
        if (streamed) {
          res.writeHead(200, { "content-type": "application/x-ndjson" });
          line({ progress: { stage: "asking", chars: 0 } });
        }
        try {
          await wait(streamed ? bot.delayMs / 2 : bot.delayMs);
          const response = await bot.answer(prompt, kindOf(prompt));
          if (streamed) {
            const half = response.slice(0, Math.floor(response.length / 2));
            const re = body.progress_pattern ? new RegExp(body.progress_pattern, "g") : null;
            line({ progress: { stage: "writing", chars: half.length, ...(re ? { matches: (half.match(re) || []).length } : {}) } });
            await wait(bot.delayMs / 2);
            line({ response, seconds: (Date.now() - started) / 1000 });
            res.end();
          } else send(200, { response, seconds: (Date.now() - started) / 1000 });
        } catch (e) {
          const detail = e instanceof Error ? e.message : "failed";
          if (streamed) {
            line({ detail });
            res.end();
          } else send(502, { detail });
        } finally {
          bot.busy--;
        }
      });
      return;
    }
    send(404, { detail: "not here" });
  });
  await new Promise((r) => server.listen(opts.port ?? 0, "127.0.0.1", r));
  bot.url = `http://127.0.0.1:${server.address().port}`;
  bot.close = () => new Promise((r) => server.close(() => r()));
  return bot;
}

module.exports = { start, kindOf };
