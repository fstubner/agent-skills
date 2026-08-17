#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VERSION = '1.0.0';

function help() {
  return `Usage:
  config-set set [--dry-run] <json-file> <dotted-key> <json-value>
  config-set --help
  config-set --version

Set a nested value in a JSON file.

Arguments:
  <json-file>   JSON file to update
  <dotted-key>  Nested property path, for example service.retries
  <json-value>  JSON value, for example 3, true, null, or "fast"

Options:
  --dry-run     Show the result without writing the file
  --            Treat remaining arguments as positional values
  --help, -h    Show this help
  --version     Show the version
`;
}

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = code;
}

function atomicWrite(file, content) {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, content, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function main(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(help());
    return;
  }
  if (argv.length === 1 && argv[0] === '--version') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  let dryRun = false;
  const args = [];
  let positionalOnly = false;
  for (const arg of argv) {
    if (arg === '--') {
      positionalOnly = true;
      continue;
    }
    if (!positionalOnly && arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (!positionalOnly && arg.startsWith('-')) {
      throw new Error(`unknown option '${arg}' (see --help)`);
    }
    args.push(arg);
  }
  if (args.length !== 4 || args[0] !== 'set') {
    throw new Error('expected: set [--dry-run] <json-file> <dotted-key> <json-value> (see --help)');
  }

  const [, file, dottedKey, rawValue] = args;
  if (!dottedKey || dottedKey.split('.').some((part) => part.length === 0)) {
    throw new Error('dotted-key must contain non-empty property names');
  }

  let document;
  try {
    document = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read or parse '${file}': ${error.message}`);
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error(`'${file}' must contain a JSON object at the root`);
  }

  let value;
  try { value = JSON.parse(rawValue); } catch (error) {
    throw new Error(`json-value is invalid JSON: ${error.message}`);
  }

  const keys = dottedKey.split('.');
  let target = document;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (target[key] === undefined) target[key] = {};
    else if (target[key] === null || typeof target[key] !== 'object' || Array.isArray(target[key])) {
      throw new Error(`cannot descend through '${keys.slice(0, i + 1).join('.')}'`);
    }
    target = target[key];
  }
  const leaf = keys[keys.length - 1];
  const changed = JSON.stringify(target[leaf]) !== JSON.stringify(value);
  target[leaf] = value;
  const content = `${JSON.stringify(document, null, 2)}\n`;
  if (changed && !dryRun) atomicWrite(file, content);
  process.stdout.write(`${JSON.stringify({ file, key: dottedKey, value, changed, dryRun })}\n`);
}

try { main(process.argv.slice(2)); }
catch (error) { fail(error.message); }
