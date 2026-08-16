#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const VERSION = '1.0.0';

function usage() {
  return `Usage:
  config-set set <json-file> <dotted-key> <json-value> [--dry-run]

Update a nested value in a JSON file.

Arguments:
  <json-file>    JSON file to update
  <dotted-key>   Nested key path, for example server.port
  <json-value>   Value encoded as JSON (for example 8080 or "production")

Options:
  --dry-run      Show the result without writing the file
  -h, --help     Show this help text
  -v, --version  Show the version

Examples:
  config-set set config.json server.port 8080
  config-set set config.json features.beta true --dry-run
`;
}

function fail(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = code;
}

function parseArgs(argv) {
  const args = [...argv];
  let dryRun = false;
  const positional = [];
  let positionalOnly = false;
  for (const arg of args) {
    if (positionalOnly) { positional.push(arg); continue; }
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--') positionalOnly = true;
    else if (arg === '-h' || arg === '--help') return { help: true };
    else if (arg === '-v' || arg === '--version') return { version: true };
    else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    else positional.push(arg);
  }
  return { dryRun, positional };
}

function setDottedValue(root, key, value) {
  const parts = key.split('.');
  if (parts.some((part) => part.length === 0)) throw new Error('dotted-key must not contain empty segments');
  let current = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      throw new Error(`cannot descend through ${parts.slice(0, i).join('.') || 'the JSON root'}`);
    }
    if (!Object.prototype.hasOwnProperty.call(current, part)) current[part] = {};
    current = current[part];
  }
  if (current === null || typeof current !== 'object' || Array.isArray(current)) {
    throw new Error(`cannot set ${key}: its parent is not an object`);
  }
  const leaf = parts[parts.length - 1];
  const changed = !Object.prototype.hasOwnProperty.call(current, leaf)
    || JSON.stringify(current[leaf]) !== JSON.stringify(value);
  current[leaf] = value;
  return changed;
}

async function atomicWrite(filename, contents, mode) {
  const directory = path.dirname(filename);
  const basename = path.basename(filename);
  let temporary;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = path.join(directory, `.${basename}.${process.pid}.${Date.now()}.${attempt}.tmp`);
    try {
      const handle = await fsp.open(candidate, 'wx', mode);
      temporary = candidate;
      try {
        await handle.writeFile(contents, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fsp.rename(temporary, filename);
      temporary = undefined;
      return;
    } catch (error) {
      if (temporary) await fsp.unlink(temporary).catch(() => {});
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('could not create a temporary file for atomic update');
}

async function main(argv) {
  const parsed = parseArgs(argv);
  if (parsed.help) { process.stdout.write(usage()); return; }
  if (parsed.version) { process.stdout.write(`${VERSION}\n`); return; }
  if (argv.length === 0) { process.stdout.write(usage()); return; }
  const [command, filename, key, rawValue] = parsed.positional;
  if (command !== 'set' || !filename || !key || rawValue === undefined || parsed.positional.length !== 4) {
    throw new Error('expected: set <json-file> <dotted-key> <json-value> (use --help for usage)');
  }
  let document;
  try { document = JSON.parse(await fsp.readFile(filename, 'utf8')); }
  catch (error) { throw new Error(`cannot read or parse ${filename}: ${error.message}`); }
  let value;
  try { value = JSON.parse(rawValue); }
  catch (error) { throw new Error(`json-value is not valid JSON: ${error.message}`); }
  const changed = setDottedValue(document, key, value);
  const output = `${JSON.stringify(document, null, 2)}\n`;
  if (changed && !parsed.dryRun) {
    const stat = await fsp.stat(filename);
    await atomicWrite(filename, output, stat.mode & 0o7777);
  }
  process.stdout.write(`${JSON.stringify({ file: filename, key, value, changed, dryRun: parsed.dryRun })}\n`);
}

main(process.argv.slice(2)).catch((error) => fail(error.message));
