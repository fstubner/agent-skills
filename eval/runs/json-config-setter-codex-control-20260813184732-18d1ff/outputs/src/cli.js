#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const HELP = `Usage:
  config-set set [--dry-run] <json-file> <dotted-key> <json-value>

Update a nested value in a JSON file.

Options:
  --dry-run   Validate and show the result without writing the file
  -h, --help  Show this help

Arguments:
  <json-file>   Path to the JSON file to update
  <dotted-key>  Dot-separated object key (for example, server.port)
  <json-value>  A JSON value (for example, 8080, true, or "prod")
`;

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  if (argv.includes('-h') || argv.includes('--help')) return { help: true };
  const args = argv.filter((arg) => arg !== '--dry-run');
  const dryRun = argv.includes('--dry-run');
  if (args.length !== 4 || args[0] !== 'set') {
    throw new Error('expected: set [--dry-run] <json-file> <dotted-key> <json-value>');
  }
  if (!args[2]) throw new Error('dotted-key must not be empty');
  return { file: args[1], key: args[2], valueText: args[3], dryRun };
}

function setNested(document, dottedKey, value) {
  const parts = dottedKey.split('.');
  if (parts.some((part) => part.length === 0)) throw new Error('dotted-key cannot contain empty segments');
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('the JSON document root must be an object');
  }
  let target = document;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (target[part] === undefined) target[part] = {};
    else if (target[part] === null || typeof target[part] !== 'object' || Array.isArray(target[part])) {
      throw new Error(`cannot descend through non-object key '${parts.slice(0, i + 1).join('.')}'`);
    }
    target = target[part];
  }
  target[parts[parts.length - 1]] = value;
}

function writeAtomically(file, text, mode) {
  const directory = path.dirname(path.resolve(file));
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, text, { mode });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (_) { /* best effort cleanup */ }
    throw error;
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(HELP);
      return;
    }
    const original = fs.readFileSync(options.file, 'utf8');
    let document;
    try { document = JSON.parse(original); } catch (error) { throw new Error(`invalid JSON: ${error.message}`); }
    let value;
    try { value = JSON.parse(options.valueText); } catch (error) { throw new Error(`json-value is not valid JSON: ${error.message}`); }
    setNested(document, options.key, value);
    const output = `${JSON.stringify(document, null, 2)}\n`;
    if (!options.dryRun) writeAtomically(options.file, output, fs.statSync(options.file).mode);
    process.stdout.write(output);
  } catch (error) {
    fail(error.message);
  }
}

main();
