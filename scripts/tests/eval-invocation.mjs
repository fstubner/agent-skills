// The selection harness must be trustworthy before any of its numbers are:
// the description extractor has to match the frontmatter validator's folded-
// block semantics, the per-trial shuffle has to be deterministic (a run must
// be reproducible from its bundle), the reply parser has to survive prose and
// junk, and the prompt set has to point at skills that exist.
import fs from 'fs';
import path from 'path';
import { expect } from './harness.mjs';
import {
  extractFrontmatterDescription, loadSkillListing, shuffledListing,
  composePrompt, parseReply, scoreTrial,
} from '../eval-invocation.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');

// ---------- description extraction ----------
const folded = '---\nname: sample\ndescription: >-\n  First line\n  second line.\n---\nBody';
expect('extractor joins a folded >- description with spaces',
  extractFrontmatterDescription(folded) === 'First line second line.');
expect('extractor handles a plain single-line description',
  extractFrontmatterDescription('---\nname: x\ndescription: One line.\n---\n') === 'One line.');
expect('extractor returns null without frontmatter',
  extractFrontmatterDescription('no frontmatter here') === null);

const listing = loadSkillListing(root);
expect('every registry skill yields a non-empty description',
  listing.length >= 17 && listing.every((s) => s.description.length > 0),
  `${listing.length} skills`);

// ---------- shuffle determinism ----------
const a1 = shuffledListing(listing, 'p1', 0).map((s) => s.id).join(',');
const a2 = shuffledListing(listing, 'p1', 0).map((s) => s.id).join(',');
const b = shuffledListing(listing, 'p1', 1).map((s) => s.id).join(',');
expect('same prompt+trial shuffles identically', a1 === a2);
expect('a different trial shuffles differently', a1 !== b);
expect('shuffle preserves the full skill set',
  [...shuffledListing(listing, 'p2', 0)].sort((x, y) => x.id.localeCompare(y.id)).map((s) => s.id).join(',')
  === [...listing].sort((x, y) => x.id.localeCompare(y.id)).map((s) => s.id).join(','));

// ---------- prompt composition ----------
const prompt = composePrompt(listing, 'Fix the deploy pipeline.');
expect('composed prompt contains every skill id',
  listing.every((s) => prompt.includes(`- ${s.id}:`)));
expect('composed prompt carries the request verbatim',
  prompt.includes('Fix the deploy pipeline.'));
expect('composed prompt permits a null answer', /null/.test(prompt) && /no installed skill|matches? no/i.test(prompt));

// ---------- reply parsing ----------
const ids = listing.map((s) => s.id);
expect('parser accepts a clean reply',
  parseReply('{"skill": "release-engineering", "alternatives": ["testing-strategy"]}', ids).skill === 'release-engineering');
expect('parser accepts prose around the JSON',
  parseReply('Sure! Here you go:\n{"skill": null, "alternatives": []}\nHope that helps.', ids).skill === null);
expect('parser flags an invented skill name instead of crediting it',
  parseReply('{"skill": "definitely-not-a-skill", "alternatives": []}', ids).parseError !== null);
expect('parser drops unknown names from alternatives',
  parseReply('{"skill": null, "alternatives": ["release-engineering", "made-up"]}', ids).alternatives.join(',') === 'release-engineering');
expect('parser survives junk output', parseReply('total garbage', ids).parseError !== null);

// ---------- scoring ----------
const ordered = shuffledListing(listing, 'p3', 0);
const hit = scoreTrial({ skill: 'frontend', alternatives: [] }, ['frontend'], ordered);
expect('a matching choice scores top1 and records its listing position',
  hit.top1 === true && hit.chosenPosition >= 1 && hit.chosenPosition <= listing.length);
expect('a distractor answered null scores nullCorrect',
  scoreTrial({ skill: null, alternatives: [] }, [], ordered).nullCorrect === true);
expect('a miss with the target in alternatives scores altHit not top1', (() => {
  const s = scoreTrial({ skill: 'code-smells', alternatives: ['frontend'] }, ['frontend'], ordered);
  return s.top1 === false && s.altHit === true;
})());

// ---------- prompt set integrity ----------
const promptSet = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'invocation', 'prompts.json'), 'utf8'));
const knownIds = new Set(ids);
expect('every expected skill in prompts.json exists',
  promptSet.prompts.every((p) => p.expected.every((s) => knownIds.has(s))));
expect('prompt ids are unique',
  new Set(promptSet.prompts.map((p) => p.id)).size === promptSet.prompts.length);
expect('the set contains distractors that expect null',
  promptSet.prompts.filter((p) => p.expected.length === 0).length >= 5);
expect('every skill is exercised by at least one prompt',
  ids.every((s) => promptSet.prompts.some((p) => p.expected.includes(s))));
