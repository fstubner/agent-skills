import http from 'node:http';
import crypto from 'node:crypto';

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function paymentsFrom(options) {
  if (Array.isArray(options.payments)) return options.payments;
  if (options.payments && typeof options.payments === 'object') return Object.values(options.payments);
  return [];
}

export function createServer(options = {}) {
  const payments = new Map(paymentsFrom(options).map((payment) => [String(payment.id), {
    id: String(payment.id), owner: String(payment.owner), amountCents: payment.amountCents
  }]));
  const refunds = new Map();
  const refundedByPayment = new Map();

  return http.createServer(async (req, res) => {
    const match = req.method === 'POST' && req.url?.match(/^\/payments\/([^/]+)\/refunds(?:\?.*)?$/);
    if (!match) return reply(res, 404, { code: 'not_found', message: 'Not found' });

    const auth = req.headers.authorization;
    const bearer = auth?.match(/^Bearer (\S+)$/);
    const key = req.headers['idempotency-key'];
    if (!bearer) return reply(res, 401, { code: 'unauthorized', message: 'Bearer authentication required' });
    if (typeof key !== 'string' || key.length === 0) {
      return reply(res, 400, { code: 'invalid_request', message: 'Idempotency-Key is required' });
    }
    let data = '';
    for await (const chunk of req) data += chunk;
    let body;
    try { body = JSON.parse(data || '{}'); } catch { return reply(res, 400, { code: 'invalid_request', message: 'Invalid JSON' }); }
    if (!Number.isInteger(body.amountCents) || body.amountCents <= 0) {
      return reply(res, 400, { code: 'invalid_request', message: 'amountCents must be a positive integer' });
    }

    const account = bearer[1];
    const payment = payments.get(decodeURIComponent(match[1]));
    // Keep this indistinguishable for non-owners and missing payments.
    if (!payment || payment.owner !== account) return reply(res, 404, { code: 'not_found', message: 'Payment not found' });
    const idempotencyId = `${account}\0${payment.id}\0${key}`;
    const previous = refunds.get(idempotencyId);
    if (previous) {
      if (previous.amountCents !== body.amountCents) return reply(res, 409, { code: 'idempotency_conflict', message: 'Idempotency-Key was already used' });
      return reply(res, 201, previous);
    }
    const refunded = refundedByPayment.get(payment.id) ?? 0;
    if (body.amountCents > payment.amountCents - refunded) {
      return reply(res, 422, { code: 'refund_exceeds_payment', message: 'Refund exceeds the unrefunded amount' });
    }
    const refund = { id: crypto.randomUUID(), paymentId: payment.id, owner: account, amountCents: body.amountCents };
    refunds.set(idempotencyId, refund);
    refundedByPayment.set(payment.id, refunded + body.amountCents);
    return reply(res, 201, refund);
  });
}
