---
name: testing-strategy
description: >-
  Decide what to test, at which level, and how to make failures point at
  the actual cause — test pyramid triage, testing behavior over
  implementation, pinning the specific reason a test fails rather than just
  pass/fail, and treating flaky tests as worse than no test. Triggers when
  designing test coverage for new functionality, when a test suite is
  slow/flaky/hard to trust, or when explicitly asked how to test something.
  Not a substitute for a language or framework's own testing-tool docs —
  this is the judgment layer above the tool (what to test and why), not the
  API for any specific test runner.
---

# Testing strategy

A test's job is to fail *specifically* when something is actually broken,
and stay quiet otherwise. A suite that's green but doesn't fail on real
regressions is worse than an honest gap, because it's mistaken for coverage.

No shared artifacts, no checker script — deciding what's worth testing is a
judgment call about the code's actual risk, not something generic to
automate. This suite's own `scripts/run-tests.mjs` is used below as a
worked, verifiable example of several of these rules in practice — not a
hypothetical.

## Triage: what level

| What you're testing | Level | Why |
|---|---|---|
| Pure logic, edge cases, a function with real branching | Unit | Fast, isolated, pinpoints the exact broken function |
| The seam between two real components (a parser and its caller, a query and its schema) | Integration | Unit tests on each side can both pass while the seam is broken |
| A critical end-to-end path a user actually takes | End-to-end / acceptance | Slow and expensive on purpose — reserve for the few paths where nothing less proves the system actually works together |

This is the test pyramid: many fast unit tests, fewer integration tests,
fewest end-to-end tests. A suite shaped the other way (mostly slow
end-to-end tests, few units) is usually a sign that unit-level seams aren't
testable in isolation — often itself a `code-organization` problem (tight
coupling forcing every test through the whole stack).

## Rules

1. **Test behavior, not implementation.** A test that breaks when you
   rename a private helper, without any actual behavior changing, is
   coupled to the wrong thing — it will resist refactoring instead of
   enabling it. Assert on inputs and outputs or observable effects, not
   internal call sequences, unless the sequence itself is the contract.
2. **Pin the specific reason for failure, not just pass/fail.** A test that
   only checks "did the build succeed" can't tell you the build failed for
   the wrong reason. `run-tests.mjs`'s fixture tests assert the exact check
   id and status, not just the overall verdict, so a
   checker that blocks correctly but for the wrong reason still fails the
   test — verdict alone was proven insufficient by real drift bugs this
   suite shipped and caught this way.
3. **Never trust a report you didn't just produce.** A cached or
   hand-editable result is a liability the moment something else can also
   write it. This suite's acceptance gate re-runs every producer fresh
   rather than reading its JSON report from disk, specifically because a
   stale or planted report should never be able to forge a passing result —
   see `accept-poisoned-report` in `run-tests.mjs`, a fixture that commits a
   hand-written fake-SHIP report next to real failing project state,
   proving the gate ignores it. The same principle applies to any test that
   could be satisfied by a mock recording "yes, this happened" instead of
   checking that it actually did.
4. **Cover the skip and edge paths, not just the happy path.** A path
   that's never been exercised (an early-return, a "not applicable" branch)
   is a path with zero real coverage no matter what the rest of the suite
   looks like. This suite found and fixed exactly this gap more than once —
   `frontend-no-ui` and `backend-no-server` didn't exist until someone
   noticed every prior fixture assumed the feature was present.
5. **A regression test should exist because something broke, not because
   coverage looked thin.** A percentage doesn't distinguish between
   thoroughly tested logic and one assertion that happens to execute every
   line. Prefer mutation-style thinking: if this specific line were wrong,
   would any test actually fail? If not, that's the gap to close, not an
   arbitrary line the coverage tool flagged.
6. **A flaky test is worse than no test.** It trains people to re-run
   instead of investigate, and once that habit forms, a real failure gets
   the same shrug. Fix the flakiness or delete the test — a red build
   nobody trusts protects nothing.
7. **This overlaps with `product-acceptance`'s re-run-don't-trust design on
   purpose** — that skill is this rule (#3) applied at the level of an
   entire product's ship gate, not just one test.
