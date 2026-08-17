import path from 'path';
import { root, read, expect } from './harness.mjs';

// ---------- A run that never reached a model is not a failing run ----------
// Two engineering-assessment runs hit the Codex account's usage limit,
// produced no model turn at all, and were graded as five model FAILURES
// each. Absence of evidence read as evidence of absence — inside the system
// built to prevent exactly that. Both guards below must classify it as an
// environment failure: the message match, and the structural backstop that
// does not depend on any provider's wording.
{
  const src = read(path.join(root, 'scripts', 'eval-run.mjs'));
  const failureMatcher = /const environmentFailure = (\/.*?\/i)\.exec/s.exec(src);
  expect('eval-run declares an environment-failure matcher', Boolean(failureMatcher), 'not found');
  if (failureMatcher) {
    const re = new RegExp(failureMatcher[1].slice(1, -2), 'i');
    const realWorldFailures = [
      "You've hit your usage limit. Upgrade to Pro or try again at Aug 20th",
      'Failed to authenticate',
      'writing is blocked by read-only sandbox',
      'rate limit exceeded',
      'quota exceeded for this project',
      '529 overloaded_error',
    ];
    for (const message of realWorldFailures) {
      expect(`environment failure recognised: "${message.slice(0, 38)}"`, re.test(message), message);
    }
    // It must NOT swallow a genuine model result.
    const realResults = [
      'ASSESSMENT.md written with five findings',
      'the smoke test asserts nothing meaningful',
    ];
    for (const message of realResults) {
      expect(`a real model result is not misread as an environment failure: "${message.slice(0, 30)}"`,
        !re.test(message), message);
    }
  }

  expect('eval-run has a wording-independent backstop for "no model turn"',
    /const noModelTurn =[\s\S]{0,220}totalTokens === null/.test(src),
    'a provider phrasing this differently would be graded as model failures again');
  expect('the backstop feeds the not_evaluated path',
    /if \(environmentFailure \|\| noModelTurn \|\| ambientSkillAccess\)/.test(src));
}
