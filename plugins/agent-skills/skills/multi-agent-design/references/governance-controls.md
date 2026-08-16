# Governance Controls

Reference material for setting limits, approval requirements, quality gates,
and audit policies in multi-agent systems.

---

## Baseline Limits

These defaults provide a safe starting point. Adjust based on task complexity
and risk tolerance, but never remove limits entirely.

| Control                | Default | Rationale                                          |
|------------------------|---------|----------------------------------------------------|
| Max concurrent agents  | 5       | Prevents resource exhaustion and makes debugging tractable. Most tasks decompose into fewer than 5 parallel subtasks. |
| Max delegation depth   | 3       | Prevents runaway recursion. Three levels (root → sub-manager → worker) handle the vast majority of problems. Deeper hierarchies usually signal over-decomposition. |
| Total token budget     | 200,000 | Caps cost at a predictable level. Sized for a substantial multi-agent task without risking runaway spending. Adjust proportionally to task scope. |
| Per-agent token budget | 50,000  | Prevents any single agent from consuming a disproportionate share of the total budget. Set to 25% of total budget as a starting point. |
| Wall-clock timeout     | 300s    | Five minutes is generous for most agent tasks. Longer timeouts risk user-abandoned sessions and wasted compute. |
| Per-agent timeout      | 120s    | Two minutes per agent. If an agent cannot complete its subtask in this window, the subtask is likely mis-scoped. |
| Max retries per agent  | 1       | One retry catches transient failures. More retries often repeat the same failure and waste budget. |
| Max total agents       | 15      | Hard ceiling across all delegation levels. Prevents combinatorial explosion in hierarchical topologies. |

### When to adjust defaults

- **Increase concurrent agents** when subtasks are genuinely independent and
  latency is the primary concern.
- **Increase delegation depth** only when the problem has a natural recursive
  structure (e.g., analyzing a deeply nested system architecture).
- **Increase token budget** for tasks involving large codebases or extensive
  document analysis.
- **Decrease timeouts** for interactive use cases where the user is waiting.
- **Never set any limit to unlimited.** Every limit must have a finite value.

---

## Failure Modes

### Worker timeout

| Aspect     | Policy                                                      |
|------------|-------------------------------------------------------------|
| Detection  | Agent exceeds its `per-agent timeout` without responding.   |
| Response   | Retry once with the same input and constraints.             |
| If retry fails | Mark subtask as failed. Escalate to the manager.       |
| Manager action | If the subtask is critical: abort or escalate to user. If non-critical: proceed without it and note the gap in the output. |

**Rationale:** A single retry catches transient issues (network hiccups, cold
starts). A second retry rarely succeeds and doubles the wasted time.

### Worker error

| Aspect     | Policy                                                      |
|------------|-------------------------------------------------------------|
| Detection  | Agent returns an error status or malformed output.          |
| For critical subtasks | Log the error. Retry once. If retry fails, block the aggregation and escalate to the manager. |
| For non-critical subtasks | Log the error. Skip the subtask. Note the omission in the final output. |
| Classification | Each delegation contract must explicitly mark whether the subtask is critical or non-critical. Default is critical. |

**Rationale:** The critical/non-critical distinction prevents a minor subtask
failure from blocking the entire system while ensuring important failures are
not silently swallowed.

### Consensus failure

| Aspect     | Policy                                                      |
|------------|-------------------------------------------------------------|
| Detection  | Peer network agents cannot converge within max rounds, or worker outputs contradict each other in manager-worker setups. |
| Response   | Escalate to the user with all competing outputs clearly presented. |
| Presentation | Show each agent's position, its evidence, and where disagreements lie. Do not pick a winner without user input. |

**Rationale:** When agents disagree, the system lacks sufficient information to
determine which is correct. Forcing a synthetic consensus risks compounding
errors. The user is the appropriate tiebreaker.

### Budget exhaustion

| Aspect     | Policy                                                      |
|------------|-------------------------------------------------------------|
| Detection  | Running token total reaches the total budget threshold.     |
| Response   | Halt all active agents. Do not start new delegations.       |
| Output     | Return all completed results as partial output. Clearly indicate which subtasks were not completed. |
| Notification | Always notify the user when budget is exhausted.          |

**Rationale:** Continuing past budget is never acceptable. The user set a
budget for a reason. Partial results with transparency are better than
unexpected costs.

### Circular delegation

| Aspect     | Policy                                                      |
|------------|-------------------------------------------------------------|
| Detection  | An agent ID appears more than once in the active delegation chain. |
| Response   | Reject the delegation immediately. Log the full chain.      |
| Recovery   | The agent that attempted the circular delegation must complete the work itself or escalate upward. |

**Rationale:** Circular delegation creates infinite loops. There is no valid
use case for it.

---

## Approval Matrix

### Actions requiring human approval

| Action Category                    | Examples                                           | Approval Required |
|------------------------------------|----------------------------------------------------|-------------------|
| Destructive actions                | File deletion, database drops, resource teardown   | Always            |
| External APIs with side effects    | Sending emails, posting to channels, creating PRs  | Always            |
| Cost-exceeding operations          | Any action pushing cost beyond allocated budget     | Always            |
| Irreversible state changes         | Production deployments, data migrations            | Always            |
| Security-sensitive operations      | Credential rotation, permission changes            | Always            |
| Large-scale modifications          | Bulk file edits (>10 files), mass data updates     | Always            |

### Actions that may proceed without approval

