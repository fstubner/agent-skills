// Extracted from structure.mjs to keep it under this suite's own 400-line
// limit; this block also tripped the depth check. Both were pre-existing.
import path from 'path';
import { root, registry, read, expect } from './harness.mjs';

// ---------- The README documents the suite that actually ships ----------
// It listed 15 skills while 17 shipped; engineering-assessment and
// multi-agent-design appeared nowhere, and engineering-assessment is the
// most-invoked skill in this machine's telemetry. Every other
// registry-to-disk relationship had a cross-check; the one a human reads
// first did not.
{
  const readme = read(path.join(root, 'README.md'));
  for (const skill of registry.skills) {
    expect(`README links the ${skill.id} skill`, readme.includes(`[\`${skill.id}\`](./${skill.id}/)`),
      'registered skill missing from the README table');
  }
  // Only counts that are actually counting skills. "twelve days" in a
  // telemetry sentence is not a stale skill count, and a test that says it
  // is teaches people to edit the test.
  const NUMBER_WORDS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const expected = NUMBER_WORDS[registry.skills.length - 10];
  const counts = [
    ...readme.matchAll(/of the (\w+)\b/gi),
    ...readme.matchAll(/\b(\w+) skills\b/gi),
    ...readme.matchAll(/\ball (\w+)\b(?=[^.]*skills)/gi),
  ].map((m) => m[1].toLowerCase()).filter((w) => NUMBER_WORDS.includes(w) || /^\d+$/.test(w));
  const stale = counts.filter((w) => w !== expected && w !== String(registry.skills.length));
  expect('README carries no stale skill count', stale.length === 0,
    `found: ${stale.join(', ')} — suite has ${registry.skills.length} (${expected})`);
}
