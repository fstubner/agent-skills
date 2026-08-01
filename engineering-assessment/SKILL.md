---
name: engineering-assessment
description: >-
  Evidence-first assessment of a whole codebase or system: severity-ranked
  findings, each citing a file/line or command output, plus an explicit list
  of what was NOT examined. Triggers on "audit this codebase", "engineering
  assessment", "health check", "technical evaluation", "how bad is this
  code". Not for reviewing one diff or PR (code-smells covers the structural
  layer of that), not a ship/no-ship gate (product-acceptance), and not a
  substitute for running this suite's own checkers — where they apply, run
  them and cite their reports as evidence.
---

# Engineering Assessment

Perform a rigorous, evidence-based audit of the target codebase or system.
Every finding must cite concrete evidence. Every recommendation must be
actionable. Nothing is assumed — if it was not examined, say so.

---

## Workflow

### 1. Establish Scope

Explicitly record:

- **In scope**: directories, modules, layers, concerns to examine.
- **Out of scope**: what will not be examined and why.
- **Depth**: surface scan, targeted review, or deep audit.

If the user's request is ambiguous, ask one clarifying question — no more.

### 2. Identify Domain and Platform Context

Examine the repository to determine:

- **Languages and runtimes** (e.g., TypeScript/Node, Rust, Python, C#/.NET).
- **Frameworks and libraries** (e.g., React, FastAPI, Unity, Rails).
- **Domain** (e.g., web app, CLI tool, game, data pipeline, embedded system).
- **Platform targets** (e.g., browser, server, mobile, desktop, cloud).
- **Build systems and tooling** (e.g., npm, cargo, gradle, make).

Where this suite's own checkers apply to the identified domain, run them and
cite their JSON reports as evidence rather than re-deriving what they measure:
`check-smells`/`check-organization` for structure, `check-migrations` for SQL
migration safety, `check-backend` for client-served secrets, `check-frontend`
for token/contrast issues. They are evidence sources here, not the assessment
itself — most of the areas below have no checker and rest on your reading.

### 3. Gather Evidence

Evidence comes from two sources: reading code and running tools.

#### 3a. Code Reading

Systematically examine the in-scope areas. For each area, look for:

- **Correctness**: logic errors, off-by-one, null/undefined handling, race
  conditions, resource leaks.
- **Security**: injection vectors, auth/authz gaps, secrets in code, unsafe
  deserialization, SSRF, path traversal.
- **Reliability**: error handling strategy, failure modes, retry logic,
  timeout handling, graceful degradation.
- **Performance**: algorithmic complexity, N+1 queries, unnecessary
  allocations, blocking calls in async paths, missing caching opportunities.
- **Architecture**: coupling, cohesion, dependency direction, abstraction
  leaks, circular dependencies, layering violations.
- **Maintainability**: naming clarity, code duplication, function/file size,
  test coverage gaps, documentation accuracy.
- **Data integrity**: schema validation, migration safety, backup strategy,
  transaction boundaries, idempotency.
- **Dependencies**: outdated packages, known vulnerabilities, license
  compatibility, unnecessary dependencies.

#### 3b. Run Available Checks

When available, run targeted build, test, lint, type-check, and
static-analysis commands. Typical commands to attempt (adapt to the stack):

| Check          | Common commands                                    |
| -------------- | -------------------------------------------------- |
| Build          | `npm run build`, `cargo build`, `dotnet build`     |
| Type check     | `tsc --noEmit`, `mypy .`, `pyright`                |
| Lint           | `eslint .`, `clippy`, `ruff check .`, `golint`     |
| Tests          | `npm test`, `cargo test`, `pytest`, `dotnet test`  |
| Audit          | `npm audit`, `cargo audit`, `pip-audit`            |
| Format check   | `prettier --check .`, `cargo fmt --check`          |

After running (or attempting to run) checks, record:

- **Tools run successfully**: list each with summary of output.
- **Tools that failed**: list each with error summary.
- **Tools unavailable**: list each with reason (not installed, no config, etc.).
- **Tools not attempted**: list each with reason (out of scope, not applicable).

Do not fabricate tool output. If a tool cannot be run, say so and move on.

### 4. Assess Findings

For every issue identified, assign a severity using the rubric defined in
`references/severity-rubric.md`:

| Severity     | Meaning                                                  |
| ------------ | -------------------------------------------------------- |
| **Critical** | Data loss, security breach, compliance violation risk    |
| **High**     | Significant functionality, performance, reliability risk |
| **Medium**   | Code quality, maintainability, minor reliability concern |
| **Low**      | Style, minor improvements, nice-to-haves                |
| **Info**     | Observations, positive findings, context                 |

Each finding must include:

- **Severity**: from the rubric.
- **Area**: which concern category (correctness, security, etc.).
- **Finding**: concise description of the issue.
- **Evidence**: specific file path and line number, command output snippet, or
  test result that demonstrates the issue. No exceptions.
- **Recommendation**: concrete, actionable fix or investigation step.

If a potential issue is suspected but cannot be confirmed with evidence,
list it separately under "Unconfirmed / Requires Investigation" with an
explanation of what additional information or access is needed.

### 5. Produce Findings Table

Present all confirmed findings in a single table, sorted by severity
(Critical first), then by area:

| # | Severity | Area         | Finding              | Evidence                  | Recommendation              |
|---|----------|--------------|----------------------|---------------------------|-----------------------------|
| 1 | Critical | Security     | SQL injection in ... | `src/db.ts:42` — raw ...  | Use parameterized queries.  |
| 2 | High     | Reliability  | Unhandled rejection  | `src/api.ts:87` — ...     | Add `.catch()` or ...       |
| 3 | Medium   | Architecture | Circular dependency  | `A -> B -> C -> A` ...    | Extract shared types to ... |

If the number of findings is large (>20), group by severity with sub-tables
or use collapsible sections.

### 6. Summarize

Provide a concise summary with these sections:

#### Strengths

What the codebase does well. Cite evidence (well-structured modules, good test
coverage in area X, effective use of pattern Y). Minimum two items if the
codebase has any merit.

#### Key Risks

The most important issues requiring attention. Reference findings by number
from the table. Group related findings.

#### Priority Order

A numbered list of recommended actions in priority order, considering:

1. Severity (critical before high before medium).
2. Blast radius (issues affecting many users/paths first).
3. Fix effort (quick wins with high impact first, when severity is equal).
4. Dependencies (foundational fixes before dependent ones).

#### Coverage Gaps

Explicitly list what was **not** examined and **could not** be checked:

- Areas of the codebase that were out of scope.
- Tools that could not be run and what they would have revealed.
- Types of testing not performed (e.g., load testing, penetration testing).
- Information that was unavailable (e.g., production metrics, deployment config).

---

## Non-Negotiables

These rules apply to every assessment without exception:

1. **Every finding must cite specific evidence.** File path and line number,
   command output, or test result. "The code could be improved" is never
   acceptable — state exactly where and what.

2. **No generic advice.** Every recommendation must reference the actual
   codebase. Do not suggest "consider using TypeScript" if the project is
   already in TypeScript. Do not recommend "add tests" without specifying
   which untested paths matter most and why.

3. **Explicitly state what was not examined.** An assessment that is silent
   about its gaps is misleading. Always include the Coverage Gaps section.

4. **Severity ratings must use the rubric consistently.** A finding is not
   Critical just because it is important to the reviewer. Apply the definitions
   from the severity rubric without inflation or deflation.

5. **Distinguish confirmed from suspected.** If evidence is indirect or
   ambiguous, do not present the finding as confirmed. Use the "Unconfirmed"
   section.

6. **Run what you can.** If build/test/lint commands are available, run them.
   Do not skip automated checks out of convenience.

7. **Stay within scope.** Do not expand the assessment beyond what was agreed
   in Step 1 without noting that you are doing so and why.

---

## Output Format

The final deliverable must include all of these sections in order:

1. **Scope** — what was examined, at what depth, and what was excluded.
2. **Environment** — languages, frameworks, tools identified; overlays loaded.
3. **Tooling Results** — which automated checks were run and their outcomes.
4. **Findings Table** — the complete findings table from Step 5.
5. **Unconfirmed Issues** — suspected issues lacking definitive evidence (if any).
6. **Summary** — strengths, key risks, priority order, coverage gaps.

Adjust heading levels to fit the context (standalone document vs. conversation
response), but do not omit any section.
