#!/usr/bin/env node
import http from 'http';
import https from 'https';

const url = process.argv[2] || 'http://localhost:3000';
const maxRetries = 10;
const retryDelay = 1000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function smokeTest() {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);
        const options = {
          hostname: urlObj.hostname,
          port,
          path: '/entries/smoke',
          method: 'GET',
          timeout: 5000,
        };

        const req = protocol.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            } else {
              resolve(JSON.parse(data));
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.end();
      });

      if (response && response.id && response.amount === 0) {
        console.log('✓ Service is healthy');
        process.exit(0);
      } else {
        throw new Error('Invalid response structure');
      }
    } catch (err) {
      if (i < maxRetries - 1) {
        console.log(`Attempt ${i + 1}/${maxRetries} failed: ${err.message}. Retrying in ${retryDelay}ms...`);
        await sleep(retryDelay);
      } else {
        console.error(`✗ Smoke test failed after ${maxRetries} attempts: ${err.message}`);
        process.exit(1);
      }
    }
  }
}

smokeTest();
