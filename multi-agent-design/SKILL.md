---
name: multi-agent-design
description: >-
  Design multi-agent systems: whether multi-agent is justified at all
  (default: it is not), topology selection, delegation contracts, governance
  limits, and failure recovery. Triggers on "multi-agent system", "agent
  orchestration", "agent team design", "subagent architecture", "fan out
  agents". Not for designing the parts/boundaries of an ordinary
  multi-service system (systems-architecture) and not for single-agent
  prompt design — its first step is asking whether you need more than one
  agent, and the honest answer is usually no.
---

# Multi-Agent Design

## Purpose

Design, structure, and govern multi-agent systems. This skill covers the full
lifecycle: deciding whether multi-agent is appropriate, selecting a topology,
defining delegation contracts, setting governance limits, and planning failure
recovery.

---

## Step 1 — Evaluate Whether Multi-Agent Is Appropriate

Before designing an agent team, answer these questions honestly:

1. **Can a single agent complete the task?** If yes, use one agent. Multi-agent
   adds coordination overhead that is only justified when the task genuinely
   requires parallel specialization, separation of concerns, or scale beyond a
   single context window.
2. **Are there distinct subtasks with different expertise requirements?** If the
   work is homogeneous, multiple agents add cost without benefit.
3. **Is there a meaningful decomposition boundary?** If subtasks are tightly
   coupled with constant cross-references, a single agent with a structured
   prompt often outperforms a team.
4. **Does the task require parallel execution for time or cost reasons?**
   Parallelism is a valid reason only when subtasks are genuinely independent.

**Decision rule:** Default to a single agent. Escalate to multi-agent only when
you can name the specific benefit (specialization, parallelism, context
isolation) and that benefit outweighs coordination cost.

---

## Step 2 — Design Agent Topology

Select a topology from `references/coordination-patterns.md`. The four primary
topologies are:

| Topology       | Best For                                     |
|----------------|----------------------------------------------|
| Manager-Worker | Decomposable tasks with clear subtask bounds  |
| Pipeline       | Sequential transformation chains              |
| Peer Network   | Collaborative tasks with shared context       |
| Hierarchical   | Complex problems requiring sub-decomposition  |

For each topology the reference file defines: when to use it, delegation packet
format, worker response format, aggregation pattern, and escalation rules.

### Topology selection criteria

- **Subtask independence high, shared state low** → Manager-Worker
- **Strict ordering required, each stage transforms prior output** → Pipeline
- **Agents must negotiate or iterate on shared artifacts** → Peer Network
- **Problem decomposes recursively into sub-problems** → Hierarchical

Document your choice and the rationale.

---

## Step 3 — Define Delegation Contracts

Every agent in the system must have an explicit delegation contract. A
delegation contract is the formal specification of what an agent is asked to do,
what it must return, and how its output will be judged.

### Contract fields

```yaml
agent_id: <unique identifier>
role: <one-line description of the agent's responsibility>
input_spec:
  description: <what the agent receives>
  schema: <structured format or free-text description>
output_spec:
  description: <what the agent must return>
  schema: <structured format or free-text description>
success_criteria:
  - <measurable criterion 1>
  - <measurable criterion 2>
failure_criteria:
  - <condition that means the agent has failed>
constraints:
  max_tokens: <token budget for this agent>
  max_wall_clock: <time limit>
  allowed_tools: <list of tools this agent may use>
  forbidden_actions: <list of actions this agent must never take>
escalation:
  on_failure: <action: retry | skip | escalate | abort>
  on_ambiguity: <action: ask_manager | use_default | escalate_to_user>
```

### Contract rules

- Every agent MUST have explicit success criteria. "Do your best" is not a
  success criterion.
- Every agent MUST have explicit failure criteria so the system knows when to
  stop retrying.
- Input and output schemas should be as precise as possible. Vague handoffs
  cause cascading failures.
- Constraints must include at least a token budget and a wall-clock timeout.
- Escalation behavior must be defined for both failure and ambiguity.

---

## Step 4 — Set Governance Controls

Apply governance controls from `references/governance-controls.md`. At minimum,
configure:

### Execution policy

| Control                | Purpose                                    |
|------------------------|--------------------------------------------|
| Max concurrent agents  | Prevent resource exhaustion                |
| Max delegation depth   | Prevent runaway recursion                  |
| Total token budget     | Cap cost                                   |
| Total wall-clock limit | Prevent indefinite execution               |
| Per-agent token budget | Prevent any single agent from dominating   |

### Approval controls

Certain actions require human approval before execution:

- **Destructive actions**: file deletion, database mutations, deployment
- **External API calls with side effects**: sending emails, posting messages,
  creating resources in third-party systems
- **Cost-exceeding operations**: any action that would push total cost beyond
  the allocated budget
- **Irreversible actions**: anything that cannot be undone

**Non-negotiable:** Human approval gates must exist for all irreversible
actions. No agent may bypass this requirement regardless of delegation depth.

### Quality gates

Each worker's output must be validated against its delegation contract's success
criteria before the output is accepted for aggregation. Validation approaches:

- **Schema validation**: Does the output match the expected structure?
- **Criteria check**: Does the output satisfy every listed success criterion?
- **Completeness check**: Are all required fields present and non-empty?
- **Consistency check**: Does the output contradict other agents' outputs?

Failed quality gates trigger the escalation path defined in the contract.

### Audit requirements

- Full trace of the delegation chain (who delegated to whom, with what input)
- Decision rationale at each delegation level
- Input/output pairs for every agent (enables replay and debugging)
- Timestamps for all delegation and completion events
- Cost accounting per agent

