# Plan for an AI-native way of working

I want agents to do the routine work across all my projects, so that I make
the decisions and review the results. This plan lists the skills that get me
there and the order I build them in.

## How I work with the agent

1. The agent examines the problem fully and reports what it found before it
   fixes anything.
2. Anything new goes through a design gate. `product-build` asks one question
   at a time, and I make the call.
3. The agent works on a branch and commits on its own, one theme per commit.
4. It verifies with the project's full test suite, at the layer a user
   touches.
5. It opens a pull request that says what changed, how it was verified and
   what was left out.
6. I review the pull request and tell the agent to merge it.
7. Releases stay drafts, at most one a day, and I publish them.

My part is design decisions, scope changes, approving merges, publishing a
release and anything destructive on a remote.

## Skills

| Skill | Writes | Status |
|---|---|---|
| `repo-docs` | README, release notes, CHANGELOG entries and supporting docs | Merged |
| `delivery-workflow` | Branches, pull requests and release drafts, with a guard hook and a pull request checker | In progress |
| `architecture-decisions` | Numbered ADRs in `docs/adr`, with an index and supersede links | Planned |
| `research-report` | Reports in `docs/research` with a stated confidence, evidence, counter-evidence and sources | Planned |
| `session-coach` | Notes in `~/.agent-skills/coaching` on corrections I keep making and where I stepped in | Planned |
| `content-drafting` | Blog and LinkedIn drafts in my private `writing` repository | Planned |

`release-engineering` designs how a project ships. `delivery-workflow` works
inside that design and never changes a pipeline.

## Where files go

- `docs/adr`, `docs/plans` and `docs/research` are committed, so the
  repository makes sense to someone without these skills.
- Coaching notes stay on my machine in `~/.agent-skills/`.
- Writing lives in its own private repository, with ideas, pieces and the
  same Vale voice rules.

## Decisions

- **Identity.** The agent works through my own git and GitHub login for now.
  GitHub doesn't let me approve a pull request I opened, so my approval is an
  instruction in chat. A GitHub App would give the agent its own identity and
  a recorded approval, and switching to one later doesn't change the skill.
- **Enforcement.** Branch protection on GitHub stops direct pushes to the
  default branch in every tool. A Claude Code hook stops the rest of what the
  workflow forbids. Hooks for other harnesses can come later.
- **One owner per check.** ADR structure moves from `repo-docs` to
  `architecture-decisions` when that skill exists.
