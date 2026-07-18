#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { validateJson } = require('../lib/validate-json-schema');

const SCHEMA_MAP = {
  'accept-check.js': 'product-acceptance-report.schema.json',
  'check-architecture.js': 'architecture-report.schema.json',
  'check-structure.js': 'eng-structure-report.schema.json',
  'check-backend.js': 'backend-report.schema.json',
  'classify-project.js': 'suite-profile.schema.json',
};

function main() {
  const reportPath = process.argv[2];
  const schemaArg = process.argv[3];
  if (!reportPath) {
    console.error('Usage: node validate-report.js <report.json> [schema-file]');
    process.exit(2);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const schemasDir = path.join(__dirname, '..', 'schemas');
  let schemaName = schemaArg;
  if (!schemaName) {
    schemaName = SCHEMA_MAP[report.generatedBy];
    if (!schemaName) {
      console.error(`No schema mapping for generatedBy=${report.generatedBy}`);
      process.exit(2);
    }
  }
  const schema = JSON.parse(fs.readFileSync(path.join(schemasDir, schemaName), 'utf8'));
  const errors = validateJson(report, schema);
  if (errors.length) {
    console.error(`INVALID ${reportPath}`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`ok   ${path.basename(reportPath)} ↔ ${schemaName}`);
}

main();
