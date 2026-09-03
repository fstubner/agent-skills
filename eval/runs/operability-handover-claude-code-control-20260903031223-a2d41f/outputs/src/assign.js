const DRIVERS = new Map();

async function assign(jobId, region, timeoutMs = 30000) {
  const startTime = Date.now();
  for (;;) {
    const free = [...DRIVERS.values()].find((d) => d.region === region && !d.busy);
    if (free) { free.busy = true; return free.id; }

    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      throw new Error(`No available drivers in region ${region}`);
    }

    await new Promise((r) => setTimeout(r, 100));
  }
}

module.exports = { assign, DRIVERS };
