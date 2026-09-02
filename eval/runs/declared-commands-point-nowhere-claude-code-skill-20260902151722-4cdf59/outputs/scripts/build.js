import { createApp } from '../src/server.js';

// Validate that the app can be created
const app = createApp();

if (!app) {
  console.error('Failed to create app');
  process.exit(1);
}

console.log('Build successful: app can be created');
