#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { documentText } from './lib/doc-text.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The smallest of the three canonical pages reads about 9k characters of
// text. A page serving only its navigation comes in an order of magnitude
// under that.
const MIN_DOCUMENT_TEXT = 2000;
const offline = process.argv.includes('--offline');
const standards = readJson('core/marketplace-standards.json');
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const failures = [];

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

// The destination of an HTML meta-refresh, absolute, or '' when the page is
// not one. Only a redirect to somewhere else counts: a page may legitimately
// refresh to itself, and reporting that as a move would be a permanent
// failure nobody can fix.
//
// Exported so the test can feed it the stub Antigravity actually served,
// rather than asserting against this file's source text.
export function metaRefreshTarget(html, from) {
  const tag = /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/i.exec(html);
  if (!tag) return '';
  const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag[0]);
  const target = content && /url\s*=\s*(.+)$/i.exec(content[1].trim());
  if (!target) return '';
  const absolute = new URL(target[1].trim(), from).toString();
  return absolute === new URL(from).toString() ? '' : absolute;
}

function validateLocalPackages() {
  const manifests = [
    ['Claude', 'plugins/agent-skills/.claude-plugin/plugin.json'],
    // The root manifest is hand-maintained: gen-plugin-bundles.mjs writes the
    // copy under plugins/ and never touches this one. It held 1.0.0-alpha.22
    // through the renumbering to 0.3.0, after a full regeneration reported
    // success and this checker passed, and only a grep found it. A file that
    // nothing writes and nothing reads is exactly the one that goes stale.
    ['Claude (repository root)', '.claude-plugin/plugin.json'],
    ['Codex', 'plugins/agent-skills/.codex-plugin/plugin.json'],
    ['Cursor', 'plugins/agent-skills/.cursor-plugin/plugin.json'],
    ['Gemini', 'gemini-extension.json'],
  ];
  for (const [label, relative] of manifests) {
    const manifest = readJson(relative);
    requireValue(manifest.name === 'agent-skills', `${label}: name must be agent-skills`);
    requireValue(manifest.version === version, `${label}: version must match VERSION (${version})`);
  }

  const cursorMarket = readJson('.cursor-plugin/marketplace.json');
  requireValue(cursorMarket.plugins?.some((plugin) => plugin.name === 'agent-skills'),
    'Cursor: marketplace must expose agent-skills');
  const codexMarket = readJson('.agents/plugins/marketplace.json');
  const codexSource = codexMarket.plugins?.find((plugin) => plugin.name === 'agent-skills')?.source;
  requireValue(codexSource?.source === 'local' && codexSource?.path === './plugins/agent-skills',
    'Codex: marketplace must point to the generated local plugin');
}

async function validateCanonicalSources() {
  for (const schema of standards.schemas) {
    const response = await fetch(schema.url, { redirect: 'follow' });
    requireValue(response.ok, `${schema.id}: canonical schema returned HTTP ${response.status}`);
    if (!response.ok) continue;
    const body = Buffer.from(await response.arrayBuffer());
    const digest = crypto.createHash('sha256').update(body).digest('hex');
    requireValue(digest === schema.sha256,
      `${schema.id}: canonical schema changed (${digest}); review upstream and update generator/tests before accepting the new hash`);
  }

  for (const document of standards.documents) {
    const response = await fetch(document.url, { redirect: 'follow' });
    requireValue(response.ok, `${document.id}: canonical documentation returned HTTP ${response.status}`);
    if (!response.ok) continue;
    const html = await response.text();
    // A vendor that moves a page with an HTML meta-refresh answers 200 and
    // serves a stub, so `redirect: follow` has nothing to follow and the
    // length check below reports a client-rendered page. Antigravity did
    // exactly this to /docs/cli/plugins, and the job was red for five days
    // saying "98 characters of readable text; too little to check" when the
    // actionable fact was the new URL sitting in the stub. Say where it went.
    const moved = metaRefreshTarget(html, document.url);
    requireValue(!moved,
      `${document.id}: canonical documentation has moved to ${moved}; update core/marketplace-standards.json`);
    if (moved) continue;

    const text = documentText(html);
    // A page that renders its body client-side hands us navigation and
    // nothing else. That is not evidence the vendor dropped anything, so it
    // is reported as its own failure rather than as drift in every phrase.
    requireValue(text.length >= MIN_DOCUMENT_TEXT,
      `${document.id}: canonical documentation returned ${text.length} characters of readable text; too little to check`);
    if (text.length < MIN_DOCUMENT_TEXT) continue;
    const body = text.toLowerCase();
    for (const expected of document.requiredText) {
      requireValue(body.includes(expected.toLowerCase()),
        `${document.id}: canonical documentation no longer contains ${JSON.stringify(expected)}`);
    }
  }
}

// Guarded so the test can import metaRefreshTarget without running the whole
// check — which would hit the network and call process.exit inside the suite.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateLocalPackages();
  if (!offline) await validateCanonicalSources();

  if (failures.length) {
    console.error(failures.map((failure) => `FAIL ${failure}`).join('\n'));
    process.exit(1);
  }
  console.log(`Marketplace standards check passed (${offline ? 'offline package invariants' : 'package invariants and canonical-source drift'}).`);
}
