// A stand-in for next/server inside a check's own process (jiti alias), so server code that schedules work with after()
// (pushes once a write commits) can run outside a request: the work runs straight away instead. `NextResponse.json` too, so a
// check can call a route's handler in its own process (check-sports-ir.js: a Request with a signed-in cookie, the answer read
// back as JSON); nothing else of next/server is here.
module.exports = {
  after(task) {
    Promise.resolve()
      .then(typeof task === "function" ? task : () => task)
      .catch((e) => console.error("[after]", e));
  },
  NextResponse: {
    json: (body, init) => Response.json(body, init),
  },
};
