import http from 'node:http';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function paymentMap(value) {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return new Map(entries.map((payment) => [String(payment.id), {
    id: String(payment.id), owner: String(payment.owner), amountCents: payment.amountCents
  }]));
}

export function createServer(options = {}) {
  const payments = paymentMap(options.payments);
  const refunds = new Map();

  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') return json(res, 200, { status: 'ok' });
    const match = req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (req.method !== 'POST' || !match) return json(res, 404, { code: 'not_found', message: 'Not found' });

    const account = /^Bearer\s+([^\s]+)$/i.exec(req.headers.authorization || '')?.[1];
    const key = req.headers['idempotency-key'];
    if (!account) return json(res, 401, { code: 'unauthenticated', message: 'Bearer authentication required' });
    if (typeof key !== 'string' || key.length === 0 || key.length > 255) {
      return json(res, 400, { code: 'invalid_idempotency_key', message: 'Idempotency-Key is required' });
    }

    // Authorization is checked against the owned payment before any existence detail is returned.
    let paymentId;
    try { paymentId = decodeURIComponent(match[1]); } catch {
      return json(res, 404, { code: 'not_found', message: 'Payment not found' });
    }
    const payment = payments.get(paymentId);
    if (!payment || payment.owner !== account) {
      return json(res, 404, { code: 'not_found', message: 'Payment not found' });
    }
    const idempotencyKey = `${payment.id}:${account}:${key}`;
    if (refunds.has(idempotencyKey)) return json(res, 201, refunds.get(idempotencyKey));

    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 10000) req.destroy(); });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { return json(res, 400, { code: 'invalid_json', message: 'Request body must be JSON' }); }
      const amount = body?.amountCents;
      if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0) {
        return json(res, 400, { code: 'invalid_amount', message: 'amountCents must be a positive integer' });
      }
      const refunded = [...refunds.values()].filter((refund) => refund.paymentId === payment.id)
        .reduce((total, refund) => total + refund.amountCents, 0);
      if (amount > payment.amountCents - refunded) {
        return json(res, 409, { code: 'refund_exceeds_balance', message: 'Refund exceeds the unrefunded amount' });
      }
      const refund = { paymentId: payment.id, amountCents: amount, idempotencyKey: key };
      refunds.set(idempotencyKey, refund);
      return json(res, 201, refund);
    });
  });
}
