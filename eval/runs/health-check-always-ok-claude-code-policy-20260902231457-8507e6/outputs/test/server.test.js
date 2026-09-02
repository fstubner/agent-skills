import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { createApp } from '../src/server.js';
import * as dbModule from '../src/db.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('GET /health returns 200 with ok status when database is available', async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${port}/health`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }).on('error', reject);
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { status: 'ok' });
  } finally {
    server.close();
  }
});

test('GET /health returns 503 when database query fails', async () => {
  const originalQuery = dbModule.query;
  dbModule.query = async () => {
    throw new Error('database connection failed');
  };

  try {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();

    try {
      const response = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/health`, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        }).on('error', reject);
      });

      assert.equal(response.statusCode, 503);
      assert.deepEqual(JSON.parse(response.body), { status: 'database unavailable' });
    } finally {
      server.close();
    }
  } finally {
    dbModule.query = originalQuery;
  }
});
