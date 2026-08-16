import http from 'node:http';

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};

const error = (res, status, code, message) => json(res, status, { code, message });

function memoryStore(options) {
  const source = options.payments;
  const payments = new Map();
  for (const payment of (Array.isArray(source) ? source : source ? [source] : [])) {
    payments.set(String(payment.id), { id: String(payment.id), owner: payment.owner, amountCents: payment.amountCents });
  }
  const refunds = new Map();
  return {
    async refund(id, account, key, amountCents) {
      const payment = payments.get(id);
      if (!payment || payment.owner !== account) return { kind: 'not_found' };
      const identity = `${id}\0${account}\0${key}`;
      const prior = refunds.get(identity);
      if (prior) return prior.amountCents === amountCents ? { kind: 'replay', refund: { id: prior.id, paymentId: prior.paymentId, amountCents: prior.amountCents } } : { kind: 'conflict' };
      let used = 0;
      for (const refund of refunds.values()) if (refund.paymentId === id) used += refund.amountCents;
      if (amountCents > payment.amountCents - used) return { kind: 'insufficient' };
      const refund = { id: `refund_${refunds.size + 1}`, paymentId: id, amountCents };
      refunds.set(identity, { ...refund, account, key });
      return { kind: 'created', refund };
    }
  };
}

function postgresStore(pool) {
  return {
    async refund(id, account, key, amountCents) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const payment = await client.query('SELECT id, amount_cents, owner FROM payments WHERE id = $1 FOR UPDATE', [id]);
        if (!payment.rowCount || payment.rows[0].owner !== account) {
          await client.query('ROLLBACK'); return { kind: 'not_found' };
        }
        const prior = await client.query('SELECT id, payment_id, amount_cents FROM refunds WHERE payment_id=$1 AND account=$2 AND idempotency_key=$3', [id, account, key]);
        if (prior.rowCount) {
          await client.query('COMMIT');
          return prior.rows[0].amount_cents === amountCents ? { kind: 'replay', refund: mapRefund(prior.rows[0]) } : { kind: 'conflict' };
        }
        const total = await client.query('SELECT COALESCE(sum(amount_cents),0)::int AS total FROM refunds WHERE payment_id=$1', [id]);
        if (amountCents > payment.rows[0].amount_cents - total.rows[0].total) {
          await client.query('ROLLBACK'); return { kind: 'insufficient' };
        }
        const inserted = await client.query('INSERT INTO refunds (payment_id, account, idempotency_key, amount_cents) VALUES ($1,$2,$3,$4) RETURNING id,payment_id,amount_cents', [id, account, key, amountCents]);
        await client.query('COMMIT');
        return { kind: 'created', refund: mapRefund(inserted.rows[0]) };
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    }
  };
}

function mapRefund(row) { return { id: String(row.id), paymentId: row.payment_id, amountCents: row.amount_cents }; }

export function createServer(options = {}) {
  const store = options.pool ? postgresStore(options.pool) : memoryStore(options);
  return http.createServer(async (req, res) => {
    const match = req.method === 'POST' && req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (!match) return error(res, 404, 'not_found', 'Not found');
    const authorization = req.headers.authorization || '';
    const account = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const key = req.headers['idempotency-key'];
    if (!account) return error(res, 401, 'unauthorized', 'Bearer account authentication required');
    if (typeof key !== 'string' || !key) return error(res, 400, 'invalid_request', 'Idempotency-Key is required');
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed;
    try { parsed = JSON.parse(body); } catch { return error(res, 400, 'invalid_request', 'Invalid JSON'); }
    if (!Number.isInteger(parsed.amountCents) || parsed.amountCents <= 0) return error(res, 400, 'invalid_request', 'amountCents must be a positive integer');
    try {
      const result = await store.refund(decodeURIComponent(match[1]), account, key, parsed.amountCents);
      if (result.kind === 'not_found') return error(res, 404, 'not_found', 'Payment not found');
      if (result.kind === 'conflict') return error(res, 409, 'idempotency_conflict', 'Idempotency key was already used');
      if (result.kind === 'insufficient') return error(res, 422, 'amount_exceeds_unrefunded', 'Refund exceeds unrefunded amount');
      json(res, result.kind === 'created' ? 201 : 200, result.refund);
    } catch { error(res, 500, 'internal_error', 'Internal server error'); }
  });
}
