import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

test('the schema creates both tables', () => {
  const sql = fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes('CREATE TABLE customers'));
  assert.ok(sql.includes('CREATE TABLE orders'));
});
