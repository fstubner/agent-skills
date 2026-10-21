# Release notes

Release notes are the version of a CHANGELOG section written for someone
deciding whether to install. The CHANGELOG keeps the full technical record.
The notes say what changed for a user in a few minutes of reading.

## Workflow

1. Write or finish the CHANGELOG section for the version first.
2. Draft the notes from that section only, using `assets/RELEASE_NOTES.md`.
3. Check both together.

   ```bash
   node <this-skill>/scripts/check-docs.js --root . --release-notes NOTES.md --section <version>
   ```

4. Read the notes once more for the judgment rules in `SKILL.md`, then hand
   them over. Publishing is the owner's decision.

## Shape

1. **One opening line** saying what the project is. A first-time reader may
   land on the release page before the README.
2. **What's in it**, for a first release, or **What's new**, for later ones.
   A short list of what a user gets or what changed for them.
3. **What it doesn't claim**, when the project makes claims a reader might
   over-read. Say it in the first person and plainly.
4. **Changes**, as plain sentences, one per item. Lead with the effect on a
   user, not the mechanism.
5. **Upgrading or versioning**, only when a user has to do something.
6. **Install**, as a link to INSTALL.md or the README section.

## Rules

- **Only figures the CHANGELOG section recorded.** `D-release-numbers` fails
  on any other. Rounding or rewording a number counts as a new number, so
  quote it as recorded.
- **Shorter than the section.** Drop internal detail a user can't act on,
  such as test counts, refactors and file names.
- **Link to docs on the default branch** if the docs were improved after the
  tag, and to the tag if they weren't.
- **No marketing.** No "excited to announce", no "powerful", no superlatives.
  Say what changed.
