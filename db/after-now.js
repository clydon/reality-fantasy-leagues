// next/server's after() for a plain Node job (db/sports-refresh.js, loading the app's server code through jiti): there's no request
// to run work after, so the work starts at once, and the job waits for all of it before it ends (settled()). Only `after` is here:
// nothing a job loads this way builds a response.
// On the global, so a copy jiti loads for the app's code and the job's own copy share one list.
const pending = (globalThis.__afterNowPending ??= []);

module.exports = {
  after(task) {
    pending.push(
      Promise.resolve()
        .then(typeof task === "function" ? task : () => task)
        .catch((e) => console.error("[after]", e))
    );
  },
  /** Everything started with after(), finished (and anything those started in turn). */
  async settled() {
    while (pending.length) await Promise.all(pending.splice(0));
  },
};
