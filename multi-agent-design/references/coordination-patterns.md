# Coordination Patterns

Reference material for multi-agent topology selection and implementation.

---

## Topology Overview

| Topology       | Structure              | Best For                                    |
|----------------|------------------------|---------------------------------------------|
| Manager-Worker | Star (hub and spoke)   | Decomposable tasks with clear subtask bounds |
| Pipeline       | Linear chain           | Sequential transformation chains, ETL        |
| Peer Network   | Mesh (fully connected) | Collaborative tasks with shared context       |
| Hierarchical   | Tree (multi-level)     | Complex problems requiring sub-decomposition  |

---

## Manager-Worker

### When to use

- The task can be decomposed into independent or loosely coupled subtasks.
- Each subtask requires specialized knowledge or tools.
- Subtask results can be aggregated into a coherent final output.
- The number of subtasks is known or bounded at delegation time.

### Structure

```
                 ┌──────────┐
                 │ Manager  │
                 └────┬─────┘
            ┌─────────┼─────────┐
            v         v         v
       ┌────────┐ ┌────────┐ ┌────────┐
       │Worker A│ │Worker B│ │Worker C│
       └────────┘ └────────┘ └────────┘
```

The manager decomposes the problem, delegates subtasks, collects results, and
synthesizes the final output.

### Delegation packet format

```yaml
delegation_id: <uuid>
trace_id: <parent trace uuid>
from_agent: <manager agent_id>
to_agent: <worker agent_id>
task:
  description: <clear, specific description of what to do>
  input: <structured input data>
  output_schema: <what the response must look like>
  success_criteria:
    - <criterion 1>
    - <criterion 2>
constraints:
  max_tokens: <budget>
  max_wall_clock_ms: <timeout>
  allowed_tools: [<tool list>]
  forbidden_actions: [<action list>]
priority: <high | medium | low>
deadline: <iso8601 timestamp>
```

### Worker response format

```yaml
delegation_id: <uuid matching the delegation>
agent_id: <worker agent_id>
status: <completed | failed | partial>
output:
  result: <the actual output matching output_schema>
  confidence: <high | medium | low>
  caveats: [<any limitations or uncertainties>]
metadata:
  tokens_used: <count>
  wall_clock_ms: <duration>
  tools_used: [<tool list>]
error: <null or error description if status is failed>
```

### Aggregation pattern

1. Collect all worker responses.
2. Validate each response against the delegation's success criteria.
3. For failed responses, apply the escalation rule (retry, skip, or abort).
4. Synthesize passing responses into the final output.
5. The synthesis must reference specific worker outputs — no hallucinated
   additions.

### Escalation rules

- **Worker timeout:** Retry once with the same input. If the retry times out,
  mark the subtask as failed and decide whether to proceed without it (if
  non-critical) or abort (if critical).
- **Worker error:** Log the error with full context. If the subtask is critical,
  attempt one retry. If it fails again, escalate to the user.
- **Quality gate failure:** Return the output to the worker with specific
  feedback on what failed. Allow one revision attempt.
- **Budget exhaustion:** Do not retry. Mark as failed and report to the user
  with partial results.

---

## Pipeline

### When to use

- Work must flow in a strict sequence where each stage transforms the previous
  stage's output.
- Stages have distinct responsibilities (e.g., extract, transform, validate,
  format).
- The output of one stage is the sole input to the next.
- Backtracking is rare or unnecessary.

### Structure

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Stage 1 │───>│ Stage 2 │───>│ Stage 3 │───>│ Stage 4 │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

Each stage receives input from the previous stage, processes it, and passes
its output forward.

### Delegation packet format

```yaml
pipeline_id: <uuid>
trace_id: <parent trace uuid>
stage_number: <integer, 1-indexed>
total_stages: <integer>
from_stage: <previous stage agent_id or "pipeline_start">
to_stage: <this stage agent_id>
task:
  description: <what this stage must do to the input>
  input: <output from previous stage>
  output_schema: <expected output format for next stage>
  success_criteria:
    - <criterion 1>
  validation: <how to verify output before passing downstream>
constraints:
  max_tokens: <budget>
  max_wall_clock_ms: <timeout>
```

### Worker response format

Same as Manager-Worker response format, with an additional field:

```yaml
pass_downstream: <true | false>
# If false, the pipeline halts at this stage.
```

### Aggregation pattern

Pipelines do not aggregate in the traditional sense. Instead:

1. Each stage validates its own output against success criteria.
2. The validated output becomes the input to the next stage.
3. The final stage's output is the pipeline's output.
4. An orchestrator monitors progress and handles failures.

### Escalation rules

- **Stage failure:** The pipeline halts. The orchestrator decides whether to
  retry the failed stage, skip it (if the pipeline can tolerate gaps), or abort.
- **Stage timeout:** Retry once. If the retry times out, abort the pipeline.
- **Validation failure between stages:** Return to the failed stage with
  feedback. Allow one revision. If revision fails, abort.
- **Pipeline-level timeout:** Abort all remaining stages. Return the last
  successfully completed output as a partial result.

---

## Peer Network

### When to use

- Agents must collaborate on a shared artifact or negotiate a consensus.
- No single agent has the full context needed to complete the task.
- Agents need to iterate and refine each other's work.
- The task requires debate, review, or multi-perspective analysis.

### Structure

```
┌─────────┐ <───> ┌─────────┐
│ Agent A │       │ Agent B │
└────┬────┘       └────┬────┘
     │                 │
     └──────┬──────────┘
            v
       ┌─────────┐
       │ Agent C │
       └─────────┘
```

