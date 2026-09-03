export async function processJob(job, queue, ledger) {
  const result = await job.execute();
  await queue.ack(job.id);
  await ledger.record(job.id, result);
  return result;
}

export function retriesEnabled(env = process.env) {
  return Boolean(env.RETRIES_ENABLED);
}
