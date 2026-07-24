# Meta-lenses

These check the thinking itself, not the problem. Apply them regardless of
which diagnostic or generative lens got you to a conclusion — they're not
an alternative to those lenses, they're what every lens should end at.

## Defensibility check

**For:** any conclusion, from any lens, before it gets presented as done.

**How:** the governing question is "is this true, can I defend it, does it
sound like me." Concretely: could a real, informed person push back on this
specific claim, and would you have an actual answer — or just a
plausible-sounding one? If the honest answer is "I'd have to go check,"
you're not done; go check.

This is the same discipline `anti-ai-slop` applies to prose (no unsupported
superlatives, no fabricated examples, no claim dressed up to sound more
certain than it is), aimed here at reasoning and conclusions generally
rather than just sentences. Use both skills; they check different surfaces
of the same underlying habit.

## Coverage test / premature-closure check

**For:** deciding whether you've actually found enough — for a diagnosed
cause, a decomposed set of factors, or a chosen approach.

**How:** for each factor or cause you believe matters, ask what else you'd
expect to see if it were *really* contributing — then check whether you
actually see it. A cause doing real work tends to leave more than one
trace. If the only evidence for a factor is the symptom you started with,
you haven't found a cause, you've renamed the symptom.

**Why this matters — named, not vague:** Pat Croskerry's work on premature
closure in clinical diagnostic reasoning (2003) describes exactly this
failure — settling on an answer once the pressure that started the search
has eased, before checking whether it's actually complete. It sits next to
Raymond Nickerson's review of confirmation bias (1998): the well-documented
tendency to notice evidence that fits what you already believe and pass
over what doesn't. Both point at the same practical rule: **the first
workable explanation is rarely the most complete one**, and the pressure to
stop searching is not evidence that you should.

**Failure mode:** treating "I have an explanation" as equivalent to "I have
the right explanation." Those are different claims, and only the check
above tells them apart.

## Record-the-why

**For:** whenever you choose a fast, partial fix over a complete one —
which is often the correct call, not a failure to catch.

**How:** ITIL's distinction between a *workaround* (a deliberate, temporary
fix, known to be incomplete) and a *known error* (the recorded, still-open
underlying issue the workaround doesn't resolve) is the useful shape here.
The workaround itself isn't the problem. An *unrecorded* workaround is,
because without a record it's indistinguishable from an accidental fix —
and the reasoning that would explain it lived in someone's head at the
time, not anywhere durable.

**Failure mode, concretely:** a `// TODO` or `// HACK` comment with no
ticket behind it, or a caught exception silently retried to make a flaky
failure go away with nothing filed about why it was flaky. Both are
extremely common, and both produce the same result: months later, whoever
finds it — often the same person who wrote it — has no way to tell whether
it was a deliberate, informed decision or something that happened to work.
