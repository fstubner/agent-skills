import { createApp } from '../src/server.js';

console.log('Building Ledger API...');

// Verify the app can be created
try {
  const app = createApp();
  console.log('✓ App initialized successfully');
  console.log('✓ Build complete');
} catch (error) {
  console.error('✗ Build failed:', error.message);
  process.exit(1);
}
