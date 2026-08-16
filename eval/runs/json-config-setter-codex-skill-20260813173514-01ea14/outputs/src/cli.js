#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const VERSION = '1.0.0';

function usage() {
  return `Usage:
  config-set set <json-file> <dotted-key> <json-value> [--dry-run]

Set a JSON value at a dotted path in a JSON file.

Options:
  --dry-run   Show the resulting JSON without changing the file
  --help      Show this help text
  --version   Show the CLI version

Examples:
  config-set set config.json database.host '"localhost"'
  config-set set config.json features.enabled true --dry-run

The JSON value must be valid JSON. Results are written to stdout; errors are
written to stderr. Repeating an identical set is safe and reports changed:false.
`;
}

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = code;
}

function parseArgs(argv) {
  const args = [];
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--') args.push(...argv.slice(argv.indexOf(arg) + 1));
    else if (arg.startsWith('--')) throw new Error(`unknown option: ${arg}`);
    else args.push(arg);
  }
  return { args, dryRun };
}

function setDottedValue(document, dottedKey, value) {
  const parts = dottedKey.split('.');
  if (!parts.length || parts.some(part => !part)) {
    throw new Error('dotted-key must contain non-empty key segments');
  }
  let cursor = document;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
      throw new Error(`cannot traverse ${parts.slice(0, i + 1).join('.')}: expected an object`);
    }
    if (!(key in cursor)) cursor[key] = {};
    else if (cursor[key] === null || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      throw new Error(`cannot traverse ${parts.slice(0, i + 1).join('.')}: expected an object`);
    }
    cursor = cursor[key];
  }
  if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
    throw new Error('cannot set value: expected an object');
  }
  const leaf = parts[parts.length - 1];
  const changed = !Object.prototype.hasOwnProperty.call(cursor, leaf) ||
    JSON.stringify(cursor[leaf]) !== JSON.stringify(value);
  cursor[leaf] = value;
  return changed;
}

function writeAtomically(filename, content, mode) {
  const directory = path.dirname(filename);
  const temporary = path.join(directory, `.${path.basename(filename)}.${process.pid}.${Date.now()}.tmp`);
  let handle;
  try {
    handle = fs.openSync(temporary, 'wx', mode);
    fs.writeFileSync(handle, content, 'utf8');
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;
    fs.renameSync(temporary, filename);
    const dirHandle = fs.openSync(directory, 'r');
    try { fs.fsyncSync(dirHandle); } finally { fs.closeSync(dirHandle); }
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function main() {
  const raw = process.argv.slice(2);
  if (raw.length === 0 || raw.includes('--help')) {
    process.stdout.write(usage());
    return;
  }
  if (raw.includes('--version')) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  const { args, dryRun } = parseArgs(raw);
  if (args.length !== 4 || args[0] !== 'config-set' || args[1] !== 'set') {
    throw new Error('expected: config-set set <json-file> <dotted-key> <json-value>');
  }
  const filename = path.resolve(args[2]);
  let document;
  try { document = JSON.parse(fs.readFileSync(filename, 'utf8')); }
  catch (error) { throw new Error(`could not read or parse ${args[2]}: ${error.message}`); }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('JSON document root must be an object');
  }
  let value;
  try { value = JSON.parse(args[3]); }
  catch (error) { throw new Error(`json-value is not valid JSON: ${error.message}`); }
  const changed = setDottedValue(document, args[3 - 1], value);
  const output = `${JSON.stringify(document, null, 2)}\n`;
  if (changed && !dryRun) writeAtomically(filename, output, fs.statSync(filename).mode & 0o777);
  process.stdout.write(JSON.stringify({ file: args[2], key: args[3 - 1], changed, dryRun, content: document }) + '\n');
}

try { main(); } catch (error) { fail(error.message); }
