# Pattern catalog

Each pattern below is a **habit**, not proof of authorship — humans produce every one
of these too, especially under deadline. Treat a hit as a prompt to look at that
sentence, not a verdict on the writer.

Patterns are split by how reliably they can be caught by a regex:

- **Vale-checkable** — specific enough to lint deterministically. These have a
  matching rule in `rules/AntiAISlop/`.
- **Judgment-only** — real, but too context-dependent for a regex without heavy
  false positives (they depend on rhetorical structure, not fixed wording).
  These live only in `SKILL.md` guidance for an editing/detect pass.

## Vale-checkable

### Inflated vocabulary
Words that sound important but carry less information than a plain synonym.
The list below is generated from `rules/AntiAISlop/InflatedVocabulary.yml` —
see the caveat after it for words that were deliberately left out:
<!-- gen-patterns:tokens InflatedVocabulary.yml -->*delve, delves, delving, leverage, leverages, leveraging, foster, fosters, fostering, utilize, utilizes, utilizing, streamline, streamlines, streamlining, cutting-edge, paradigm shift, game-changer, game-changing, tapestry, multifaceted, meticulous, meticulously, paramount, transformative, elevate, elevates, elevating, harnessing, empower, empowers, empowering, facilitate, facilitates, facilitating, seamless, seamlessly, holistic, holistically, supercharge, supercharges, supercharging, unlock the power/potential of, robust, robustly, realm.*<!-- /gen-patterns -->

- **Why it reads as slop:** these words showed up disproportionately in
  post-2022 model output relative to baseline human writing on the same topics;
  readers now recognize them as a tell independent of whether they're deployed
  well.
- **Fix:** name the plain action or quality instead. *"Leverage the API"* → *"call
  the API."* *"A robust solution"* → say what makes it hold up under load, or cut
  the adjective.
