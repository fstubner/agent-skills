# README

A README answers three questions in this order. What is this, how do I get
it, and how do I use it. Everything else is optional and comes after.

## The core every README has

`D-readme-core` checks these.

1. **An opening paragraph that says what the project is.** One or two
   sentences under the title, before any section. Name what it does and who
   it's for. Leave out how it came to exist.
2. **An install section.** The commands, in a code block, that get someone
   from nothing to a working copy.
3. **The licence.** A `License` section, or the licence named in the top
   lines.

## Sections by project type

`D-readme-type` works out the type from the repository and checks for the
section that type needs.

| Type | Detected from | Needs a section for |
|---|---|---|
| plugin or skill suite | a plugin manifest, or top-level folders with `SKILL.md` | what it contains (Skills, Plugins, Commands) |
| app | a frontend or server framework in the manifests | how to run it (Usage, Running, Development) |
| CLI | a `bin` entry, `main.go`, `cmd/`, `src/main.rs`, or `[project.scripts]` | usage (Usage, Commands, Options) |
| library | none of the above | usage (Usage, Examples, API) |

## Order

Use this order and leave out what the project doesn't need.

1. Title and one line of links (version, changelog, licence)
2. Opening paragraph
3. What it contains, or what it does, for a plugin or app
4. Install
5. Usage
6. Evidence, limits or status, if the project makes claims a reader might
   over-read
7. Development and tests
8. Security, contributing, licence

## What doesn't belong

- The story of a rule. "This was added after an audit found…" goes in the
  CHANGELOG or a commit message.
- Dates, except in a link to a dated file.
- A warning banner as the first thing a reader sees. If the project has an
  important limit, say it plainly in its own short section.
- Numbers that will go stale without anyone noticing, unless something
  checks them. A count of skills or commands is fine when a test enforces it.
- Badges beyond version, licence and CI status.

## Length

Most READMEs are done in under 200 lines. Move per-platform install detail,
configuration reference and long explanations into INSTALL.md or `docs/`, and
link to them.
