# Boundaries: decision procedure

## When is a project multi-part?

Client + server, more than one deployable, more than one workspace, or any
edge where data crosses a trust change. If none of these hold, skip this
skill — a single-part project needs no ARCHITECTURE.md.

## Procedure

1. **List parts from what exists**, not from what you'd like. A part is a
   thing that runs (process, function host, static bundle), not a folder.
2. **Draw every edge.** For each pair of parts that communicate: transport,
   payload shape, direction, and frequency. Each of those four fields holds
   exactly one value — if any needs an "and" (two transports, both
   directions, two payload shapes), it is two edges and gets two entries.
   That is the checkable form of "an edge you can't describe in one line is
   two edges pretending to be one"; sentence length was never the real test.
3. **Assign trust per edge.** The side that owns the data validates. The
   client is always untrusted — even "our own" client, because anything can
   speak HTTP.
4. **Place secrets.** Name the exact part and mechanism (env var, secret
   store). A secret whose location you can't name is a finding.
5. **Prefer boring.** Request/response over queues until volume proves
   otherwise; one database until a second owner proves otherwise. "Proves
   otherwise" is a number or a name, written down: the request rate or
   burst shape that needs the queue, the second team or service that owns
   the other database. ARCHITECTURE.md states it, or states `none yet —
   using request/response`. Anything can be justified after the fact; a
   figure recorded before the fact can be wrong, which is the point.

## Anti-patterns

- **Trust by origin** — "it came from our frontend" is not authentication.
- **Validation confetti** — checks scattered through layers instead of at
  the boundary; nobody knows which one is load-bearing.
- **Part inflation** — microservices at MVP scope. Every extra part costs an
  edge, a deploy, and a failure mode.
- **Implicit fourth part** — a cron job, webhook receiver, or "little
  script" that runs in production but appears nowhere in Parts.
