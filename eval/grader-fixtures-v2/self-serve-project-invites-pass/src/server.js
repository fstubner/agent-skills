import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const page = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/index.html'), 'utf8');

export function createServer() {
  const invites = new Map();
  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(page);
      return;
    }
    const account = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!account) return json(res, 401, { code: 'unauthorized', message: 'Authentication required' });
    if (req.method !== 'POST' || req.url !== '/invites') return json(res, 404, { code: 'not_found', message: 'Not found' });
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !key) return json(res, 400, { code: 'key_required', message: 'Idempotency-Key required' });
    const scopedKey = `${account}:${key}`;
    if (invites.has(scopedKey)) return json(res, 200, invites.get(scopedKey));
    let body = '';
    for await (const chunk of req) body += chunk;
    let value;
    try { value = JSON.parse(body); } catch { return json(res, 400, { code: 'invalid_json', message: 'Invalid JSON' }); }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email) || !['viewer', 'editor'].includes(value.role)) {
      return json(res, 422, { code: 'invalid_invite', message: 'Valid email and role required' });
    }
    const id = crypto.randomUUID();
    const invite = { id, email: value.email, role: value.role, inviter: account, link: `https://example.test/invites/${id}` };
    invites.set(scopedKey, invite);
    return json(res, 201, invite);
  });
}

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(value));
}
