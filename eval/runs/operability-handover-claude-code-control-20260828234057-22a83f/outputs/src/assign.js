const DRIVERS = new Map();
const ASSIGN_TIMEOUT_MS = parseInt(process.env.ASSIGN_TIMEOUT_MS || '10000', 10);

// Retries the driver lookup until one is free.
// Timeout ensures visibility into stuck driver lookups.
async function assign(jobId, region, requestId) {
  const startTime = Date.now();

  for (;;) {
    const free = [...DRIVERS.values()].find((d) => d.region === region && !d.busy);
    if (free) { free.busy = true; return free.id; }

    if (Date.now() - startTime > ASSIGN_TIMEOUT_MS) {
      const err = new Error(`No drivers available in region ${region} after ${ASSIGN_TIMEOUT_MS}ms`);
      err.code = 'TIMEOUT';
      err.region = region;
      throw err;
    }

    await new Promise((r) => setTimeout(r, 100));
  }
}

module.exports = { assign, DRIVERS, ASSIGN_TIMEOUT_MS };