- **Caveat:** some of these are legitimate domain terms (e.g. "robust" in a
  stats methods section). The rule flags, it doesn't forbid — check register
  before cutting. Bare "harness" (noun) is deliberately NOT flagged — it's
  ordinary technical vocabulary (a wiring harness, an *agent harness* — the
  exact term this repo's own tooling uses), and existence-style linting can't
  tell the noun from the verb. Only "harnessing" (almost always the
  figurative gerund, "harnessing the power of X") is checked. Two related
  claims — "underscore" and "unlock" as bare figurative verbs — turned out to
  be either already covered elsewhere or too collision-prone to check as a
  single word: see Importance inflation for "underscores the
  importance/significance of", and note that only the specific phrase
  "unlock the power/potential of" is checked here, not the bare verb (plain
  "unlock this feature" is legitimate in software writing).

### Throat-clearing openers
Stock phrases that delay the point instead of starting with it (generated
from `rules/AntiAISlop/ThroatClearing.yml`; matching is case-insensitive so
the tokens below are lowercase):
<!-- gen-patterns:tokens ThroatClearing.yml -->*here's the thing, let me be clear, i'll be honest, to be honest, simply put, at its core, it's worth noting that, it is worth noting that, it's important to note that, it is important to note that, needless to say, the truth is.*<!-- /gen-patterns -->

- **Why it reads as slop:** these add a beat of narration before the actual
  content, a tic that's rare in edited human prose but common in model output
  padding toward a target length.
- **Fix:** delete the opener, start with the claim.

### Weasel attribution
Claims sourced to nobody in particular (generated from
`rules/AntiAISlop/WeaselAttribution.yml`):
<!-- gen-patterns:tokens WeaselAttribution.yml -->*studies show, research shows, research suggests, experts agree, experts say, many believe, it is widely believed, it is widely held, critics argue, some argue, industry reports suggest.*<!-- /gen-patterns -->

- **Why it reads as slop:** it borrows the authority of evidence without
  supplying any. A human writer under source discipline names the study; a model
  often can't, so it hedges with a vague crowd.
- **Fix:** name the source, or drop the claim and state your own view plainly.

### Importance inflation
Sentences whose whole job is announcing that something matters, without saying
what happens as a result (generated from
`rules/AntiAISlop/ImportanceInflation.yml`):
<!-- gen-patterns:tokens ImportanceInflation.yml -->*stands as a testament to, marks a pivotal moment, plays a vital role, plays a crucial role, underscores the importance of, underscores the significance of, solidifies its position as, represents a significant step, cannot be overstated, serves as a testament to.*<!-- /gen-patterns -->

- **Why it reads as slop:** it's a rhetorical shortcut around doing the work of
  showing why something matters — a concrete consequence, number, or comparison.
- **Fix:** replace with the actual fact and let the reader judge significance.
  *"marks a pivotal moment for the company"* → *"is the company's first paid
  product."*

### Summary-recap endings
A closing paragraph that restates what the reader just read (generated from
`rules/AntiAISlop/SummaryRecap.yml`):
<!-- gen-patterns:tokens SummaryRecap.yml -->*"In conclusion," "To summarize," "In summary," "All in all," "To wrap up," "Overall,"*<!-- /gen-patterns -->

- **Why it reads as slop:** the reader was just there; restating adds length, not
  information. This convention comes from templated essay structure, not from how
  people naturally end a piece of writing.
- **Fix:** end on the last concrete point, a takeaway, or a next action — or just
  stop.

### Excessive em dash use
Piling up em dashes as a default rhythm device instead of choosing among comma,
period, colon, or parenthesis for the actual relationship between clauses.
The Vale rule checks this **per paragraph** (more than
<!-- gen-patterns:max EmDashOveruse.yml -->2<!-- /gen-patterns -->
in one paragraph fires) — a document with one paragraph-heavy dash and
otherwise sparse use elsewhere reads as normal rhythm and won't trip it.

- **Why it reads as slop:** one or two in a paragraph is normal prose rhythm; a
  cluster of them in a single paragraph is a mechanical tic, not a stylistic choice.
- **Fix:** vary punctuation — most em dashes can become a comma or a full stop
  without losing meaning.

## Judgment-only (not reliably regex-detectable)

### Figurative geography/ecology words
*"Navigate the challenges of...", "the competitive landscape," "a thriving
ecosystem of tools."* "Navigate," "landscape," and "ecosystem" are inflated
vocabulary in their figurative sense — but all three have entirely ordinary
literal uses (real geography, real biology, real navigation) common enough
that an existence-style Vale rule would flag legitimate writing constantly.
Unlike "robust" or "realm," the literal/figurative split here isn't rare
enough to accept as a false-positive rate. Catch these by eye: if the
sentence isn't actually about a place, a map, or an organism, it's the slop
sense.

### Binary-contrast framing
*"This isn't X, it's Y." "The question isn't X — it's Y." "It's not just X, it's
Y."* State Y directly instead of staging it against a strawman X.

### Faux-insight setups
*"Here's what most people miss," "The part nobody talks about," "What nobody
tells you."* These flatter the writer as uniquely perceptive before making an
ordinary point. Cut the setup, let the claim stand alone.

### Colon-reveal drama
A short noun phrase, a colon, then a dramatic lowercase reveal: *"The real
problem: nobody owns it."* Colons are also used correctly everywhere (lists,
labels, quotes, ratios) — a regex can't tell the difference reliably. Rewrite as
a plain sentence when the colon exists purely for cadence.

### Synonym cycling
Rotating between near-synonyms for the same referent across a passage instead of
repeating the one clear word — "the agent," then "the assistant," then "the
tool," all meaning the same thing. Reads as variation-for-its-own-sake rather
than precision.

### Fake-strong verbs over "is"/"has"
*"Serves as a centralized hub for X"* when the plain fact is *"tracks X."* Verbs
that sound active but add no information beyond a copula.

### Negative listing
*"Not a bug. Not a coincidence. A pattern."* Rhetorical staccato that states what
something *isn't* several times before saying what it is. Say the thing.

### Robotic rhythm
Repeated sentence shapes and paragraph lengths across a whole piece — every
paragraph three sentences, every sentence the same clause structure. Detectable
by a human ear, not by a regex on any one sentence.

### Rhetorical self-answered questions
*"What if I told you...", "Think about it:", "Plot twist:"* — staged questions
the writer immediately answers. Drop the staging, make the point.

## Sources of inspiration

This catalog is written independently, but the project of naming these habits
owes a debt to two prior efforts: Simon Willison's browser-based [LLM cliché
highlighter](https://simonwillison.net/2026/Jul/17/llm-cliche-highlighter/), and
Peter Yang's [`no-ai-slop`](https://github.com/petergyang/no-ai-slop) skill (MIT
licensed). Neither is reproduced here — this catalog generalizes the idea to a
broader, deterministically-checkable rule set rather than one narrow list.