---

## Step 5 — Define Failure Modes and Recovery

### Standard failure modes

| Failure Mode       | Default Response                                     |
|--------------------|------------------------------------------------------|
| Worker timeout     | Retry once with same input, then escalate to manager |
| Worker error       | Log error; skip if non-critical, block if critical   |
| Consensus failure  | Escalate to user with competing outputs              |
| Budget exhaustion  | Abort gracefully, return partial results with status  |
| Circular reference | Detect and abort immediately                         |

### Recovery strategy template

For each identified failure mode, document:

```yaml
failure_mode: <name>
detection: <how the system detects this failure>
immediate_action: <what happens when detected>
recovery_steps:
  - <step 1>
  - <step 2>
fallback: <what to do if recovery fails>
user_notification: <when and how to inform the user>
```

### Failure playbook

Create a failure playbook that maps every failure mode to a concrete recovery
path. The playbook must answer:

1. What triggered the failure?
2. Which agent(s) are affected?
3. What is the blast radius (does this block other agents)?
4. What is the recovery action?
5. What is the fallback if recovery fails?
6. Does the user need to be notified?

---

## Step 6 — Produce Outputs

The final deliverable for a multi-agent design is:

### 1. Topology diagram

A text-based diagram showing agents, delegation relationships, and data flow.
Use a simple box-and-arrow format:

```
[Manager] --delegates--> [Worker-A]
[Manager] --delegates--> [Worker-B]
[Worker-A] --returns-->  [Manager]
[Worker-B] --returns-->  [Manager]
[Manager] --aggregates--> [Final Output]
```

### 2. Delegation specifications

The complete set of delegation contracts (Step 3) for every agent.

### 3. Governance configuration

The populated governance controls (Step 4) with all limits, approval rules,
quality gates, and audit settings.

### 4. Failure playbook

The complete failure playbook (Step 5) covering every identified failure mode.

---

## Observability

Design observability into the system from the start, not as an afterthought.

### Required observability

- **Delegation trace**: A unique trace ID propagated through the entire
  delegation chain. Every log entry includes this trace ID.
- **Agent status**: Each agent reports its current status (idle, working,
  waiting, completed, failed) at regular intervals.
- **Progress metrics**: Each agent reports progress against its success criteria
  where measurable.
- **Cost tracking**: Running total of tokens consumed and estimated cost,
  updated after each agent completes.
- **Timing data**: Wall-clock time per agent, time spent waiting for
  dependencies, total elapsed time.

### Observability format

```yaml
trace_id: <uuid>
agent_id: <id>
timestamp: <iso8601>
event_type: <delegated | started | progress | completed | failed | escalated>
payload:
  status: <current status>
  tokens_used: <count>
  wall_clock_ms: <milliseconds>
  progress: <percentage or milestone>
  message: <human-readable description>
```

---

## Anti-Patterns

Avoid these common multi-agent design failures:

### Circular delegation

**Problem:** Agent A delegates to Agent B, which delegates back to Agent A
(directly or through a chain).

**Detection:** Track the delegation chain. If any agent ID appears twice in the
chain, circular delegation has occurred.

**Prevention:** Enforce a strict DAG (directed acyclic graph) constraint on
delegation. No agent may delegate to an ancestor in its delegation chain.

### Unbounded fan-out

**Problem:** A manager creates an unlimited number of workers, exhausting
resources or budget.

**Detection:** Monitor the count of active agents against the max concurrent
agents limit.

**Prevention:** Set a hard cap on concurrent agents. Require managers to batch
work if the natural decomposition exceeds the cap. Never allow dynamic agent
creation without a ceiling.

### Deadlocked joins

**Problem:** Two or more agents are each waiting for the other's output before
they can proceed.

**Detection:** Build a dependency graph of agent wait conditions. If the graph
contains a cycle, deadlock exists.

**Prevention:** Define a clear execution order. If mutual dependencies exist,
restructure the topology: either merge the agents, introduce an intermediary,
or break the dependency with a preliminary estimation step.

### Manager decisions without child evidence

**Problem:** A manager agent makes decisions or produces outputs that are not
grounded in the actual outputs of its workers. The manager hallucinates a
synthesis instead of aggregating real results.

**Detection:** Verify that every claim in the manager's output traces to a
specific worker output.

**Prevention:** Require managers to quote or reference specific worker outputs
in their aggregation. The aggregation prompt should explicitly instruct: "Base
your synthesis only on the worker outputs provided. Do not add information that
no worker produced."

---

## Non-Negotiables

These rules apply to every multi-agent design regardless of context:

1. **Always evaluate whether multi-agent is actually needed.** Default to a
   single agent unless multi-agent provides a specific, named benefit.
2. **Never allow unbounded fan-out.** Every manager must have a hard cap on
   the number of workers it can create.
3. **Never allow recursive delegation without depth limits.** Every system
   must have a maximum delegation depth. The default is 3 levels.
4. **Every agent must have explicit success and failure criteria** in its
   delegation contract. No exceptions.
5. **Human approval gates for irreversible actions.** No agent may perform
   destructive, costly, or irreversible actions without human confirmation.

---

## Quick Reference

```
1. Is multi-agent needed?          → Step 1 (evaluate)
2. Which topology?                 → Step 2 + coordination-patterns.md
3. What does each agent do?        → Step 3 (delegation contracts)
4. What are the limits?            → Step 4 + governance-controls.md
5. What can go wrong?              → Step 5 (failure playbook)
6. Package the design              → Step 6 (outputs)
```
