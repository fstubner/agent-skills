import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createServer(options = {}) {
  const projectAdmins = options.projectAdmins ?? new Map([['demo', new Set(['admin'])]]);
  const invites = options.invites ?? new Map();
  const send = (res, status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') { res.statusCode = 200; res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(publicDir, 'index.html'))); return; }
      const match = req.url?.match(/^\/api\/projects\/([^/]+)\/invites$/);
      if (req.method !== 'POST' || !match) return send(res, 404, { code: 'not_found', message: 'Not found' });
      const account = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
      if (!account) return send(res, 401, { code: 'unauthorized', message: 'Bearer account authentication is required' });
      const projectId = decodeURIComponent(match[1]);
      if (!projectAdmins.get(projectId)?.has(account)) return send(res, 403, { code: 'forbidden', message: 'The authenticated account is not a project admin' });
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || !key || key.length > 200) return send(res, 400, { code: 'invalid_idempotency_key', message: 'Idempotency-Key is required' });
      let raw = ''; for await (const chunk of req) raw += chunk;
      if (raw.length > 16384) return send(res, 413, { code: 'payload_too_large', message: 'Request body is too large' });
      let input; try { input = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { code: 'invalid_json', message: 'Request body must be valid JSON' }); }
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (!emailPattern.test(email) || email.length > 254) return send(res, 400, { code: 'invalid_email', message: 'A valid email is required' });
      if (!['viewer', 'editor'].includes(input.role)) return send(res, 400, { code: 'invalid_role', message: 'Role must be viewer or editor' });
      const idempotencyId = `${projectId}\0${account}\0${key}`, prior = invites.get(idempotencyId);
      if (prior) { if (prior.email !== email || prior.role !== input.role) return send(res, 409, { code: 'idempotency_conflict', message: 'This Idempotency-Key was already used with different data' }); return send(res, 200, prior); }
      const invite = { id: crypto.randomUUID(), projectId, email, role: input.role, invitedBy: account, inviteUrl: `/invite/${crypto.randomBytes(24).toString('base64url')}`, createdAt: new Date().toISOString() };
      invites.set(idempotencyId, invite); return send(res, 201, invite);
    } catch { return send(res, 500, { code: 'internal_error', message: 'Internal server error' }); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) createServer().listen(process.env.PORT ?? 3000);
