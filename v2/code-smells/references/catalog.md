# Smell catalog

Naming and grouping follow Fowler & Beck's *Refactoring* (the standard term
of art for this vocabulary), described here in this suite's own words with
this suite's own examples — not reproduced from the book.

## Bloaters (something has grown past what it can carry)

### Duplicated code
The same logic exists in two or more places instead of one, and they will
drift — a bug fixed in one copy stays broken in the other.
- **Fix:** extract the shared logic to one place both call. If the
  duplication is only superficially similar (same shape, different meaning),
  leave it — unifying unrelated concepts because they look alike is worse
  than the duplication.

### Long function
A function doing several unrelated things in sequence, readable only by
holding the whole thing in your head at once.
- **Fix:** extract each cohesive chunk into its own well-named function. A
  long function that's a single, linear, unavoidable sequence (a step-by-step
  protocol with no reusable parts) is not this smell — length alone isn't
  the tell, doing unrelated things is.

### Large class / god object
A class or module that has accumulated responsibilities that don't belong
together, recognizable by needing to know about far more of it than any one
task requires.
- **Fix:** split by responsibility, each piece named for what it actually
  does. The tell that a split is real progress: the new pieces are each
  individually easier to explain than the original was.

### Long parameter list
Callers regularly get the argument order wrong, or need to pass values they
don't have a natural reason to know.
- **Fix:** group related parameters into a single object, or reduce the
  function to needing less by moving logic closer to the data.

## Couplers (parts too entangled)

### Feature envy
A method that pulls more data out of another object than it uses from its
own — it's doing that other object's job from the wrong side.
- **Fix:** move the method (or the part of it that's envious) to the object
  whose data it's really working with.

### Shotgun surgery
A single conceptual change (add a field, rename a concept) requires small
edits scattered across many files.
- **Fix:** consolidate the logic that changes together into one place. This
  is the opposite failure mode from a god object — too spread out instead of
  too concentrated — and the fix is the same instinct in reverse.

### Divergent change
One file gets modified for many unrelated reasons — a change to billing
logic and a change to display formatting both land in the same file because
that's where things go.
- **Fix:** split the file along the axes that actually change independently,
  so each piece has one reason to change.

### Message chains
A caller reaches through a.b().c().d() to get what it needs, coupling it to
the exact internal path rather than the actual capability.
- **Fix:** add a method on the object the caller actually has, so it asks for
  what it needs directly instead of navigating there.

### Middle man
A class whose methods mostly just forward to another object, adding
indirection without adding behavior.
- **Fix:** let callers talk to the real object directly, unless the
  indirection is intentional (an interface boundary, a facade hiding real
  complexity) — in which case it's not this smell.

## Concept smells (the code is missing a name for something real)

### Primitive obsession
A meaningful concept — money, a percentage, a validated ID, a date range —
passed around as a raw string, number, or pair of primitives instead of a
type that can enforce its own rules.
- **Fix:** give the concept a name and a type. The test: can an invalid
  instance be constructed and passed around undetected? If yes, the
  primitive is hiding a missing invariant.

### Data clumps
The same group of 3-4 values always travels together as separate parameters
or fields, never acknowledged as a single thing.
- **Fix:** name the group and pass it as one value.

### Switch statements / repeated type checks
The same conditional on an object's type or a status field, repeated at
multiple call sites, each needing to stay in sync when a new case is added.
- **Fix:** replace with polymorphic dispatch (or a lookup table) so adding a
  case means adding code in one place, not finding every switch. A single,
  isolated switch statement that will realistically never grow a new case
  is not worth this fix — the smell is the *repetition* and *growth risk*,
  not the branching construct itself.

## Over-engineering (built for a need that hasn't shown up)

### Speculative generality
An abstraction, hook, or configuration option built for a future requirement
that doesn't exist yet, adding indirection with no current payoff.
- **Fix:** remove it and let a real second use case justify the abstraction
  when (if) it arrives. This is functional decomposition's discipline
  (`mental-models/references/generative-lenses.md`) applied to code
  structure: build toward what's actually needed.

### Refused bequest
A subclass that inherits methods it doesn't want or use, working around them
rather than benefiting from them.
- **Fix:** the inheritance relationship is probably wrong — favor composition,
  or restructure the hierarchy so what's shared is actually shared by
  everything that inherits it.

## Housekeeping

### Dead code
Code nothing calls, a branch that can't be reached, or a flag argument that's
been the same value at every call site for a long time.
- **Fix:** delete it. Dead code is not documentation of intent — version
  control is. A flag argument frozen at one value is a sign the function
  should be split into the two things it was actually being asked to do.

### Comment as deodorant
A comment explaining what confusing code does, instead of the code being
rewritten to not need the explanation.
- **Fix:** rewrite the code so the comment becomes unnecessary, then delete
  it. A comment explaining *why* (a non-obvious constraint, a workaround for
  a specific bug) is not this smell — only ones papering over unclear *what*.

### Temporary field
A field that's only meaningful during certain operations and is `null` or
unset the rest of the time, forcing every reader to track when it's valid.
- **Fix:** move the field into a smaller object that only exists during the
  operation that needs it, so its lifetime is explicit instead of implicit.
