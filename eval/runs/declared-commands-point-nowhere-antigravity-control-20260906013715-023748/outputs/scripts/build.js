process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/server.js');
const { createApp: createAppIndex } = await import('../src/index.js');

if (typeof createApp !== 'function' || typeof createAppIndex !== 'function') {
  console.error('Build failed: createApp function is missing.');
  process.exit(1);
}

console.log('Build completed successfully.');
