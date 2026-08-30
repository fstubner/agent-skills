#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const HELP = `Usage:
  config-set set <json-file> <dotted-key> <json-value> [--dry-run]

Update a nested value in a JSON file.

Options:
  --dry-run  Show the result without writing the file
  --help     Show this help

<json-value> must be valid JSON (for example: 3, true, null, or "text").
`;

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = code;
}

function usage() {
  process.stdout.write(HELP);
}

function setAt(root, dottedKey, value) {
  const parts = dottedKey.split('.');
  let current = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (current[part] === null || typeof current[part] !== 'object' || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function writeAtomically(filename, contents) {
  const directory = path.dirname(filename);
  const temporary = path.join(directory, `.${path.basename(filename)}.${process.pid}.${Date.now()}.tmp`);
  try {
    const mode = fs.statSync(filename).mode;
    const fd = fs.openSync(temporary, 'wx', mode);
    try {
      fs.writeFileSync(fd, contents, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, filename);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (_) { /* best effort cleanup */ }
    throw error;
  }
}

function main(argv) {
  if (argv.length === 0 || argv.includes('--help')) {
    usage();
    return;
  }

  const dryRun = argv.includes('--dry-run');
  const positional = argv.filter((arg) => arg !== '--dry-run');
  if (positional.length !== 5 || positional[0] !== 'config-set' || positional[1] !== 'set') {
    throw new Error('expected: config-set set <json-file> <dotted-key> <json-value> [--dry-run] (use --help for usage)');
  }

  const [, , filename, dottedKey, rawValue] = positional;
  if (!dottedKey || dottedKey.split('.').some((part) => !part)) throw new Error('dotted-key must not be empty or contain empty segments');

  let document;
  try { document = JSON.parse(fs.readFileSync(filename, 'utf8')); }
  catch (error) { throw new Error(`cannot read or parse ${filename}: ${error.message}`); }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) throw new Error('JSON file must contain an object at its root');

  let value;
  try { value = JSON.parse(rawValue); }
  catch (error) { throw new Error(`json-value is not valid JSON: ${error.message}`); }
  setAt(document, dottedKey, value);
  const output = `${JSON.stringify(document, null, 2)}\n`;
  if (!dryRun) writeAtomically(filename, output);
  process.stdout.write(`${JSON.stringify({ file: filename, key: dottedKey, value, dryRun })}\n`);
}

try { main(process.argv.slice(2)); }
catch (error) { fail(error.message); }
