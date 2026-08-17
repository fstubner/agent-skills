#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const HELP = `Usage:
  config-set set [--dry-run] <json-file> <dotted-key> <json-value>

Update a nested JSON value atomically. The JSON value must be valid JSON.

Options:
  --dry-run  Print the resulting JSON without writing the file
  -h, --help Show this help
`;

function fail(message, code = 2) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = code;
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    if (argv.includes('-h') || argv.includes('--help') || argv.length === 0) {
      process.stdout.write(HELP);
      return null;
    }
  }
  if (argv[0] !== 'set') throw new Error('expected command "set"');
  let dryRun = false;
  const args = [];
  for (const arg of argv.slice(1)) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    else args.push(arg);
  }
  if (args.length !== 3) throw new Error('expected <json-file> <dotted-key> <json-value>');
  return { dryRun, file: args[0], key: args[1], rawValue: args[2] };
}

function parseKey(key) {
  const parts = key.split('.');
  if (!key || parts.some((part) => !part || part === '__proto__' || part === 'prototype' || part === 'constructor')) {
    throw new Error('dotted-key must contain non-empty, safe property names');
  }
  return parts;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function atomicWrite(file, text, mode) {
  const dir = path.dirname(path.resolve(file));
  const base = path.basename(file);
  const temp = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
  let handle;
  try {
    handle = await fsp.open(temp, 'wx', mode);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fsp.rename(temp, file);
    const dirHandle = await fsp.open(dir, 'r');
    try { await dirHandle.sync(); } finally { await dirHandle.close(); }
  } finally {
    if (handle) await handle.close().catch(() => {});
    await fsp.unlink(temp).catch(() => {});
  }
}

async function main(argv) {
  const options = parseArgs(argv);
  if (!options) return;
  const parts = parseKey(options.key);
  let value;
  try { value = JSON.parse(options.rawValue); }
  catch { throw new Error('json-value is not valid JSON'); }

  const originalText = await fsp.readFile(options.file, 'utf8');
  let config;
  try { config = JSON.parse(originalText); }
  catch { throw new Error('input file does not contain valid JSON'); }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('input JSON must be an object');
  }

  let target = config;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (target[part] === undefined) target[part] = {};
    else if (target[part] === null || typeof target[part] !== 'object' || Array.isArray(target[part])) {
      throw new Error(`cannot traverse non-object key: ${parts.slice(0, i + 1).join('.')}`);
    }
    target = target[part];
  }
  const leaf = parts[parts.length - 1];
  const changed = !Object.prototype.hasOwnProperty.call(target, leaf) || !sameJson(target[leaf], value);
  target[leaf] = value;
  const outputText = `${JSON.stringify(config, null, 2)}\n`;
  if (changed && !options.dryRun) {
    const stat = await fsp.stat(options.file);
    await atomicWrite(options.file, outputText, stat.mode & 0o7777);
  }
  process.stdout.write(JSON.stringify({ file: options.file, key: options.key, value, changed, dryRun: options.dryRun, config }) + '\n');
}

main(process.argv.slice(2)).catch((error) => fail(error.message));

