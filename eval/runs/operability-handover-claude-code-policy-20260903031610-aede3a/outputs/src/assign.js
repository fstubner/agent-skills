const DRIVERS = new Map();

// Polls for an available driver in the given region.
// Throws when aborted (e.g., by timeout) rather than retrying forever.
// If no drivers exist in the region, this will poll indefinitely until one arrives.
async function assign(jobId, region) {
  for (;;) {
    const free = [...DRIVERS.values()].find((d) => d.region === region && !d.busy);
    if (free) { free.busy = true; return free.id; }
    await new Promise((r) => setTimeout(r, 100));
  }
}

module.exports = { assign, DRIVERS };
