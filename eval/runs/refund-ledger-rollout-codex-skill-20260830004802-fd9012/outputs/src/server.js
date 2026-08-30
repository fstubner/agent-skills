import http from 'node:http';
import { randomUUID } from 'node:crypto';

export function createServer(options = {}) {
  const configuredPayments = Array.isArray(options.payments) ? options.payments : (options.payments ? [options.payments] : []);
  const payments = new Map(configuredPayments.map((payment) => [String(payment.id), {
    id: String(payment.id), owner: String(payment.owner), amountCents: payment.amountCents,
  }]));
  const refunds = new Map();

  return http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    const match = req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (req.method !== 'POST' || !match) return respond(res, 404, 'not_found', 'Not found');

    const account = bearerAccount(req.headers.authorization);
    const key = req.headers['idempotency-key'];
    if (!account) return respond(res, 401, 'unauthenticated', 'Bearer account authentication required');
    if (typeof key !== 'string' || key.length === 0 || key.length > 255) {
      return respond(res, 400, 'invalid_idempotency_key', 'Idempotency-Key is required');
    }
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return respond(res, 400, 'invalid_json', 'Request body must be JSON'); }
    if (!Number.isInteger(body.amountCents) || body.amountCents <= 0) {
      return respond(res, 400, 'invalid_amount', 'amountCents must be a positive integer');
    }
    const payment = payments.get(match[1]);
    const idem = `${account}\0${match[1]}\0${key}`;
    if (refunds.has(idem)) return respond(res, 200, null, refunds.get(idem));
    // Production adapter must execute this check, insert, and sum under one transaction with a row lock.
    if (!payment || payment.owner !== account) return respond(res, 404, 'not_found', 'Payment not found');
    const refunded = [...refunds.values()].filter((r) => r.paymentId === payment.id).reduce((n, r) => n + r.amountCents, 0);
    if (body.amountCents > payment.amountCents - refunded) return respond(res, 409, 'refund_exceeds_balance', 'Refund exceeds the unrefunded amount');
    const refund = { id: randomUUID(), paymentId: payment.id, amountCents: body.amountCents };
    refunds.set(idem, refund);
    return respond(res, 201, null, refund);
  });
}

function bearerAccount(header) {
  const match = typeof header === 'string' && header.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}
function readBody(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', (chunk) => { data += chunk; if (data.length > 1e6) req.destroy(); }); req.on('end', () => resolve(data)); req.on('error', reject); }); }
function respond(res, status, code, payload) { res.statusCode = status; res.end(JSON.stringify(code ? { code, message: payload } : payload)); }
