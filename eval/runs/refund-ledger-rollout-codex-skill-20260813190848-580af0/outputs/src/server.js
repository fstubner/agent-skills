import http from 'node:http';

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function integer(value) {
  return Number.isInteger(value) && Number.isSafeInteger(value);
}

export function createServer(options = {}) {
  const payments = new Map();
  const configuredPayments = options.payments == null ? [] : Array.isArray(options.payments) ? options.payments : [options.payments];
  for (const payment of configuredPayments) {
    payments.set(String(payment.id), {
      id: String(payment.id),
      owner: String(payment.owner),
      amountCents: payment.amountCents,
    });
  }
  const refunds = [];

  return http.createServer(async (req, res) => {
    const match = req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (req.method !== 'POST' || !match) {
      return reply(res, 404, { code: 'not_found', message: 'Not found' });
    }

    const auth = req.headers.authorization;
    const account = auth?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!account) return reply(res, 401, { code: 'unauthorized', message: 'Bearer authentication required' });

    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length === 0 || key.length > 255) {
      return reply(res, 400, { code: 'invalid_idempotency_key', message: 'Idempotency-Key is required' });
    }

    let body;
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return reply(res, 400, { code: 'invalid_json', message: 'Request body must be valid JSON' });
    }
    if (!integer(body?.amountCents) || body.amountCents <= 0) {
      return reply(res, 400, { code: 'invalid_amount', message: 'amountCents must be a positive integer' });
    }

    const paymentId = decodeURIComponent(match[1]);
    const payment = payments.get(paymentId);
    // Ownership is checked before existence is disclosed to prevent account enumeration.
    if (!payment || payment.owner !== account) {
      return reply(res, 404, { code: 'payment_not_found', message: 'Payment not found' });
    }
    const prior = refunds.find((refund) => refund.paymentId === paymentId && refund.owner === account && refund.key === key);
    if (prior) return reply(res, 201, prior.response);

    const refunded = refunds.filter((refund) => refund.paymentId === paymentId)
      .reduce((sum, refund) => sum + refund.amountCents, 0);
    if (!integer(payment.amountCents) || body.amountCents > payment.amountCents - refunded) {
      return reply(res, 409, { code: 'refund_exceeds_balance', message: 'Refund exceeds the unrefunded amount' });
    }
    const response = { paymentId, amountCents: body.amountCents, idempotencyKey: key };
    refunds.push({ paymentId, owner: account, key, amountCents: body.amountCents, response });
    return reply(res, 201, response);
  });
}
