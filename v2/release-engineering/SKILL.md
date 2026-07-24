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

No shared artifacts, no checker script — pipeline and deployment config is
too platform-specific (GitHub Actions, GitLab CI, a cloud provider's own
deploy tooling) for one generic check; the rules below are what to verify
by eye regardless of platform.

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
   discovered during an incident.** If reverting takes longer than the
   original deploy, or requires a human to remember non-obvious manual
   steps, the release process is incomplete regardless of how good the
   forward path is. Blue-green (two full environments, swap traffic) and
   canary (shift a small percentage of traffic first) both exist
   specifically to make "stop, this is bad" fast and cheap — pick based on
   whether the risk is "this build is broken" (blue-green: swap back
   instantly) or "this build is subtly wrong under real traffic" (canary:
   catch it before it's fully rolled out).
5. **Decouple deploying code from releasing behavior.** A feature flag lets
   a bad change be turned off in seconds without a rollback or a redeploy —
   the code shipped, but the behavior didn't activate for anyone until the
   flag flips. Reserve this for changes risky or reversible enough to be
   worth the flag's own complexity; not every change needs one.
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
