#!/usr/bin/env node
/**
 * Pixel-diff baseline vs candidate screenshots.
 *
 * Usage:
 *   node compare.mjs --baseline artifacts/reference --candidate artifacts/my-build [--threshold 0.02]
 */
import fs from 'fs';
import path from 'path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { ensureDir, parseArgs } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const threshold = args.threshold ?? 0.02;

if (!args.baseline || !args.candidate) {
  console.error('Usage: node compare.mjs --baseline <dir> --candidate <dir> [--threshold 0.02]');
  process.exit(1);
}

const diffDir = path.join(args.candidate, '..', 'diff', path.basename(args.candidate));
ensureDir(diffDir);

const baselineFiles = fs.readdirSync(args.baseline).filter((f) => f.endsWith('.png'));
const results = [];

for (const file of baselineFiles) {
  const basePath = path.join(args.baseline, file);
  const candPath = path.join(args.candidate, file);
  if (!fs.existsSync(candPath)) {
    results.push({ file, status: 'MISSING', diffRatio: 1 });
    continue;
  }

  const img1 = PNG.sync.read(fs.readFileSync(basePath));
  const img2 = PNG.sync.read(fs.readFileSync(candPath));

  if (img1.width !== img2.width || img1.height !== img2.height) {
    results.push({ file, status: 'SIZE_MISMATCH', diffRatio: 1, base: `${img1.width}x${img1.height}`, candidate: `${img2.width}x${img2.height}` });
    continue;
  }

  const diff = new PNG({ width: img1.width, height: img1.height });
  const diffPixels = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, { threshold: 0.1 });
  const diffRatio = diffPixels / (img1.width * img1.height);
  const diffPath = path.join(diffDir, file.replace('.png', '-diff.png'));
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  results.push({
    file,
    status: diffRatio <= threshold ? 'PASS' : 'FAIL',
    diffRatio: Math.round(diffRatio * 10000) / 10000,
    diffPixels,
    diffImage: path.relative(args.candidate, diffPath),
  });
}

const failed = results.filter((r) => r.status !== 'PASS');
const summary = {
  baseline: args.baseline,
  candidate: args.candidate,
  threshold,
  compared: results.length,
  passed: results.filter((r) => r.status === 'PASS').length,
  failed: failed.length,
  results,
};

const outPath = path.join(args.candidate, 'compare-summary.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');

console.log(`\ncompare: ${summary.passed}/${summary.compared} within threshold ${threshold}`);
for (const r of failed) {
  console.log(`  ${r.status} ${r.file} diffRatio=${r.diffRatio}`);
}
console.log(`\nWrote ${outPath}\n`);

process.exit(failed.length ? 1 : 0);
