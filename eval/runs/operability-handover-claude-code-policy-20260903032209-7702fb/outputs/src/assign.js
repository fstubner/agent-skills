const DRIVERS = new Map();

// Retries the driver lookup until one is free or timeout is exceeded.
// Timeout prevents hangs during regional outages.
async function assign(jobId, region, timeoutMs = 5000) {
  const startTime = Date.now();
  for (;;) {
    const free = [...DRIVERS.values()].find((d) => d.region === region && !d.busy);
    if (free) { free.busy = true; return free.id; }
    if (Date.now() - startTime > timeoutMs) {
      const err = new Error(`no drivers available in region ${region}`);
      err.code = 'NO_DRIVERS_AVAILABLE';
      throw err;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

module.exports = { assign, DRIVERS };
