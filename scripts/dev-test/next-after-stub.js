// A stand-in for next/server inside a check's own process (jiti alias), so server code that schedules work with after()
// (pushes once a write commits) can run outside a request: the work runs straight away instead. Only `after` is here;
// nothing a check loads this way builds a response.
module.exports = {
  after(task) {
    Promise.resolve()
      .then(typeof task === "function" ? task : () => task)
      .catch((e) => console.error("[after]", e));
  },
};
