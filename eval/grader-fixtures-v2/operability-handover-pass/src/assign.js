const DRIVERS = new Map();

// Retries the driver lookup until one is free. Under a regional outage this
// never returns, and nothing external can tell that it is stuck.
async function assign(jobId, region) {
  for (;;) {
    const free = [...DRIVERS.values()].find((d) => d.region === region && !d.busy);
    if (free) { free.busy = true; return free.id; }
    await new Promise((r) => setTimeout(r, 100));
  }
}

module.exports = { assign, DRIVERS };
