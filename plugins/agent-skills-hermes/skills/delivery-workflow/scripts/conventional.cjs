'use strict';
// Conventional Commits, and the semantic version they imply.
//
// A subject is `type(scope)!: description`, with the scope and the ! optional.
// fix bumps the patch number and feat the minor number. A ! or a
// "BREAKING CHANGE:" footer bumps the major number. Below 1.0.0 the public
// interface isn't stable yet, so a breaking change bumps the minor number
// there, and the project chooses when to reach 1.0.0.
//
// The message format is the common industry one. The description after the
// type is imperative and lowercase ("fix: stop reading DO NOT SHIP as ship"),
// the subject is at most 72 characters with no full stop, a blank line
// follows it, and the body says what changed and why, wrapped at 72.
//
// The guard hook, next-version.cjs, check-pr.js and the agent-skills
// commit-msg hook all read this file, so there is one definition of a valid
// message.

const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
const HEADER = /^([a-z]+)(?:\(([^()\r\n]+)\))?(!)?: (\S.*)$/;
// Subjects git writes itself, which carry no type.
const GENERATED = /^(?:Merge (?:pull request|branch|remote-tracking branch|tag) |Revert ")/;

// The parsed subject, or null when it isn't a Conventional Commit.
function parse(message) {
  const [subject = '', ...rest] = String(message).replace(/\r/g, '').split('\n');
  const m = HEADER.exec(subject.trim());
  if (!m || !TYPES.includes(m[1])) return null;
  const body = rest.join('\n');
  return {
    type: m[1],
    scope: m[2] || null,
    breaking: Boolean(m[3]) || /^BREAKING[ -]CHANGE: /m.test(body),
    description: m[4],
  };
}

// Why the subject is refused, or null when it is fine.
function subjectProblem(message) {
  const subject = String(message).replace(/\r/g, '').split('\n')[0].trim();
  if (GENERATED.test(subject) || parse(message)) return null;
  const m = HEADER.exec(subject);
  if (m) return `"${m[1]}" is not a commit type. Use one of ${TYPES.join(', ')}`;
  return `the subject needs a type, as in "fix: stop reading DO NOT SHIP as ship". Types are ${TYPES.join(', ')}`;
}

const SUBJECT_MAX = 72;
const BODY_COLUMNS = 72;
// Words that end like a past tense or a gerund but are base verbs.
const NOT_PAST = new Set(['embed', 'feed', 'need', 'seed', 'shed', 'speed', 'bleed', 'proceed', 'exceed', 'succeed', 'bring', 'sing', 'string', 'ping', 'ring', 'wing', 'swing', 'spring']);
// Verbs a description most often starts with. Their third-person forms
// ("adds") are refused, and so is a capital on them ("Add"). A capital on any
// other word is allowed, because it is usually a name such as Codex or Vale.
const VERBS = ['add', 'fix', 'update', 'remove', 'make', 'change', 'move', 'rename', 'improve', 'use', 'allow', 'prevent',
  'stop', 'handle', 'return', 'support', 'ensure', 'create', 'delete', 'set', 'get', 'run', 'check', 'bump', 'read',
  'write', 'refactor', 'replace', 'introduce', 'implement', 'enable', 'disable', 'drop', 'keep', 'show', 'hide', 'skip',
  'merge', 'split', 'rewrite', 'document', 'clean', 'restore', 'raise', 'lower', 'require', 'reject', 'refuse', 'block'];
const THIRD_PERSON = new Set(VERBS.map((v) => (/(?:s|x|ch|sh)$/.test(v) ? `${v}es` : `${v}s`)));

// Why the description isn't an imperative, lowercase phrase, or null. The
// mood check is a heuristic on the first word: it catches "added", "adding"
// and "adds", and lets anything else through.
function descriptionProblem(description) {
  const first = description.split(/\s+/)[0].replace(/[^A-Za-z-]/g, '');
  const lower = first.toLowerCase();
  const pastOrGerund = /[a-z]{3,}(?:ed|ing)$/.test(lower) && !NOT_PAST.has(lower);
  if (pastOrGerund || THIRD_PERSON.has(lower)) {
    return `write the description as an instruction, as in "fix: stop ..." or "feat: add ...", not "${first} ..."`;
  }
  if (first !== lower && VERBS.includes(lower)) return `start the description in lowercase ("${lower}")`;
  return null;
}

// Every way the message breaks the format. Messages git writes itself, such
// as merges and reverts, are left alone.
function messageProblems(message) {
  const lines = String(message).replace(/\r/g, '').split('\n');
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const subject = (lines[0] || '').trim();
  if (!subject || GENERATED.test(subject)) return [];
  const problems = [];
  const typeProblem = subjectProblem(message);
  if (typeProblem) problems.push(typeProblem);
  const parsed = parse(message);
  if (parsed) {
    const d = descriptionProblem(parsed.description);
    if (d) problems.push(d);
  }
  if (subject.length > SUBJECT_MAX) problems.push(`the subject is ${subject.length} characters. Keep it to ${SUBJECT_MAX} and put the detail in the body`);
  if (/\.$/.test(subject) && !/\.\.\.$/.test(subject)) problems.push('the subject ends in a full stop. It is a title, not a sentence');
  if (lines.length > 1 && lines[1].trim() !== '') problems.push('leave a blank line after the subject, where git and every forge split the message');
  // Indented lines are quoted output, such as aligned tables, and keep their
  // width. A line that is one unbreakable token, such as a URL, can't wrap.
  for (const [i, line] of lines.slice(2).entries()) {
    if (line.length > BODY_COLUMNS && !/^\s{2,}/.test(line) && /\s/.test(line.trim())) {
      problems.push(`body line ${i + 3} is ${line.length} columns. Wrap at ${BODY_COLUMNS}`);
    }
  }
  return problems;
}

const LEVELS = ['patch', 'minor', 'major'];

function levelOf(commit, preMajor) {
  if (commit.breaking) return preMajor ? 'minor' : 'major';
  if (commit.type === 'feat') return 'minor';
  if (commit.type === 'fix' || commit.type === 'perf') return 'patch';
  return null;
}

// The bump the commits call for, and the version it produces from `current`
// ("1.4.2" or "v1.4.2"). Returns { level, next }, with level null when no
// commit changes the version.
function nextVersion(current, messages) {
  const [major, minor, patch] = String(current).replace(/^v/, '').split('.').map(Number);
  const preMajor = major === 0;
  let level = null;
  for (const message of messages) {
    const commit = parse(message);
    const l = commit && levelOf(commit, preMajor);
    if (l && (!level || LEVELS.indexOf(l) > LEVELS.indexOf(level))) level = l;
  }
  const next = level === 'major' ? `${major + 1}.0.0`
    : level === 'minor' ? `${major}.${minor + 1}.0`
      : level === 'patch' ? `${major}.${minor}.${patch + 1}`
        : `${major}.${minor}.${patch}`;
  return { level, next };
}

module.exports = { TYPES, parse, subjectProblem, descriptionProblem, messageProblems, nextVersion, levelOf, GENERATED, SUBJECT_MAX, BODY_COLUMNS };
