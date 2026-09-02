import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { createApp } from '../src/server.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('GET /entries/:id returns entry with id and amount fields', (t, done) => {
  const app = createApp();
  const server = app.listen(0, () => {
    const addr = server.address();
    const url = `http://localhost:${addr.port}/entries/123`;

    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        assert.equal(res.statusCode, 200, 'status should be 200');
        const data = JSON.parse(body);
        assert.equal(data.id, '123', 'id should match request param');
        assert(typeof data.amount === 'number', 'amount should be a number');
        server.close();
        done();
      });
    }).on('error', (err) => {
      server.close();
      throw err;
    });
  });
});
