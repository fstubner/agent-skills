import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['src/main.js'], { stdio: 'inherit' });
process.on('SIGTERM', () => {
  child.kill('SIGKILL');
  process.exit(0);
});
