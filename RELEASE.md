# Release

Tags are the only publication trigger. The release workflow rejects a tag
unless it is `v<VERSION>`, points at the workflow commit, has a matching
changelog heading, passes the full Windows/Ubuntu suite, and passes native
Claude, Codex, Gemini, and Antigravity install smokes. Cursor's documented
local package layout is checked automatically; Cursor currently exposes no
documented headless plugin loader, so public or team-Marketplace loading remains
a manual release check.

The workflow builds one archive from the tagged Git object, records its
SHA-256, publishes those exact bytes, downloads them again, verifies the
checksum, and executes a packaged checker. It never rebuilds in the publish
job.

## Cut a release

1. Update `VERSION` and add `## <version>` to `CHANGELOG.md`.
2. Run `node scripts/gen-plugin-bundles.mjs`.
3. Run `node scripts/run-tests.mjs` and review the generated diff.
4. Commit, create an annotated `v<version>` tag, and push the tag.

## Roll back

Treat published artifacts and tags as immutable repository policy: the
workflow creates a release once and never updates or deletes it, but GitHub
administrators can still replace assets or move tags unless repository
rulesets prohibit that. Mark a bad release as withdrawn, then issue a new patch
from the last good tag:

```bash
gh release edit <bad-tag> --title "[WITHDRAWN] <bad-tag>" --notes-file WITHDRAWN.md
git switch --detach <last-good-tag>
git switch -c release/<new-patch>
# Update VERSION and CHANGELOG.md, regenerate packages, test, commit and tag.
git tag -a v<new-patch> -m "v<new-patch>"
git push origin v<new-patch>
```

Consumers should pin `<last-good-tag>` or its release archive until the patch
is available. Never force-move or delete a published tag as a rollback.

If post-publication verification fails, immediately run the withdrawal command
above; the workflow intentionally cannot delete or rewrite a release. Configure
GitHub tag-protection/rulesets and immutable releases in repository settings if
administrative enforcement is required in addition to this workflow policy.
