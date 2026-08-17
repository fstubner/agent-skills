import http from 'node:http';

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function accountFrom(req) {
  const value = req.headers.authorization;
  if (!value?.startsWith('Bearer ') || !value.slice(7).trim()) return null;
  return value.slice(7).trim();
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (raw.length > 10000) throw new Error('too_large');
  return JSON.parse(raw || '{}');
}

export function createServer(options = {}) {
  const configuredPayments = Array.isArray(options.payments) ? options.payments : (options.payments ? [options.payments] : []);
  const payments = new Map(configuredPayments.map((p) => [String(p.id), { ...p, amountCents: Number(p.amountCents) }]));
  const refunds = new Map();
  const pool = options.pool || options.db;

  async function postgresRefund(id, account, amountCents, key) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const payment = await client.query('SELECT id, amount_cents FROM payments WHERE id = $1 AND owner = $2 FOR UPDATE', [id, account]);
      if (!payment.rowCount) { await client.query('ROLLBACK'); return null; }
      const existing = await client.query('SELECT id, amount_cents FROM refunds WHERE payment_id = $1 AND owner = $2 AND idempotency_key = $3', [id, account, key]);
      if (existing.rowCount) { await client.query('COMMIT'); return { id: existing.rows[0].id, amountCents: existing.rows[0].amount_cents }; }
      const total = await client.query('SELECT COALESCE(SUM(amount_cents), 0) AS total FROM refunds WHERE payment_id = $1', [id]);
      if (Number(total.rows[0].total) + amountCents > payment.rows[0].amount_cents) { await client.query('ROLLBACK'); return { error: 'exceeds' }; }
      const inserted = await client.query('INSERT INTO refunds (payment_id, owner, amount_cents, idempotency_key) VALUES ($1, $2, $3, $4) RETURNING id, amount_cents', [id, account, amountCents, key]);
      await client.query('COMMIT');
      return { id: inserted.rows[0].id, amountCents: inserted.rows[0].amount_cents };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  return http.createServer(async (req, res) => {
    const match = req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (req.method !== 'POST' || !match) return reply(res, 404, { code: 'not_found', message: 'Not found' });
    const account = accountFrom(req);
    const key = req.headers['idempotency-key'];
    if (!account) return reply(res, 401, { code: 'unauthorized', message: 'Bearer authentication required' });
    if (typeof key !== 'string' || !key.trim()) return reply(res, 400, { code: 'invalid_idempotency_key', message: 'Idempotency-Key is required' });
    let input;
    try { input = await body(req); } catch { return reply(res, 400, { code: 'invalid_json', message: 'Request body must be JSON' }); }
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return reply(res, 400, { code: 'invalid_amount', message: 'amountCents must be a positive integer' });
    const id = decodeURIComponent(match[1]);
    try {
      // The transaction and unique idempotency key make double-submit retries safe.
      let result;
      if (pool) result = await postgresRefund(id, account, input.amountCents, key.trim());
      else {
        const payment = payments.get(id);
        if (!payment || payment.owner !== account) return reply(res, 404, { code: 'not_found', message: 'Not found' });
        const refundKey = `${id}\0${account}\0${key.trim()}`;
        result = refunds.get(refundKey);
        if (!result) {
          const total = [...refunds.values()].filter((r) => r.paymentId === id).reduce((sum, r) => sum + r.amountCents, 0);
          if (total + input.amountCents > payment.amountCents) return reply(res, 409, { code: 'refund_exceeds_payment', message: 'Refund exceeds unrefunded amount' });
          result = { id: `${id}-${refunds.size + 1}`, paymentId: id, amountCents: input.amountCents };
          refunds.set(refundKey, result);
        }
      }
      if (result === null) return reply(res, 404, { code: 'not_found', message: 'Not found' });
      if (result.error === 'exceeds') return reply(res, 409, { code: 'refund_exceeds_payment', message: 'Refund exceeds unrefunded amount' });
      return reply(res, 201, result);
    } catch { return reply(res, 500, { code: 'internal_error', message: 'Internal server error' }); }
  });
}
