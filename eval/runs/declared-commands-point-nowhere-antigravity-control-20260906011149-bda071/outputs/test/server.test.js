import { test, describe } from 'node:test';
import assert from 'node:assert';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/server.js');

describe('Ledger API Server', () => {
  test('GET /entries/:id returns entry details', async () => {
    const app = createApp();
    const server = app.listen(0);
    const address = server.address();
    const port = address.port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/entries/abc-123`);
      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.deepStrictEqual(data, { id: 'abc-123', amount: 0 });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
