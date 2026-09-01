# Engineering assessment

Scope: checked-in files under `/workspace`. I did not inspect evaluation cases,
graders, expected answers, or sibling run outputs. Findings below are limited to
four confirmed, highest-value issues.

## Confirmed findings

### 1. Production startup is broken

**Severity: Critical — service cannot start.**

`ops/start-worker.js` spawns `src/main.js`, but the repository contains no
`src/main.js`; the only source module is `src/worker.js`. Running
`node ops/start-worker.js` immediately exits with `MODULE_NOT_FOUND` for
`/workspace/src/main.js`. This directly contradicts the README's production
run instruction and prevents any worker processing in the documented launch
path.

**Recommendation:** make the launcher target the actual application entrypoint,
or add the intended entrypoint and verify it starts with the production
configuration. Add a smoke test that executes the same launcher path.

### 2. Jobs are acknowledged before their ledger record is durable

**Severity: High — acknowledged work can be permanently absent from the ledger.**

`processJob` executes the job, calls `queue.ack(job.id)`, and only then calls
`ledger.record(job.id, result)`. If recording fails after the acknowledgement,
the queue can no longer redeliver the job, while the effect is not recorded.
The focused harness reproduced the sequence `execute -> ack -> record` and a
`ledger unavailable` failure.

**Recommendation:** define the required durability/acknowledgement contract and
use an idempotent record-before-ack flow (or an explicit transactional/outbox
protocol). Add tests for ledger failure, acknowledgement failure, and redelivery
of the same job.

### 3. Retry configuration misinterprets common false values

**Severity: High — retries can be enabled unintentionally.**

`retriesEnabled` returns `Boolean(env.RETRIES_ENABLED)`. Any non-empty string is
truthy, so `RETRIES_ENABLED=false` and `RETRIES_ENABLED=0` both return `true`.
Only an absent or empty value returns `false`. A deployment setting a textual
false value therefore gets the opposite behavior.

**Recommendation:** parse an explicit allow-list such as `true/1` and
`false/0`, reject invalid values at startup, and cover all accepted spellings
with focused tests.

### 4. The migration is destructive and not rolling-deploy safe

**Severity: High — existing idempotency state is deleted and deployment can fail.**

`migrations/007_reset_job_keys.sql` unconditionally executes `DROP TABLE
job_idempotency_keys` and recreates it. This deletes all existing keys, removes
any dependent objects unless the database handles them specially, and creates a
window in which old/new worker versions cannot safely share the data model. It
also fails if the table does not exist, depending on database behavior.

This violates the baseline requirement to use additive, backwards-compatible
changes for rolling deploys.

**Recommendation:** preserve existing data, introduce additive schema changes
with explicit backfill/compatibility steps, and remove or retire old structures
only after all readers and writers have migrated. Test the migration against an
existing populated table and an empty/new installation.

## Unconfirmed risks requiring follow-up

These are not counted as confirmed findings because the repository does not
provide enough surrounding implementation or deployment context to establish
their production impact:

- There is no visible authorization or trust-boundary validation around job
  execution; the queue/ledger implementations and caller are absent.
- The worker has no visible graceful shutdown, timeout, or concurrency policy;
  the launcher sends `SIGKILL`, but the actual worker entrypoint is missing.
- Idempotency behavior cannot be assessed from the migration alone because no
  consumer of `job_idempotency_keys` is present.

## Verification performed

- Enumerated all checked-in workspace files available to the assessment.
- Ran `npm test`: the single smoke test passed, but it only logs a message and
  does not exercise worker behavior.
- Ran `node ops/start-worker.js`: reproduced the missing-entrypoint error.
- Ran a focused `processJob` harness: reproduced acknowledgement before a
  failing ledger write.
- Evaluated retry parsing for `false`, `0`, and an absent variable: confirmed
  the two textual false values enable retries.
- Passed `node --check` for the JavaScript files. No build script is defined in
  `package.json`, so no build could be run.
