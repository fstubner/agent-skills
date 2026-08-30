import http from 'node:http';

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};

function error(res, status, code, message) { json(res, status, { code, message }); }

export function createServer(options = {}) {
  // The in-memory store keeps the public constructor useful for tests and local development.
  // Production supplies a PostgreSQL pool through options.pool (or options.db).
  const pool = options.pool ?? options.db;
  const payments = new Map((options.payments ?? []).map((p) => [String(p.id), {
    id: String(p.id), owner: String(p.owner), amountCents: p.amountCents,
    refundedCents: p.refundedCents ?? 0,
  }]));
  const refunds = new Map();

  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { status: 'ok' });
    const match = req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (req.method !== 'POST' || !match) return error(res, 404, 'not_found', 'Not found');
    const account = /^Bearer\s+([^\s]+)$/.exec(req.headers.authorization ?? '')?.[1];
    const key = req.headers['idempotency-key'];
    if (!account) return error(res, 401, 'unauthorized', 'Bearer account authentication required');
    if (typeof key !== 'string' || key.length === 0 || key.length > 255) {
      return error(res, 400, 'invalid_idempotency_key', 'Idempotency-Key is required');
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    let input;
    try { input = JSON.parse(body || '{}'); } catch { return error(res, 400, 'invalid_json', 'Request body must be JSON'); }
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      return error(res, 400, 'invalid_amount', 'amountCents must be a positive integer');
    }
    const paymentId = decodeURIComponent(match[1]);
    try {
      if (pool) {
        // The transaction/query implementation is intentionally kept in the database adapter.
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const prior = await client.query('SELECT id, amount_cents FROM refunds WHERE payment_id = $1 AND idempotency_key = $2 FOR SHARE', [paymentId, key]);
          if (prior.rows[0]) { await client.query('COMMIT'); return json(res, 201, prior.rows[0]); }
          const result = await client.query(`INSERT INTO refunds (payment_id, owner, amount_cents, idempotency_key)
            SELECT p.id, p.owner, $3, $2 FROM payments p
            WHERE p.id = $1 AND p.owner = $4
              AND p.amount_cents - COALESCE(p.refunded_cents, 0) >= $3
            FOR UPDATE OF p
            RETURNING id, payment_id, amount_cents`, [paymentId, key, input.amountCents, account]);
          if (!result.rows[0]) { await client.query('ROLLBACK'); return error(res, 404, 'not_found', 'Payment not found'); }
          await client.query('UPDATE payments SET refunded_cents = refunded_cents + $1 WHERE id = $2', [input.amountCents, paymentId]);
          await client.query('COMMIT'); return json(res, 201, result.rows[0]);
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
      }
      const prior = refunds.get(`${paymentId}:${key}`);
      if (prior) return json(res, 201, prior);
      const payment = payments.get(paymentId);
      if (!payment || payment.owner !== account || payment.amountCents - payment.refundedCents < input.amountCents) {
        return error(res, 404, 'not_found', 'Payment not found');
      }
      const refund = { id: `refund_${refunds.size + 1}`, paymentId, amountCents: input.amountCents };
      payment.refundedCents += input.amountCents;
      refunds.set(`${paymentId}:${key}`, refund);
      return json(res, 201, refund);
    } catch (e) {
      console.error(JSON.stringify({ event: 'refund_failed', error: e.message }));
      return error(res, 500, 'internal_error', 'Internal server error');
    }
  });
}
