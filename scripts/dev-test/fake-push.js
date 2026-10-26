// Dev-only stand-in for a browser's push service (docs/PLAN-new-design.md step 15 part 2), so a check can see exactly what each
// reader's phone would get, without sending a real push anywhere. It listens on 127.0.0.1 and gives each person a subscription
// the way a browser makes one (a P-256 key pair and an auth secret); a check writes those into push_subscriptions, and the dev
// server's push-core.js, which sends to a loopback http endpoint over plain http in development only, posts the same encrypted,
// VAPID-signed request a real push service would get. This decrypts it (web-push's own http_ece) and keeps what each one said.
//
//   const push = await require("./fake-push").start();
//   const sub = push.subscription("alex");     // { endpoint, p256dh, auth }: INSERT INTO push_subscriptions ...
//   ...                                         // something the dev server pushes
//   push.of("alex")                             // [{ who, title, body, url, tag, ttl, urgency, signed, at }]
//   push.forget("alex")                         // alex's next push is answered 410 (gone), as an uninstalled app's is
//   await push.down()
//
// Needs the dev server's .env.local VAPID keys (push-core sends nothing without them). A one-off? No: reuse it for any check of
// notifications. Never point a real subscription here, and never run a check that writes push_subscriptions for a real account.
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const ece = require(path.join(__dirname, "..", "..", "node_modules", "http_ece"));

async function start({ port = 0 } = {}) {
  const received = [];
  const keys = new Map();
  const waiters = new Set();
  const server = http.createServer((req, res) => {
    const who = decodeURIComponent(req.url.split("/").pop() || "");
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const k = keys.get(who);
      if (!k) {
        res.writeHead(410);
        res.end();
        return;
      }
      try {
        const plain = ece.decrypt(Buffer.concat(chunks), { version: "aes128gcm", privateKey: k.ecdh, authSecret: k.auth.toString("base64url") });
        received.push({
          who,
          ...JSON.parse(plain.toString("utf8")),
          ttl: Number(req.headers.ttl),
          urgency: req.headers.urgency || null,
          signed: /^vapid t=/.test(req.headers.authorization || ""),
          at: Date.now(),
        });
        res.writeHead(201);
        res.end();
      } catch (e) {
        received.push({ who, error: e.message, at: Date.now() });
        res.writeHead(400);
        res.end();
      }
      for (const w of [...waiters]) w();
    });
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    received,
    /** A subscription for `who`, as a browser's PushSubscription.toJSON() gives it. */
    subscription(who) {
      const ecdh = crypto.createECDH("prime256v1");
      ecdh.generateKeys();
      const auth = crypto.randomBytes(16);
      keys.set(who, { ecdh, auth });
      return { endpoint: `${url}/push/${encodeURIComponent(who)}`, p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") };
    },
    /** Their next push is answered 410: the subscription is gone. */
    forget(who) {
      keys.delete(who);
    },
    of(who) {
      return received.filter((r) => r.who === who);
    },
    clear() {
      received.length = 0;
    },
    /** Resolves once `test(received)` is true, or after `ms` with whatever came (pushes are sent after the response). */
    until(test, ms = 8000) {
      return new Promise((resolve) => {
        const done = () => {
          if (!test(received)) return;
          waiters.delete(done);
          clearTimeout(timer);
          resolve(true);
        };
        const timer = setTimeout(() => {
          waiters.delete(done);
          resolve(false);
        }, ms);
        waiters.add(done);
        done();
      });
    },
    down: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

module.exports = { start };
