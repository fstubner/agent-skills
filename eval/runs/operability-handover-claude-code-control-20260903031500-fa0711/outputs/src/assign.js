const DRIVERS = new Map();

// Retries the driver lookup with timeout. Returns null if no driver available after timeout.
async function assign(jobId, region, timeoutMs = 30000) {
  const startTime = Date.now();
  for (;;) {
    const free = [...DRIVERS.values()].find((d) => d.region === region && !d.busy);
    if (free) { free.busy = true; return free.id; }
    if (Date.now() - startTime > timeoutMs) return null;
    await new Promise((r) => setTimeout(r, 100));
  }
}

module.exports = { assign, DRIVERS };
