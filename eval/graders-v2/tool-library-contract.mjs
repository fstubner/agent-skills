#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootIndex = process.argv.indexOf('--root');
const root = rootIndex < 0 ? null : path.resolve(process.argv[rootIndex + 1] || '');
if (!root) process.exit(2);
const productPath = path.join(root, 'PRODUCT.md');
const text = fs.existsSync(productPath) ? fs.readFileSync(productPath, 'utf8') : '';
const section = (name) => text.match(new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s+|$)`, 'im'))?.[1] || '';
const assertions = [];
const add = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence: evidence || 'section missing or empty' });

const headings = ['Purpose', 'Users', 'Success', 'MVP', 'Constraints'];
add('required-headings', headings.every((heading) => new RegExp(`^##\\s+${heading}\\s*$`, 'im').test(text)), `required=${headings.join(', ')}`);
const success = section('Success');
add('observable-success', /resident\s+can\s+request\s+(?:an\s+)?available\s+(?:item|tool)/i.test(success)
  && !/\b(delightful|intuitive|seamless|engaging|robust|modern|powerful)\b/i.test(success), success.trim());
const mvpCount = (section('MVP').match(/^\s*[-*+]\s+/gm) || []).length;
add('bounded-mvp', mvpCount >= 3 && mvpCount <= 7, `bullets=${mvpCount}`);
const antiGoals = section('Anti-goals').toLowerCase();
add('scope-cut', ['payment', 'delivery', 'public browsing'].every((term) => antiGoals.includes(term)), antiGoals);
const constraints = section('Constraints');
add('no-fabrication', /\b(web|one month|eu|european union|tbd)\b/i.test(constraints)
  && !/\b(react|vue|angular|svelte|next\.?js|postgres|mysql|sqlite|mongodb|aws|azure|gcp|cloudflare|vercel|gdpr|iso\s*27001|soc\s*2|sla|\d+\s*(?:users?|requests?\/s|% uptime))\b/i.test(constraints), constraints.trim());

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'tool-library-contract', assertions }, null, 2));
process.exit(assertions.some((assertion) => assertion.status === 'fail') ? 1 : 0);
