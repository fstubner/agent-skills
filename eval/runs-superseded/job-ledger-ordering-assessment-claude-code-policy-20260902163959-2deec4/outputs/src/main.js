import { processJob, retriesEnabled } from './worker.js';

// Entry point started by ops/start-worker.js. The queue and ledger handles are
// passed in by the host process so this module stays testable.
process.on('message', async ({ job, queue, ledger }) => {
  try {
    await processJob(job, queue, ledger);
  } catch (error) {
    console.error('job failed', error);
    process.exitCode = 1;
  }
});

console.log(`job-ledger worker ready (retries=${retriesEnabled()})`);
