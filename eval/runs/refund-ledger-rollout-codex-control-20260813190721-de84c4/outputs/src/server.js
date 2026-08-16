import http from 'node:http';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

export function createServer(options = {}) {
  // The array/object form is deliberately retained for callers that construct
  // the service with seed payments. Production adapters can provide the same
  // records through their repository before starting the server.
  const supplied = options.payments ?? [];
  const payments = new Map((Array.isArray(supplied) ? supplied : [supplied]).filter(Boolean)
    .map((p) => [String(p.id), { id: String(p.id), owner: String(p.owner), amountCents: p.amountCents }]));
  const refunds = new Map(); // account/id/key -> original result
  const refunded = new Map();

  return http.createServer(async (req, res) => {
    const match = req.method === 'POST' && req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (!match) return json(res, 404, { code: 'not_found' });

    const auth = /^Bearer\s+([^\s]+)$/i.exec(req.headers.authorization ?? '');
    const key = req.headers['idempotency-key'];
    if (!auth || typeof key !== 'string' || key.length === 0) {
      return json(res, 401, { code: 'unauthorized' });
    }
    const account = auth[1];
    let body = '';
    for await (const chunk of req) body += chunk;
    let input;
    try { input = JSON.parse(body); } catch { return json(res, 400, { code: 'invalid_json' }); }
    if (!Number.isSafeInteger(input?.amountCents) || input.amountCents <= 0) {
      return json(res, 400, { code: 'invalid_amountCents' });
    }

    const payment = payments.get(decodeURIComponent(match[1]));
    // Deliberately use the same response for missing payments and foreign owners.
    if (!payment || payment.owner !== account) return json(res, 404, { code: 'not_found' });
    const identity = `${account}\0${payment.id}\0${key}`;
    if (refunds.has(identity)) return json(res, 201, refunds.get(identity));
    const already = refunded.get(payment.id) ?? 0;
    if (already + input.amountCents > payment.amountCents) {
      return json(res, 409, { code: 'refund_exceeds_payment' });
    }
    const result = { paymentId: payment.id, amountCents: input.amountCents };
    // In a PostgreSQL adapter these two writes must be one transaction with a
    // unique (account, payment, idempotency_key) constraint.
    refunds.set(identity, result);
    refunded.set(payment.id, already + input.amountCents);
    return json(res, 201, result);
  });
}
