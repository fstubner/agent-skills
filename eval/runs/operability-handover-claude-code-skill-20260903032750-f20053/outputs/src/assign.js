const DRIVERS = new Map();
const ASSIGN_TIMEOUT_MS = parseInt(process.env.ASSIGN_TIMEOUT_MS || '30000', 10);

// Retries the driver lookup until one is free. Throws if no driver available
// within the timeout window.
async function assign(jobId, region) {
  const startTime = Date.now();

  for (;;) {
    const free = [...DRIVERS.values()].find((d) => d.region === region && !d.busy);
    if (free) { free.busy = true; return free.id; }

    if (Date.now() - startTime > ASSIGN_TIMEOUT_MS) {
      throw new Error(`no drivers available for region '${region}' within ${ASSIGN_TIMEOUT_MS}ms`);
    }

    await new Promise((r) => setTimeout(r, 100));
  }
}

module.exports = { assign, DRIVERS };
