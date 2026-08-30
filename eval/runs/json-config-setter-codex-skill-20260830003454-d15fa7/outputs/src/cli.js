#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const USAGE = `Usage:
  config-set set <json-file> <dotted-key> <json-value> [--dry-run]
  config-set --help

Set a nested value in a JSON file.

Arguments:
  <json-file>    JSON file to update
  <dotted-key>   Dot-separated path, for example service.retries
  <json-value>   A JSON value, for example 3, true, or "fast"

Options:
  --dry-run      Show the result without writing the file
  --help         Show this help text

Use -- before positional arguments when a value starts with '-'.`;

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

function parseArguments(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${USAGE}\n`);
    return null;
  }

  if (argv[0] !== 'set') throw new Error('expected the "set" command; use --help for usage');

  const positional = [];
  let dryRun = false;
  let separator = false;
  for (const arg of argv.slice(1)) {
    if (separator) positional.push(arg);
    else if (arg === '--') separator = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('-')) throw new Error(`unknown option "${arg}"; use --help for usage`);
    else positional.push(arg);
  }
  if (positional.length !== 3) throw new Error('expected <json-file> <dotted-key> <json-value>; use --help for usage');
  return { file: positional[0], key: positional[1], rawValue: positional[2], dryRun };
}

function setNested(root, dottedKey, value) {
  const parts = dottedKey.split('.');
  if (parts.some((part) => !part || part === '__proto__' || part === 'prototype' || part === 'constructor')) {
    throw new Error('dotted-key must contain non-empty, safe property names');
  }
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (cursor[part] === undefined) cursor[part] = {};
    else if (cursor[part] === null || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
      throw new Error(`cannot descend through non-object property "${parts.slice(0, i + 1).join('.')}"`);
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function writeAtomically(file, contents) {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, contents, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (_) { /* already absent */ }
    throw error;
  }
}

function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (!parsed) return;
  const absoluteFile = path.resolve(parsed.file);
  let original;
  try {
    original = JSON.parse(fs.readFileSync(absoluteFile, 'utf8'));
  } catch (error) {
    throw new Error(`could not read or parse ${parsed.file}: ${error.message}`);
  }
  if (original === null || typeof original !== 'object' || Array.isArray(original)) {
    throw new Error('the JSON document must contain an object at its root');
  }
  let value;
  try { value = JSON.parse(parsed.rawValue); } catch (error) {
    throw new Error(`invalid JSON value: ${error.message}`);
  }
  const updated = JSON.parse(JSON.stringify(original));
  setNested(updated, parsed.key, value);
  const contents = `${JSON.stringify(updated, null, 2)}\n`;
  const changed = contents !== fs.readFileSync(absoluteFile, 'utf8');
  if (changed && !parsed.dryRun) writeAtomically(absoluteFile, contents);
  process.stdout.write(`${JSON.stringify({ file: parsed.file, key: parsed.key, value, changed, dryRun: parsed.dryRun })}\n`);
}

try { main(); } catch (error) { fail(error.message); }
