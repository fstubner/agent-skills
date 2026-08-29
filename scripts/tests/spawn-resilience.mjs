// The suite spawns hundreds of processes, and on a loaded Windows box some of
// them fail to start. spawnSync signals that with `error` set, `status` null
// and `stderr` empty — which every call site here read as an ordinary
// assertion failure with no evidence.
//
// Measured on 2026-08-29: 20 "syntax <file>" failures against files that
// compile fine, two plugin-bundles failures, one grader failure, and two
// EPERM crashes in cleanup — all in one afternoon, none of them defects.
import { expect, isTransientSpawnError, spawnRetry, spawnFailure } from './harness.mjs';

for (const code of ['EAGAIN', 'EBUSY', 'EPERM', 'ENOMEM', 'ETXTBSY', 'UNKNOWN']) {
  expect(`spawn: ${code} is treated as transient`, isTransientSpawnError(code));
}
// A missing binary is a real result, not a busy machine. Retrying it would
// turn a fast, correct failure into a slow one.
for (const code of ['ENOENT', 'EACCES', 'E2BIG', undefined]) {
  expect(`spawn: ${code} is NOT treated as transient`, !isTransientSpawnError(code));
}

// A process that starts and fails is not a spawn failure — the distinction
// the whole change rests on.
const ran = spawnRetry(process.execPath, ['-e', 'process.exit(3)']);
expect('spawn: a process that ran and exited non-zero reports no spawn failure',
  spawnFailure(ran) === null && ran.status === 3, `status=${ran.status}`);

const ok = spawnRetry(process.execPath, ['-e', 'console.log("hi")']);
expect('spawn: a successful process reports no spawn failure',
  spawnFailure(ok) === null && ok.status === 0 && ok.stdout.trim() === 'hi', ok.stdout);

// Non-transient errors return immediately rather than burning the retry
// budget. Five attempts with exponential backoff would be ~1.5s of sleeping
// per missing binary, across a suite that has plenty of them.
const started = Date.now();
const missing = spawnRetry('definitely-not-a-real-binary-9f3a', []);
const elapsed = Date.now() - started;
expect('spawn: a missing binary is reported as a spawn failure',
  typeof spawnFailure(missing) === 'string', String(spawnFailure(missing)));
expect('spawn: a missing binary is not retried', elapsed < 1000, `${elapsed}ms`);
