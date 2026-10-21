# Supporting documents

INSTALL, CONTRIBUTING, SECURITY, RELEASE and pages under `docs/` hold what
the README links to. They follow the same voice rules and the same principle
of describing what is.

## INSTALL.md

Requirements first, then one section per install path, each with its
commands in a code block. End with what the installer guarantees and how to
uninstall or pin a version. Platform differences go in the section for that
platform.

## CONTRIBUTING.md

What to run before a pull request, how to add the thing contributors add
most often, and the rules a reviewer will hold them to. Release steps live in
RELEASE.md, so link to it.

## SECURITY.md

How to report a vulnerability, then the threat model as a short list of what
the project does and doesn't protect against. Name the limits plainly. A
reader trusts a security page that says what it can't do.

## RELEASE.md

What starts a release, what the pipeline checks, the numbered steps to cut
one, and how to roll back. Facts about the tooling only.

## docs/ pages

One topic per page, with a title that names it. Link back to the README.
Generated pages start with a `<!-- GENERATED` comment and are skipped by the
checker, since they are fixed by changing their source.

## Across all of them

- Keep history out. A rule's origin goes in the CHANGELOG or commit message.
- Keep framing and rationale out. A sentence either states a fact or tells
  the reader what to do. The reason a design is the way it is goes in an ADR.
- Link to the single place a fact lives instead of repeating it, so there is
  one copy to keep true.
- Commands go in code blocks, literal strings in backticks.
