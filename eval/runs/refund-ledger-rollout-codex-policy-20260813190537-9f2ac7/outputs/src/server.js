import http from 'node:http';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function paymentMap(payments) {
  const values = Array.isArray(payments) ? payments : payments ? [payments] : [];
  return new Map(values.map((p) => [String(p.id), {
    id: String(p.id), owner: String(p.owner), amountCents: p.amountCents
  }]));
}

export function createServer(options = {}) {
  const payments = paymentMap(options.payments);
  const refunds = new Map();
  const totals = new Map();

  return http.createServer(async (req, res) => {
    const match = req.method === 'POST' && req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (!match) return json(res, 404, { code: 'not_found' });

    const paymentId = decodeURIComponent(match[1]);
    const auth = req.headers.authorization || '';
    const account = auth.match(/^Bearer\s+([^\s]+)$/i)?.[1];
    const key = req.headers['idempotency-key'];
    if (!account) return json(res, 401, { code: 'unauthenticated' });
    if (typeof key !== 'string' || key.length === 0) return json(res, 400, { code: 'missing_idempotency_key' });

    let body = '';
    for await (const chunk of req) body += chunk;
    let input;
    try { input = JSON.parse(body); } catch { return json(res, 400, { code: 'invalid_json' }); }
    if (!Number.isInteger(input?.amountCents) || input.amountCents <= 0) {
      return json(res, 400, { code: 'invalid_amountCents' });
    }

    const payment = payments.get(paymentId);
    // Deliberately use the same response for missing and unauthorized payments.
    if (!payment || payment.owner !== account) return json(res, 404, { code: 'not_found' });
    const idempotency = `${account}\0${paymentId}\0${key}`;
    const prior = refunds.get(idempotency);
    if (prior) {
      if (prior.amountCents !== input.amountCents) return json(res, 409, { code: 'idempotency_conflict' });
      return json(res, 200, prior);
    }

    const refunded = totals.get(paymentId) || 0;
    if (!Number.isInteger(payment.amountCents) || input.amountCents > payment.amountCents - refunded) {
      return json(res, 409, { code: 'refund_exceeds_payment' });
    }
    const refund = { id: `${paymentId}-${key}`, paymentId, amountCents: input.amountCents };
    refunds.set(idempotency, refund);
    totals.set(paymentId, refunded + input.amountCents);
    return json(res, 201, refund);
  });
}
