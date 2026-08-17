# Non-relational and graph modeling

Use this when the persisted model is not purely relational. These are review
questions and required evidence, not mechanically verified checks. The raw-SQL
checker evaluates none of them.

## Design record

Record these before choosing a database family:

```text
Reads: <access patterns, including required sort and traversal>
Writes: <mutations and contention pattern>
Atomicity boundary: <facts that must change together>
Consistency: <strong, causal, eventual, or mixed — and where>
Scale: <cardinality, growth rate, largest item/partition/node degree>
Invariant: <what the database, rather than every caller, must enforce>
```

If a line is unknown, say `unknown` and name how it will be measured. Do not
invent a number to make the model look decided.

## Document databases

- Embed when the child is read and written with one parent, shares its
  lifecycle, and has a bounded maximum size. Reference when it has its own
  identity, is shared, changes independently, or can grow without a bound.
- Name the owner of every duplicated fact and the mechanism that updates or
  repairs copies. Flexible shape is not permission for incompatible meanings
  under one field name.
- Every document carries a schema version when old and new shapes may coexist.
  Readers tolerate both versions throughout the migration; the backfill is
  resumable and idempotent before old-shape support is removed.
- Failure test: one parent accumulating an unbounded embedded array, or two
  independently writable copies of the same fact, blocks the design.

MongoDB's own guidance makes query use and schema versioning first-class
design inputs: <https://www.mongodb.com/docs/manual/data-modeling/design-patterns/>.

## Key-value and wide-column databases

- Start from the reads and writes. For each access pattern, name the full key,
  whether it is a point lookup or bounded range, and which index or table
  serves it. A production path requiring an unbounded scan blocks the design.
- Record expected cardinality and traffic distribution for each partition
  key. A clock value, tenant with extreme skew, or other low-cardinality hot
  key needs sharding or a different key before launch.
- Bound item, row, and partition growth. Name the retention or bucketing rule
  for time-series and append-heavy workloads.
- Duplicating data for query locality is allowed only when the design names the
  authoritative copy, update fan-out, retry/idempotency behavior, and repair
  process for partial failure.
- State the consistency level for each invariant. Do not implement uniqueness
  or compare-and-set semantics with an eventually consistent read followed by
  an unconditional write.

DynamoDB documents that partition-key values determine distribution and should
have enough distinct values for even load:
<https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.Partitions.html>.
Cassandra documents that performant queries supply the partition key and that
partition design determines locality and hotspots:
<https://cassandra.apache.org/doc/latest/cassandra/architecture/overview.html>.

## Property graph databases

- A node represents an independently identifiable thing. A relationship
  represents a domain fact connecting two nodes. Do not replace either with a
  property merely to avoid modeling the domain, and do not create a node for a
  scalar that has no independent identity or relationships.
- Name every relationship's direction and meaning in one sentence. Record
  whether the reverse traversal is valid; query syntax being able to ignore
  direction does not make the domain symmetric.
- Give long-lived nodes stable keys and enforce required uniqueness, existence,
  or type constraints where the database supports them. Create indexes for
  selective traversal starting points and verify plans on representative data.
- Give each critical traversal a budget: starting-node cardinality, relationship
  types, maximum hops, expected fan-out, and result limit. An unrestricted
  variable-length traversal on user-controlled input blocks the design.
- Measure maximum and percentile node degree for relationship types that can
  form supernodes. State the partitioning, time-bucketing, intermediate-node,
  or query strategy that keeps fan-out bounded.
- Graph migrations are additive-first too: add labels, relationship types, or
  properties; dual-read old and new shapes; backfill idempotently; validate
  counts and invariants; then stop writing and finally remove the old shape.
  A single rewrite that assumes every application instance changes at once is
  not safe.
- Parameterize query values. Dynamic labels or relationship types require an
  allowlist or supported identifier mechanism; concatenating untrusted input
  into Cypher is an injection path.

Neo4j's schema guidance documents indexes plus uniqueness, existence, type, and
key constraints:
<https://neo4j.com/docs/getting-started/cypher/schema/>. Its Cypher model treats
nodes and directed relationships as distinct modeling primitives:
<https://neo4j.com/docs/getting-started/cypher/>.

## Review outcome

The review ends with one of:

- `supported` — every relevant line above has evidence;
- `conditional` — unknown scale or consistency assumptions are named with a
  measurement plan; or
- `blocked` — an unbounded scan/traversal/partition, unenforced invariant, or
  non-migratable shape remains.
