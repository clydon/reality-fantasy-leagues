// Dev-only: a stand-in for the ask-AI bot (llm-browser-api, src/lib/server/ask-bot.ts), so a check can drive One tap and
// the bot's scheduled runs (docs/PLAN-new-design.md step 6c) without ChatGPT or production's VM. It answers GET /health
// and POST /ask like the real one; each question is answered by the check's own `answer(prompt)` (a string, or a promise
// of one), after an optional delay, and every question asked is kept in `asked`.
//
//   const bot = await require("./fake-bot").start({ answer: (prompt) => "...", delayMs: 1500 });
//   // point the dev server at it for a request or a browser: header  x-gys-bot: bot.url   (next dev only, loopback only)
//   bot.answer = (prompt) => ...;  bot.delayMs = 0;  bot.down = true (health and asks fail);  bot.asked;  await bot.close();
//
// No database, no server of the app's own: it's only the bot's side. The app reads the header in botFor (ask-bot.ts).
const http = require("http");

/** What kind of question a prompt is: the quick check, the full research, or the schedule check. */
function kindOf(prompt) {
  if (/Start from this skeleton/.test(prompt)) return "full";
  if (/Answer two things/.test(prompt) && /Who left the game in this episode/.test(prompt)) return "quick";
  if (/when does episode \d+ air/i.test(prompt)) return "schedule";
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
        let prompt = "";
        try {
          prompt = JSON.parse(raw).prompt || "";
        } catch {
          return send(400, { detail: "bad body" });
        }
        bot.asked.push({ kind: kindOf(prompt), prompt, at: Date.now() });
        bot.busy++;
        const started = Date.now();
        try {
          if (bot.delayMs) await new Promise((r) => setTimeout(r, bot.delayMs));
          const response = await bot.answer(prompt, kindOf(prompt));
          send(200, { response, seconds: (Date.now() - started) / 1000 });
        } catch (e) {
          send(502, { detail: e instanceof Error ? e.message : "failed" });
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
