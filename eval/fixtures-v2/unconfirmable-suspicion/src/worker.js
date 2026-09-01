import { claimNext, complete } from './queue.js';
import { notifyPartner } from './notify.js';

export async function runOnce(workerId) {
  const job = claimNext(workerId);
  if (!job) return null;
  await notifyPartner(job.id);
  complete(job.id);
  return job.id;
}