Agents communicate directly with each other. A lightweight coordinator may
exist to manage turn-taking and convergence detection.

### Delegation packet format

In peer networks, the concept shifts from "delegation" to "message passing":

```yaml
message_id: <uuid>
trace_id: <shared trace uuid>
from_agent: <sender agent_id>
to_agent: <recipient agent_id or "broadcast">
round: <iteration number>
message_type: <proposal | critique | revision | agreement | escalation>
content:
  artifact: <the shared work product or fragment>
  commentary: <explanation, feedback, or rationale>
  action_requested: <what the sender wants the recipient to do>
constraints:
  max_rounds: <hard cap on iteration count>
  convergence_threshold: <when to stop iterating>
```

### Worker response format

```yaml
message_id: <uuid, new>
in_reply_to: <uuid of the message being responded to>
agent_id: <responder agent_id>
round: <current round number>
message_type: <proposal | critique | revision | agreement | escalation>
content:
  artifact: <updated work product>
  commentary: <rationale for changes>
  agreement_status: <agree | disagree | conditional>
  conditions: [<conditions for agreement, if conditional>]
```

### Aggregation pattern

1. A coordinator monitors message exchanges.
2. After each round, check for convergence (all agents agree, or the
   convergence threshold is met).
3. If converged, extract the final artifact.
4. If max rounds reached without convergence, escalate to the user with
   the competing proposals.

### Escalation rules

- **Convergence failure:** After max rounds, present all competing proposals
  to the user and ask for a decision.
- **Agent timeout:** Remove the timed-out agent from the network. If the
  remaining agents can converge, continue. Otherwise escalate.
- **Hostile loop:** If two agents are repeating the same arguments without
  progress (detected by semantic similarity of consecutive messages), force
  escalation.
- **Budget exhaustion:** Freeze the current state and present the best
  available artifact to the user.

---

## Hierarchical

### When to use

- The problem is too complex for a single manager to decompose into leaf-level
  tasks directly.
- Sub-problems themselves require decomposition.
- Different levels of the hierarchy require different expertise.
- The organization mirrors a natural problem structure (e.g., system →
  subsystem → component).

### Structure

```
              ┌──────────────┐
              │ Root Manager │
              └──────┬───────┘
           ┌─────────┼─────────┐
           v                   v
    ┌────────────┐      ┌────────────┐
    │ Sub-Mgr A  │      │ Sub-Mgr B  │
    └─────┬──────┘      └─────┬──────┘
     ┌────┼────┐         ┌────┼────┐
     v    v    v         v    v    v
    [W1] [W2] [W3]     [W4] [W5] [W6]
```

Each level decomposes its task further, until leaf workers execute concrete
subtasks.

### Delegation packet format

Same as Manager-Worker, with additional hierarchy metadata:

```yaml
delegation_depth: <integer, 0 = root>
max_delegation_depth: <hard limit>
parent_delegation_id: <uuid of the delegation that created this manager>
subtree_budget:
  max_tokens: <total budget for this subtree>
  max_agents: <max agents this manager may create>
  max_wall_clock_ms: <time budget for this subtree>
```

### Worker response format

Same as Manager-Worker. Sub-managers return an aggregated result that looks
identical to a worker response from the parent's perspective.

### Aggregation pattern

1. Each sub-manager aggregates its workers' outputs using the Manager-Worker
   aggregation pattern.
2. The sub-manager's aggregated output becomes its response to its parent.
3. The root manager aggregates sub-manager responses into the final output.
4. At every level, quality gates apply before the aggregated output is passed
   upward.

### Escalation rules

- **Escalation flows upward.** A worker escalates to its sub-manager. A
  sub-manager escalates to its parent manager. The root manager escalates to
  the user.
- **No skip-level escalation.** Workers do not escalate directly to the root
  manager. Each level must handle or explicitly pass up.
- **Depth limit enforcement.** If an agent attempts to delegate and would
  exceed `max_delegation_depth`, the delegation is rejected. The agent must
  complete the work itself or escalate.
- **Subtree budget enforcement.** Each sub-manager must stay within its
  allocated subtree budget. If the budget is exhausted, the sub-manager returns
  partial results and escalates.

---

## Topology Selection Checklist

Use this checklist to select the right topology:

```
[ ] Are subtasks independent?
    Yes → Manager-Worker or Hierarchical
    No  → Pipeline or Peer Network

[ ] Is there a strict ordering requirement?
    Yes → Pipeline
    No  → Continue

[ ] Do agents need to iterate on shared work?
    Yes → Peer Network
    No  → Manager-Worker

[ ] Does the problem decompose recursively?
    Yes → Hierarchical
    No  → Manager-Worker

[ ] Is the number of subtasks small (< 5)?
    Yes → Manager-Worker
    No  → Consider Hierarchical to manage complexity
```

---

## Hybrid Topologies

Real systems often combine patterns:

- **Pipeline of Manager-Workers:** Each pipeline stage is a Manager-Worker
  cluster. Use when each transformation step itself requires parallel work.
- **Hierarchical with Peer Review:** Leaf workers in a hierarchy use Peer
  Network to review each other's outputs before reporting upward.
- **Manager-Worker with Pipeline Workers:** A manager delegates to workers,
  but each worker internally runs a pipeline.

When using hybrid topologies, apply governance controls at every boundary.
Each sub-pattern must respect the global limits (delegation depth, token
budget, concurrent agents) while also having its own local limits.
