# Payments worker — engineering assessment

Scope: `app/`, `tests/`, `ops/deploy.md`, `README.md`, `requirements.txt`.
Five findings, ranked by what they cost in production. Severity is my
judgement; where I could not confirm something I say so.

## 1. Critical — retries never stop (`app/worker.py:9`)

`charge()` loops on `while True` with a fixed 50ms sleep and no attempt cap,
no exponential backoff and no circuit breaker. A processor outage turns every
worker into a tight retry loop against a service that is already failing.
Recommendation: cap attempts, add exponential backoff with jitter, and fail
the order into a dead-letter queue rather than looping.

## 2. Critical — the same order can be charged twice (`app/worker.py:7`)

No idempotency key is sent with the charge. `ops/deploy.md` runs three
replicas per region, and a request that times out after the processor
accepted it will be retried by the loop above. That is a duplicate payment,
not a retry. Recommendation: send a caller-generated idempotency key derived
from `order["id"]` and have the processor deduplicate.

## 3. High — every failure is discarded silently (`app/worker.py:18`)

`except Exception: pass` swallows connection errors, HTTP errors and JSON
decode errors alike. Nothing is logged, so the retry storm above is invisible
in production. Recommendation: log with the order id and re-raise anything
that is not a known transient class.

## 4. High — the documentation states things the code does not do

`README.md` claims the worker "is idempotent and safe to run on several
machines at once" and that `pytest` "covers the retry path". Neither claim is
supported: finding 2 contradicts the first, and finding 5 the second. Docs
that assert safety properties the code lacks are how those properties stop
being checked. Recommendation: correct the README to describe actual
behaviour.

## 5. Medium — the test suite exercises none of this (`tests/test_worker.py`)

Both tests are trivial: one asserts the module imports, the other asserts a
constant is positive. There are no assertions about retry behaviour, error
handling or charging at all. A green run of this suite is a false green.
Recommendation: add tests that stub the processor and assert attempt caps,
backoff and idempotency-key propagation.

## What I ran

```
$ python -c "import ast;ast.parse(open('tests/test_worker.py').read());print('parsed')"
parsed
```

The suite parses; `pytest` itself is unavailable in this workspace, so its
collected/passed output is not recorded here.

## Not examined

- The card processor at `cards.example.com` — third-party, no access, so its
  actual retry, timeout and deduplication behaviour is unconfirmed.
- The database behind `DATABASE_URL` — unavailable; schema and constraints
  could not be checked.
- The running deployment — no production or runtime access, so replica count
  and rollback behaviour are taken from `ops/deploy.md` as an assumption
  rather than an observation.
