// One campaign case in an isolated worker thread (runner.cjs owns scheduling, accounting and the watchdog).
const { parentPort, workerData } = require('worker_threads');
const { runCase, runApiCase } = require('./case.cjs');
const { manifest, index } = workerData;
(manifest.tier === 'api' ? runApiCase(manifest, index, { onLease: key => parentPort.postMessage({ lease: key }) }) : Promise.resolve(runCase(manifest, index)))
  .then(result => parentPort.postMessage({ result }), e => parentPort.postMessage({ result: { caseId: null, index, outcome: 'infrastructure', signature: 'worker-throw', message: e.message } }));
