# Severity Rubric

Use these definitions to assign severity to every finding in an engineering
assessment. Apply them consistently — do not inflate or deflate ratings based
on subjective importance.

---

## Critical

**Definition**: Issues that risk data loss, security breach, or compliance
violation. These represent active or near-certain threats to users, data, or
legal standing.

**Release impact**: Blocks release. Must be resolved before any deployment.

**Examples**:

- SQL injection, XSS, or other injection vulnerabilities with a reachable
  attack vector.
- Plaintext storage of passwords, tokens, or secrets.
- Missing authentication or authorization on sensitive endpoints.
- Data corruption or silent data loss under normal usage paths.
- Violation of regulatory requirements (GDPR, HIPAA, PCI-DSS, etc.).
- Cryptographic misuse (weak algorithms, hardcoded keys, broken randomness).
- Remote code execution vectors.

**Evidence standard**: Must demonstrate a concrete path to exploitation or
data loss. Cite the specific code path, input vector, or failure mode.

---

## High

**Definition**: Significant issues affecting functionality, performance, or
reliability that will impact users or operations in production.

**Release impact**: Should block release. Acceptable only with documented
risk acceptance and a committed remediation timeline.

**Examples**:

- Core feature that fails under common usage patterns.
- Performance degradation that renders a feature unusable (e.g., O(n^2) on
  a dataset that routinely reaches 10k+ items).
- Unhandled errors that crash the process or leave it in a broken state.
- Resource leaks (memory, file handles, connections) under sustained load.
- Race conditions in concurrent code paths that handle user data.
- Missing error handling on external service calls in critical paths.
- Broken database migrations that cannot be rolled back.
- Dependency with a known, exploitable CVE (where the vulnerable code path
  is actually used).

**Evidence standard**: Must show the failure mode and explain the conditions
under which it occurs. Cite file, line, and the logic that leads to failure.

---

## Medium

**Definition**: Code quality, maintainability, or minor reliability concerns
that increase the cost of future development or carry a low-probability risk
to users.

**Release impact**: Should be fixed before the next milestone. Does not block
the current release unless multiple Medium findings compound into a systemic
issue.

**Examples**:

- Significant code duplication across multiple modules.
- Missing input validation on non-security-critical paths.
- Inconsistent error handling strategy across the codebase.
- Test coverage gaps on important (but not critical) business logic.
- Overly complex functions that are difficult to understand or modify
  (high cyclomatic complexity).
- Circular dependencies between modules.
- Outdated dependencies with no known vulnerabilities but missing important
  bug fixes.
- Missing or misleading documentation on public APIs.
- Hardcoded configuration values that should be externalized.
- Fragile test patterns (tests that depend on execution order, timing, or
  external state).

**Evidence standard**: Must cite specific locations and explain the impact on
maintainability, reliability, or developer productivity. Quantify where
possible (e.g., "duplicated across 4 files totaling 200 lines").

---

## Low

**Definition**: Style issues, minor improvements, and nice-to-have
enhancements. These do not affect correctness, security, or reliability but
improve code quality when addressed.

**Release impact**: Address at convenience. Suitable for backlog grooming or
opportunistic improvement during related work.

**Examples**:

- Naming inconsistencies (e.g., mixed `camelCase` and `snake_case` in the
  same module without language convention justification).
- Minor code style deviations from project conventions.
- TODO/FIXME/HACK comments that reference resolved issues.
- Unnecessary type assertions where inference is sufficient.
- Import ordering inconsistencies.
- Slightly verbose code that could be simplified without changing behavior.
- Missing JSDoc/docstring on internal helper functions.
- Dead code that is clearly unreachable but small in scope.

**Evidence standard**: Cite specific locations. Explain what the convention
or improvement is and why it matters (even if only slightly).

---

## Info

**Definition**: Observations, positive findings, and contextual notes that
do not require action but provide useful information for understanding the
codebase.

**Release impact**: None. These are informational only.

**Examples**:

- Well-implemented patterns worth noting (e.g., "The error handling in
  `src/api/client.ts` follows a consistent Result pattern that works well").
- Architectural decisions that are sound and well-executed.
- Areas where test coverage is notably thorough.
- Context that explains why something was done a certain way (discovered
  via commit history or comments).
- Metrics and statistics about the codebase (file counts, dependency counts,
  line counts) that provide context.
- Observations about the development workflow (CI config, commit patterns,
  branch strategy) that are relevant but not findings.

**Evidence standard**: Cite what was observed. For positive findings, be
specific about what makes them good — this helps the team understand and
preserve their strengths.

---

## Applying the Rubric

When assigning severity, consider these principles:

1. **Use the definitions, not gut feeling.** If a finding matches the
   Critical definition, it is Critical — even if it feels minor. If it
   does not match, it is not Critical — even if it feels important.

2. **Consider the actual impact path.** A theoretical vulnerability behind
   three layers of authentication is not the same severity as one on a
   public endpoint. Assess the realistic path to harm.

3. **Do not anchor on count.** Having many Medium findings does not make
   any individual one High. However, a pattern of Medium findings in the
   same area may indicate a systemic issue worth noting in the summary.

4. **When in doubt between two levels, choose the lower one** and explain
   the factors that could elevate it. This prevents severity inflation
   and keeps the rubric trustworthy.

5. **Positive findings deserve the same rigor as problems.** An Info-level
   strength observation should cite evidence just as thoroughly as a
   Critical finding.
