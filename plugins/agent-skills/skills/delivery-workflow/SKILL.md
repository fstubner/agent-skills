---
name: delivery-workflow
description: >-
  How work gets from a request to the default branch and into a release
  when an agent does the routine work and the owner makes the decisions.
  The agent examines first, agrees a design for anything new, works and
  commits on a branch, verifies with the full suite, and opens a pull request
  that says what changed, how it was verified and what was left out. It
  merges only when the owner says so in chat, and releases stay drafts, at
  most one a day. A guard hook refuses commits and pushes to the default
  branch, force pushes, remote deletions, non-draft releases and attribution
  trailers. Triggers on "open a PR", "commit this", "push it", "merge it",
  "ship this", "cut a release", or the start of any change to a repository
  with a remote. Not for designing a project's CI/CD or release pipeline
  (release-engineering) or writing the release notes (repo-docs).
compatibility: Requires git, the GitHub CLI (gh) and Node 18+. The pull request voice check needs repo-docs installed beside it and Vale.
---

# Delivery workflow

The agent does the routine work of getting a change merged. The owner makes
the decisions and reviews the result. The owner is the person in the chat.

## The loop

1. Examine the problem fully and report what you found before fixing anything.
2. For anything new, agree a design first with `product-build`, one question at a time.
3. Create a branch named for the change, and commit on it as you go.
4. Verify with the project's full test suite, and check the exit code.
5. Open a pull request whose description passes `check-pr.js`.
6. Merge when the owner tells you to in chat, and only once CI passes.
7. For a release, create a draft and hand the owner the link.

## Branches and commits

Work on a branch from the first change. Commit without asking, one theme per
commit, in the style the repository's history already uses. If the repository
has a commit-msg hook, its rules are the style. Never add a Co-Authored-By
line or a "Generated with" line.

A repository with no remote has no pull request to go through, so commit on
its default branch as before.

## Verification

Find the test command in AGENTS.md, CONTRIBUTING.md or the package manifest.
Run the full suite before opening a pull request and again after the last
commit. Read the exit code of the test command itself. A command piped into
`tail` or `grep` reports the exit code of the last command, and that has
reported a failing suite as a pass before.

Verify at the layer a user touches. A unit test passing is not proof that an
installed command or a deployed page changed.

## The pull request

The description has three sections, each with content.

- `## What changed` says what is different for someone using the project.
- `## How it was verified` gives the commands run and their results.
- `## Left out on purpose` names what was not done and why.

A `## Summary` section above them is welcome. Write the body to a file and
check it before opening the pull request or changing its description.

```bash
node <this-skill>/scripts/check-pr.js --root . --body-file pr.md --format text
gh pr create --title "<title>" --body-file pr.md
```

(`<this-skill>` is the folder containing this file.) After opening it, run the
checker on the live description with `--pr <number>`. The voice rules are the
ones `repo-docs` uses, so a pull request reads like the rest of the
repository. Add the CHANGELOG `[Unreleased]` entry in the pull request
itself.

## Merging

Merge only when the owner has told you to merge that pull request, in this
conversation. Approval of one pull request does not carry over to another.
Wait for CI to pass, merge with the repository's usual method, delete the
branch, and update the local default branch.

```bash
gh pr checks <number> --watch
gh pr merge <number> --merge --delete-branch
```

Never use `--admin`, because it skips branch protection.

## Releases

At most one release a day per project. Check the last release date first. If
it is today, say the work is waiting under `[Unreleased]` and stop. A finished
fix is not a reason to release.

1. Check that the default branch is green and the CHANGELOG has the release section.
2. Write the release notes with `repo-docs` from that section.
3. Tag and push following the project's RELEASE.md.
4. Make sure the release is a draft, and hand the owner its link.

Publishing a release is the owner's step. Don't publish a draft, even when a
pipeline leaves one behind.

## What needs the owner

Design decisions, scope changes, merging, publishing a release and anything
destructive on a remote. Everything else goes ahead without asking.

## Enforcement

Two layers hold the workflow when a session forgets it.

- `scripts/guard.cjs` is a Claude Code hook. It refuses commits and pushes to
  the default branch, force pushes other than `--force-with-lease`, deleting
  a branch or tag on a remote, a release that isn't a draft, publishing a
  draft, a second release in a day, attribution trailers and `gh pr merge
  --admin`. Install it once for all projects with
  `node scripts/install-workflow-guard.mjs` from the agent-skills
  repository.
- `scripts/protect-branch.cjs` sets GitHub branch protection on the default
  branch. Changes need a pull request with passing checks, administrators
  included. It prints the settings and changes nothing without `--apply`, so
  show the owner the output first. GitHub Free has no branch protection for
  private repositories.

No approving review is required, because the agent works through the
owner's login and GitHub doesn't let a pull request's author approve it.

## What this skill does not do

- Design or change a CI/CD pipeline. That is `release-engineering`, and this
  workflow works inside what it designed.
- Approve or publish anything for the owner.
- Bypass a hook with `--no-verify` or rewrite published history.
