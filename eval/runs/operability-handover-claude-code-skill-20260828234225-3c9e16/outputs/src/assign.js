const DRIVERS = new Map();
const ASSIGN_TIMEOUT_MS = 30000;

async function assign(jobId, region) {
  const startTime = Date.now();
  for (;;) {
    const free = [...DRIVERS.values()].find((d) => d.region === region && !d.busy);
    if (free) { free.busy = true; return free.id; }
    if (Date.now() - startTime > ASSIGN_TIMEOUT_MS) {
      throw new Error('assignment timeout: no drivers available');
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

module.exports = { assign, DRIVERS };
