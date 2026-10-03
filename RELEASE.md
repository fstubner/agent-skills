# Release

Pushing a tag is the only thing that starts a release. The release workflow
rejects a tag unless it is `v<VERSION>`, points at the workflow commit and has
a matching changelog heading. It then needs the full suite to pass on Windows
and Ubuntu, and native install smoke tests to pass for Claude, Codex, Gemini
and Antigravity. Cursor's local package layout is checked automatically.
Cursor has no documented headless plugin loader, so loading through its
public or team marketplace is a manual check.

The workflow builds one archive from the tagged commit, records its SHA-256
and attaches those exact bytes to a **draft** release. It then downloads them
again, verifies the checksum and runs a packaged checker. The publish job
never rebuilds anything, and the workflow never makes a release public. A
person does that after reading the notes.

A tag runs the release workflow as it exists at the tagged commit. Tagging an
older commit runs that commit's release rules, which may be older than the
current ones.

## Cut a release

1. Update `VERSION` and add `## <version>` to `CHANGELOG.md`.
2. Run `node scripts/gen-plugin-bundles.mjs`.
3. Run `node scripts/run-tests.mjs` and review the generated diff.
4. Commit, create an annotated `v<version>` tag and push the tag.
5. Wait for the workflow, review the draft and publish it yourself.

   ```bash
   gh release edit v<version> --draft=false
   ```

Nothing becomes public until step 5, so a tag pushed by mistake only costs a
draft.

## Roll back

Treat published releases and tags as permanent. The workflow creates a
release once and never updates or deletes it. GitHub administrators can still
replace assets or move tags unless repository rulesets prevent it. Mark a bad
release as withdrawn, then ship a patch from the last good tag.

```bash
gh release edit <bad-tag> --title "[WITHDRAWN] <bad-tag>" --notes-file WITHDRAWN.md
git switch --detach <last-good-tag>
git switch -c release/<new-patch>
# Update VERSION and CHANGELOG.md, regenerate packages, test, commit and tag.
git tag -a v<new-patch> -m "v<new-patch>"
git push origin v<new-patch>
```

Users should pin `<last-good-tag>` or its release archive until the patch is
out. Don't move or delete a published tag as a rollback.

If verification fails after publishing, run the withdrawal command straight
away, since the workflow can't delete or rewrite a release. Turn on tag
protection rulesets and immutable releases in the repository settings if you
want GitHub to enforce this too.