| Action Category                    | Examples                                           | Condition         |
|------------------------------------|----------------------------------------------------|-------------------|
| Read-only operations               | File reads, searches, API queries                  | Within budget     |
| Local computation                  | Analysis, transformation, formatting               | Within budget     |
| Artifact creation (non-deployed)   | Drafting documents, generating code locally        | Within budget     |
| Internal agent communication       | Delegation packets, status updates                 | Within limits     |

### Implementing approval gates

```yaml
approval_gate:
  action: <description of the action requiring approval>
  agent_id: <which agent is requesting>
  justification: <why this action is necessary>
  risk_assessment: <what could go wrong>
  reversibility: <reversible | irreversible | partially_reversible>
  estimated_impact: <scope of the action's effect>
  alternatives: <what could be done instead if denied>
  timeout: <how long to wait for approval before aborting>
```

The system must pause execution of the requesting agent (and any agents that
depend on its output) while waiting for approval. Other independent agents may
continue.

---

## Quality Gates

### Gate types

**Schema validation:** Verify that the agent's output conforms to the expected
structure defined in the delegation contract's `output_schema`.

```yaml
gate: schema_validation
check: output matches output_schema
on_failure: return to agent with structural feedback
max_attempts: 2
```

**Criteria check:** Verify that each success criterion in the delegation
contract is satisfied.

```yaml
gate: criteria_check
check: each success_criterion is met
on_failure: return to agent with specific unmet criteria
max_attempts: 1
```

**Completeness check:** Verify that all required fields are present and contain
meaningful content (not empty, not placeholder text).

```yaml
gate: completeness_check
check: all required fields are non-empty and substantive
on_failure: return to agent listing missing or empty fields
max_attempts: 1
```

**Consistency check:** When aggregating multiple agents' outputs, verify that
they do not contradict each other on factual claims.

```yaml
gate: consistency_check
check: no factual contradictions between agent outputs
on_failure: flag contradictions and escalate (see consensus failure)
max_attempts: 0  # contradictions require escalation, not retry
```

### Gate sequencing

Apply gates in this order:

1. Schema validation (structural correctness)
2. Completeness check (nothing missing)
3. Criteria check (meets requirements)
4. Consistency check (agrees with other outputs)

A failure at any gate stops the sequence. Fix the earliest failure first.

### Gate failure budget

Each agent gets at most 2 total gate failure retries across all gates. After
the second failure, the output is marked as failed and escalation rules apply.
This prevents infinite revision loops.

---

## Audit Requirements

### What to capture

Every multi-agent execution must produce an audit trail containing:

**Delegation records:**

```yaml
record_type: delegation
timestamp: <iso8601>
trace_id: <uuid>
delegation_id: <uuid>
from_agent: <delegator agent_id>
to_agent: <delegatee agent_id>
task_description: <what was delegated>
input_summary: <summary or hash of input data>
constraints_applied:
  token_budget: <value>
  timeout: <value>
  depth: <current / max>
```

**Completion records:**

```yaml
record_type: completion
timestamp: <iso8601>
trace_id: <uuid>
delegation_id: <uuid>
agent_id: <completing agent_id>
status: <completed | failed | partial>
output_summary: <summary or hash of output data>
tokens_used: <count>
wall_clock_ms: <duration>
quality_gates_passed: [<list of gates passed>]
quality_gates_failed: [<list of gates failed, if any>]
```

**Decision records:**

```yaml
record_type: decision
timestamp: <iso8601>
trace_id: <uuid>
agent_id: <deciding agent_id>
decision: <what was decided>
rationale: <why this decision was made>
evidence: [<list of inputs that informed the decision>]
alternatives_considered: [<other options that were rejected>]
```

**Escalation records:**

```yaml
record_type: escalation
timestamp: <iso8601>
trace_id: <uuid>
from_agent: <escalating agent_id>
to: <target agent_id or "user">
reason: <why escalation occurred>
context: <relevant state at time of escalation>
```

### Replay capability

The audit trail must contain sufficient information to replay the entire
multi-agent execution:

- All input/output pairs for every agent.
- All delegation packets as sent.
- All decisions with their inputs.
- The order of all events (via timestamps and trace IDs).

This enables debugging failures, verifying correctness, and improving future
system designs.

### Retention and access

- Audit trails are attached to the task or session that produced them.
- They must be human-readable (YAML or structured text, not binary).
- They must be queryable by trace ID, agent ID, or time range.
- Sensitive data in inputs/outputs should be flagged for appropriate handling.

---

## Governance Configuration Template

Use this template to configure governance for a specific multi-agent system:

```yaml
governance:
  limits:
    max_concurrent_agents: 5
    max_delegation_depth: 3
    total_token_budget: 200000
    per_agent_token_budget: 50000
    wall_clock_timeout_s: 300
    per_agent_timeout_s: 120
    max_retries_per_agent: 1
    max_total_agents: 15

  failure_policy:
    worker_timeout: retry_once_then_escalate
    worker_error_critical: retry_once_then_block
    worker_error_non_critical: log_and_skip
    consensus_failure: escalate_to_user
    budget_exhaustion: halt_and_return_partial
    circular_delegation: reject_immediately

  approval:
    destructive_actions: require_human
    external_side_effects: require_human
    cost_exceeding: require_human
    irreversible_changes: require_human
    security_sensitive: require_human
    large_scale_modifications: require_human
    approval_timeout_s: 600

  quality_gates:
    schema_validation: enabled
    completeness_check: enabled
    criteria_check: enabled
    consistency_check: enabled
    max_gate_retries: 2

  audit:
    delegation_records: required
    completion_records: required
    decision_records: required
    escalation_records: required
    replay_capability: required
    format: yaml
```

Adjust values to match your specific system's requirements. Document every
deviation from defaults and the rationale for the change.
