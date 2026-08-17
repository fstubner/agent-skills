import { mkdir, cp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
await mkdir('dist', { recursive: true });
await cp('src', 'dist/src', { recursive: true });
await cp('migrations', 'dist/migrations', { recursive: true });
await cp('package.json', 'dist/package.json');
await exec('tar', ['--sort=name', '--mtime=UTC 1970-01-01', '--owner=0', '--group=0', '--numeric-owner', '-czf', 'dist/refund-ledger.tar.gz', '-C', 'dist', 'src', 'migrations', 'package.json']);
const data = await import('node:fs/promises').then(fs => fs.readFile('dist/refund-ledger.tar.gz'));
await writeFile('dist/refund-ledger.sha256', `${createHash('sha256').update(data).digest('hex')}  refund-ledger.tar.gz\n`);
