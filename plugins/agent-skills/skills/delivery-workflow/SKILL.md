---
name: delivery-workflow
description: >-
  How work in the owner's own repositories gets to the default branch and
  into a release. The agent commits on a branch with Conventional Commit
  subjects, verifies with the full suite and opens a pull request saying what
  changed, how it was verified and what was left out. It merges only when the
  owner says so, versions releases from the commits and keeps them drafts, at
  most one a day. A guard hook refuses pushes to the default branch, untyped
  subjects, force pushes, remote deletions and non-draft releases. Shared and
  work repositories keep their own conventions. Triggers on "open a PR", "commit this", "push it", "merge it",
  "ship this", "cut a release", or the start of any change to a repository
  with a remote. Not for designing a project's CI/CD or release pipeline
  (release-engineering) or writing the release notes (repo-docs).
compatibility: Requires git, the GitHub CLI (gh) and Node 18+. The pull request voice check needs repo-docs installed beside it and Vale.
---

# Delivery workflow

The agent does the routine work of getting a change merged. The owner makes
the decisions and reviews the result. The owner is the person in the chat.

## Whose repository

This workflow is for the owner's own repositories. Check first.

```bash
node <this-skill>/scripts/guard.cjs --status
```

(`<this-skill>` is the folder containing this file.) A repository is covered
when its origin remote belongs to an account in
`~/.agent-skills/workflow/config.json`. If it isn't covered, it's a shared or
work repository. Follow its CONTRIBUTING file and history instead of this
skill, and ask before pushing anything.

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
commit. Never add a Co-Authored-By line or a "Generated with" line.

Every subject is a Conventional Commit, `type(scope): description`, with the
scope optional. The type decides the next version, so choose it for what a
user of the project sees.

| Type | Use it for | Version |
|---|---|---|
| `feat` | something a user can do that they couldn't before | minor |
| `fix` | something that was wrong and now works | patch |
| `perf` | the same behaviour, faster | patch |
| `docs`, `test`, `refactor`, `style`, `build`, `ci`, `chore`, `revert` | everything else | none |

A `!` after the type, as in `feat!:`, or a `BREAKING CHANGE:` line in the
body marks a change that breaks existing use. It bumps the major version, or
the minor version while the project is below 1.0.0.

The message follows the common industry format.

- The description is an instruction in lowercase, as in `fix: stop reading
  DO NOT SHIP as ship` or `feat: add a dry-run flag`. Not "added", "adding"
  or "adds".
- The subject is at most 72 characters, with no full stop.
- A blank line follows the subject.
- The body says what changed and why, wrapped at 72 columns. Indented lines,
  such as a quoted table, keep their width.

```
fix: stop reading DO NOT SHIP as ship

The verdict parser matched "SHIP" as a substring, so a BLOCK verdict
written as "DO NOT SHIP" counted as a pass.
```

If the repository has its own commit-msg hook, follow its other rules too.

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

A `## Summary` section above them is welcome. Each paragraph and list item
is one line, because GitHub reflows the body and a hard-wrapped one reads as
broken lines. Write as the author of the change, not a narrator of the
session. The title follows the commit subject format, since it becomes the
merge or squash commit's subject. Write the body to a file and check it with
the title before opening the pull request or changing its description.

```bash
node <this-skill>/scripts/check-pr.js --root . --body-file pr.md --title "<title>" --format text
gh pr create --title "<title>" --body-file pr.md
```

If `gh pr edit` fails on a GraphQL error about classic Projects, update the
pull request through the REST API with `gh api -X PATCH
repos/<owner>/<repo>/pulls/<number>`.

After opening it, run the
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

Never use `--admin`, because it skips branch protection. Never use `--auto`,
because on a branch that requires no checks it merges at once.

## Releases

At most one release a day per project. Check the last release date first. If
it is today, say the work is waiting under `[Unreleased]` and stop. A finished
fix is not a reason to release.

The version number comes from the commits since the last version tag.

```bash
node <this-skill>/scripts/next-version.cjs --root .
```

It prints the next version and each commit that moved it. It exits 1 when a
commit has no type, and then the owner decides what those commits changed.

1. Check that the default branch is green and the CHANGELOG has the release section.
2. Run `next-version.cjs` and use the version it prints.
3. Write the release notes with `repo-docs` from that section.
4. Tag and push following the project's RELEASE.md.
5. Make sure the release is a draft, and hand the owner its link.

Publishing a release is the owner's step. Don't publish a draft, even when a
pipeline leaves one behind.

## What needs the owner

Design decisions, scope changes, merging, publishing a release and anything
destructive on a remote. Everything else goes ahead without asking.

## Enforcement

Two layers hold the workflow when a session forgets it.

- `scripts/guard.cjs` is a Claude Code hook. It refuses commits and pushes to
  the default branch, commit messages and pull request titles that break the
  format, force pushes other than `--force-with-lease` and deleting a branch
  or tag on a remote. It also refuses a release that isn't a draft,
  publishing a draft, a second release in a day, attribution lines in a
  commit or pull request, and `gh pr merge` with `--admin` or `--auto`. Install it once
  for all projects with `node scripts/install-workflow-guard.mjs` from the
  agent-skills repository. It covers the repositories of the GitHub login
  `gh` is signed in as, or the accounts given with `--owner`.
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
