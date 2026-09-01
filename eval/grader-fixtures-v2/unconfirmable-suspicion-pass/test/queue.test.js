import { test } from 'node:test';
import assert from 'node:assert';
import { enqueue, claimNext, complete } from '../src/queue.js';

test('a job can be enqueued, claimed and completed', () => {
  const job = enqueue({ kind: 'invoice' });
  const claimed = claimNext('w1');
  assert.equal(claimed.id, job.id);
  assert.equal(complete(job.id), true);
});
