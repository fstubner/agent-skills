import http from 'node:http';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function paymentList(value) {
  if (Array.isArray(value)) return value;
  if (value instanceof Map) return [...value.values()];
  return value ? [value] : [];
}

export function createServer(options = {}) {
  const payments = paymentList(options.payments);
  const refunds = new Map();
  const refunded = new Map();

  return http.createServer(async (req, res) => {
    const match = req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (req.method !== 'POST' || !match) return json(res, 404, { code: 'not_found' });

    const account = /^Bearer\s+([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
    const key = req.headers['idempotency-key'];
    if (!account || typeof key !== 'string' || key.length === 0) {
      return json(res, 400, { code: 'invalid_request' });
    }

    let body;
    try {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      body = JSON.parse(raw);
    } catch {
      return json(res, 400, { code: 'invalid_request' });
    }
    if (!Number.isSafeInteger(body?.amountCents) || body.amountCents <= 0) {
      return json(res, 400, { code: 'invalid_amount' });
    }

    const id = decodeURIComponent(match[1]);
    const payment = payments.find((candidate) => candidate.id === id && candidate.owner === account);
    if (!payment) return json(res, 404, { code: 'not_found' });

    const idem = `${id}\0${account}\0${key}`;
    const prior = refunds.get(idem);
    if (prior) return json(res, 200, prior);

    const total = refunded.get(id) || 0;
    if (total + body.amountCents > payment.amountCents) {
      return json(res, 409, { code: 'refund_exceeds_payment' });
    }
    const refund = { paymentId: id, amountCents: body.amountCents, idempotencyKey: key };
    refunds.set(idem, refund);
    refunded.set(id, total + body.amountCents);
    return json(res, 201, refund);
  });
}
