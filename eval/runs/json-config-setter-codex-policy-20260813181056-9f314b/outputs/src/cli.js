#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function usage() {
  return `Usage: config-set set [--dry-run] <json-file> <dotted-key> <json-value>

Set a nested value in a JSON file.

Options:
  --dry-run  Validate and show the result without writing the file
  -h, --help Show this help
`;
}

function fail(message) {
  throw new Error(message);
}

function setNestedValue(document, dottedKey, value) {
  const parts = dottedKey.split('.');
  if (!dottedKey || parts.some(part => !part)) fail('dotted-key must contain non-empty segments');
  let target = document;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (target === null || typeof target !== 'object' || Array.isArray(target)) {
      fail(`cannot traverse ${parts.slice(0, i + 1).join('.')}`);
    }
    if (!Object.prototype.hasOwnProperty.call(target, key)) target[key] = {};
    else if (target[key] === null || typeof target[key] !== 'object' || Array.isArray(target[key])) {
      fail(`cannot traverse ${parts.slice(0, i + 1).join('.')}`);
    }
    target = target[key];
  }
  if (target === null || typeof target !== 'object' || Array.isArray(target)) fail('cannot set a value on a non-object');
  target[parts[parts.length - 1]] = value;
}

function atomicWrite(file, contents, mode) {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, contents, { encoding: 'utf8', mode });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function main(argv) {
  if (argv.includes('-h') || argv.includes('--help') || argv.length === 0) {
    process.stdout.write(usage());
    return;
  }
  let dryRun = false;
  const args = argv.filter(arg => {
    if (arg === '--dry-run') { dryRun = true; return false; }
    return true;
  });
  if (args.length !== 4 || args[0] !== 'set') fail('expected: set [--dry-run] <json-file> <dotted-key> <json-value>');
  const file = path.resolve(args[1]);
  let document;
  let value;
  try { document = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`could not read or parse ${args[1]}: ${error.message}`); }
  try { value = JSON.parse(args[3]); }
  catch (error) { fail(`json-value is not valid JSON: ${error.message}`); }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) fail('JSON file must contain an object');
  setNestedValue(document, args[2], value);
  const output = `${JSON.stringify(document, null, 2)}\n`;
  if (!dryRun) atomicWrite(file, output, fs.statSync(file).mode & 0o777);
  process.stdout.write(output);
}

try { main(process.argv.slice(2)); }
catch (error) { process.stderr.write(`config-set: ${error.message}\n`); process.exitCode = 1; }

module.exports = { setNestedValue };
