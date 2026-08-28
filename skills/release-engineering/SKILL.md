---
name: release-engineering
description: >-
  Design the path from committed code to running in production — pipeline
  gating order, one artifact promoted through every environment, rollback
  as a required part of the plan (not an afterthought), decoupling deploy
  from release via feature flags, and treating a deploy as incomplete until
  its health is actually observed. Triggers when setting up or reviewing
  CI/CD configuration, designing a deployment or rollout strategy, or when
  a release process has no clear rollback path. Distinct from
  `testing-strategy` (what to test) and `data-modeling` (schema shape) —
  this is specifically about how already-tested code and already-designed
  schemas get delivered safely.
---

# Release engineering

A release process is only as good as its worst day. The question that
matters isn't "does the happy path deploy work" — it's "when a deploy is
bad, how fast can it stop being live, and how would anyone know it's bad in
the first place."

Pipeline and deployment config is too platform-specific (GitHub Actions,
GitLab CI, a cloud provider's own deploy tooling) for a generic check, so
the rules below are verified by eye. One narrow slice is not:

```bash
node <this-skill>/scripts/check-smoke.js --root . --strict
```

It answers a single question — do the commands this project says to run
point at things that exist? Declared npm scripts, `main`/`bin` entry
points, a real test command, and at least one test file. It found its
reason for existing in an eval: a build shipped `"test": "node --test
test/"` with no `test/` directory, so the command failed instantly and
nothing in the suite noticed.

It does **not** execute the project's code. `--run` opts into running
`npm test` and is never set by acceptance — running a target project's
test suite means executing whatever that project wrote, which this suite
does nowhere else.

This is the deterministic floor under `product-acceptance`'s `A-runtime`,
not a replacement for it: scripts resolving is not the product working, and
`A-runtime` still requires an independent acceptor to run the thing.

## Rules

1. **One artifact, promoted, never rebuilt per environment.** Build once;
   move the same binary/image/bundle through dev → staging → prod. A
   pipeline that rebuilds at each stage risks shipping something subtly
   different from what was actually tested — a dependency resolving
   differently, a build-time flag drifting between runs.
2. **Cheap, fast checks gate before slow, expensive ones.** Lint and unit
   tests before integration tests, integration before a full deploy to a
   staging environment — the same test-pyramid ordering from
   `testing-strategy` applied to pipeline stage order, so a broken build
   fails in seconds, not after a twenty-minute deploy.
3. **Config and secrets are injected at deploy time, never baked into the
   artifact.** The same build must be able to run in every environment with
   only its configuration changing — an artifact that only works in the
   environment it happened to be built for isn't actually the thing that
   was tested in staging.
4. **Every release needs a rollback path defined before it ships, not
   discovered during an incident.** The bar is one documented command or
   one pipeline action — if reverting needs a sequence of manual steps
   someone must recall correctly at 3am, the release process is incomplete
   regardless of how good the forward path is. Write the rollback into
   `RELEASE.md` as a literal command; a description of a rollback is not a
   rollback, and the difference only shows up when you need it. Blue-green (two full environments, swap traffic) and
   canary (shift a small percentage of traffic first) both exist
   specifically to make "stop, this is bad" fast and cheap — pick based on
   whether the risk is "this build is broken" (blue-green: swap back
   instantly) or "this build is subtly wrong under real traffic" (canary:
   catch it before it's fully rolled out).
5. **Decouple deploying code from releasing behavior.** A feature flag lets
   a bad change be turned off in seconds without a rollback or a redeploy —
   the code shipped, but the behavior didn't activate for anyone until the
   flag flips. Not every change needs one — the flag has its own cost, and
   an un-removed flag becomes permanent branching nobody dares delete. So
   the decision gets recorded rather than assumed: the PR says
   `flagged: yes|no — <reason>`, and a flag that is on gets a removal
   condition at the same time. Whether a flag was "worth it" is arguable
   forever; whether the line is there is not.
6. **Schema migrations are a deploy hazard on their own timeline, not part
   of the code deploy.** A code rollback after a forward-only schema change
   leaves old code running against a schema it doesn't understand. Sequence
   migrations the way `data-modeling` recommends (additive, backward-
   compatible) specifically so a code rollback never depends on a schema
   rollback that may not be safe to run.
7. **A deploy isn't done until its health is actually observed.** A
   post-deploy smoke test or a health-check gate that watches error rate
   and latency for a defined window is part of the release, not a nice-to-
   have — "the deploy command exited 0" and "the service is actually
   healthy" are different claims, and conflating them is the same mistake
   `product-acceptance` refuses to make about a checker's own report.

   A gate that watches and then does nothing is theatre, so the pipeline
   states what a bad reading triggers: roll back automatically, halt the
   rollout, or page someone — one of the three, named, before the deploy
   runs. "We'll look at the dashboard" decides nothing at 3am, which is
   when the reading arrives.

8. **A running service must be operable by someone who did not build it.**
   Rule 7 says a deploy is not done until its health is observed; this is
   what makes that observation possible at all. Write `OPERATIONS.md` and
   verify it:

   ```bash
   node <this-skill>/scripts/check-operability.js --root . --strict
   ```

   It requires four sections, each of which fails when empty:

   - **Signals** — what the service emits that tells you it is healthy, and
     where that lands. Structured records with a correlation id, not
     `console.log`. If a request cannot be traced end to end, an incident
     is guesswork.
   - **Alerts** — what pages a human, at what threshold, and what the first
     response is. An alert nobody acts on trains people to ignore alerts;
     "we watch the dashboard" is not an alert.
   - **Failure modes** — the ways this specific system is known to break,
     each with the symptom you would see first. Generic advice belongs in a
     book, not a runbook.
   - **Recovery** — rollback and restart procedures, and what data is at
     risk in each. Rule 4 requires a rollback path exists; this is where it
     is written down for the person using it at 3am.

   The checker also looks for the two things a repo can actually show: a
   health or readiness endpoint, and logging that carries structure rather
   than bare prose. It reports what it could not determine rather than
   assuming; a project with no server has nothing to operate and is scoped
   out.

**Why this is the half the suite was missing.** Everything above rule 7
covers getting code into production. Nothing covered it *being* in
production — no observability, no alerting, no incident path — so the
lifecycle this suite reinforced ended at "shipped" rather than "running
well". That is half a software lifecycle, and the half where the pager
lives.
