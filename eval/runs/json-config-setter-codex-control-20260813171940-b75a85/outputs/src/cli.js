#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const HELP = `Usage: config-set set [--dry-run] <json-file> <dotted-key> <json-value>

Set a nested value in a JSON file.

Arguments:
  <json-file>    JSON file to update
  <dotted-key>  Dot-separated object path, for example server.port
  <json-value>  A JSON value, for example 8080, true, or "production"

Options:
  --dry-run     Show the resulting JSON without writing the file
  -h, --help    Show this help message
`;

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  if (argv.includes('-h') || argv.includes('--help')) return { help: true };
  const args = argv.filter((arg) => arg !== '--dry-run');
  const dryRun = argv.length !== args.length;
  if (args.length !== 4 || args[0] !== 'set') {
    throw new Error('expected: set [--dry-run] <json-file> <dotted-key> <json-value>');
  }
  const key = args[2];
  if (!key || key.split('.').some((part) => part.length === 0)) {
    throw new Error('dotted-key must contain one or more non-empty key segments');
  }
  return { dryRun, file: args[1], key: key.split('.'), valueText: args[3] };
}

function writeAtomically(file, contents) {
  const directory = path.dirname(path.resolve(file));
  const base = path.basename(file);
  const temporary = path.join(directory, `.${base}.${process.pid}.${Date.now()}.tmp`);
  let mode;
  try {
    mode = fs.statSync(file).mode & 0o777;
    fs.writeFileSync(temporary, contents, { encoding: 'utf8', mode });
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (_) { /* best effort cleanup */ }
    throw error;
  }
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }

  let document;
  try {
    document = JSON.parse(fs.readFileSync(options.file, 'utf8'));
  } catch (error) {
    throw new Error(`could not read or parse ${options.file}: ${error.message}`);
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('the JSON document must be an object');
  }

  let value;
  try { value = JSON.parse(options.valueText); }
  catch (error) { throw new Error(`json-value is not valid JSON: ${error.message}`); }

  let target = document;
  for (let i = 0; i < options.key.length - 1; i += 1) {
    const segment = options.key[i];
    if (target[segment] === undefined) target[segment] = {};
    else if (target[segment] === null || typeof target[segment] !== 'object' || Array.isArray(target[segment])) {
      throw new Error(`cannot traverse non-object value at ${options.key.slice(0, i + 1).join('.')}`);
    }
    target = target[segment];
  }
  target[options.key[options.key.length - 1]] = value;

  const output = `${JSON.stringify(document, null, 2)}\n`;
  if (!options.dryRun) writeAtomically(options.file, output);
  process.stdout.write(output);
}

try { main(process.argv.slice(2)); }
catch (error) { fail(error.message); }

