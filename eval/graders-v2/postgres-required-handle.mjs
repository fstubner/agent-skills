#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const rootArg = process.argv.indexOf('--root');
const workspace = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : null;
if (!workspace || !fs.existsSync(workspace)) {
  console.error('usage: node postgres-required-handle.mjs --root <workspace>');
  process.exit(2);
}
const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationDir = path.join(workspace, 'migrations');
const files = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((f) => /^\d+.*\.sql$/i.test(f) && f !== '001_create_accounts.sql').sort()
  : [];
const sql = files.map((f) => fs.readFileSync(path.join(migrationDir, f), 'utf8')).join('\n');
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });

const checker = spawnSync(process.execPath,
  [path.join(suiteRoot, 'data-modeling', 'scripts', 'check-migrations.js'), '--root', workspace, '--no-write'],
  { encoding: 'utf8', timeout: 30_000 });
let checkerReport = null;
try { checkerReport = JSON.parse(checker.stdout); } catch { /* recorded below */ }
record('additive-rollout', files.length > 0 && checkerReport?.checks.find((c) => c.id === 'DM-sql-destructive-drop')?.status === 'pass' && !/\b(?:DROP|RENAME)\b/i.test(sql),
  `files=${files.join(',') || 'none'}; checker=${checkerReport?.verdict || 'unparseable'}; DROP/RENAME=${/\b(?:DROP|RENAME)\b/i.test(sql)}`);
record('required-without-scan', checkerReport?.checks.find((c) => c.id === 'DM-sql-unsafe-not-null')?.status === 'pass' && /CHECK\s*\(\s*handle\s+IS\s+NOT\s+NULL\s*\)[\s\S]*NOT\s+VALID/i.test(sql) && /VALIDATE\s+CONSTRAINT/i.test(sql) && /ALTER\s+COLUMN\s+handle\s+SET\s+NOT\s+NULL/i.test(sql),
  `unsafe-not-null=${checkerReport?.checks.find((c) => c.id === 'DM-sql-unsafe-not-null')?.status || 'missing'}; matching safe sequence=${/CHECK\s*\(\s*handle\s+IS\s+NOT\s+NULL\s*\)[\s\S]*NOT\s+VALID/i.test(sql)}`);
record('backfill', /UPDATE\s+accounts[\s\S]*SET\s+handle\s*=/i.test(sql) && /username/i.test(sql),
  `UPDATE accounts from username=${/UPDATE\s+accounts[\s\S]*SET\s+handle\s*=[\s\S]*username/i.test(sql)}`);
record('unique-handle', /(?:UNIQUE\s*\(\s*handle\s*\)|CREATE\s+UNIQUE\s+INDEX[\s\S]*\bhandle\b)/i.test(sql),
  `unique handle constraint/index=${/(?:UNIQUE\s*\(\s*handle\s*\)|CREATE\s+UNIQUE\s+INDEX[\s\S]*\bhandle\b)/i.test(sql)}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'postgres-required-handle', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
