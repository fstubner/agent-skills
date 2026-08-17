#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

function validateLocalPackages() {
  const manifests = [
    ['Claude', 'plugins/agent-skills/.claude-plugin/plugin.json'],
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
    const body = (await response.text()).toLowerCase();
    for (const expected of document.requiredText) {
      requireValue(body.includes(expected.toLowerCase()),
        `${document.id}: canonical documentation no longer contains ${JSON.stringify(expected)}`);
    }
  }
}

validateLocalPackages();
if (!offline) await validateCanonicalSources();

if (failures.length) {
  console.error(failures.map((failure) => `FAIL ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`Marketplace standards check passed (${offline ? 'offline package invariants' : 'package invariants and canonical-source drift'}).`);
