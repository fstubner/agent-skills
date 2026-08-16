import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const error = (res, status, code, message) => json(res, status, { code, message });

function bearer(req) {
  const value = req.headers.authorization;
  if (!value || !/^Bearer\s+[^\s]+$/i.test(value)) return null;
  return value.replace(/^Bearer\s+/i, '');
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new Error('body_too_large');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('invalid_json'); }
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function createServer({ projectAdmins = {}, baseUrl = 'http://localhost:3000' } = {}) {
  const invites = new Map();
  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      try { res.statusCode = 200; res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(await readFile(path.join(publicDir, 'index.html'))); } catch { error(res, 500, 'server_error', 'The page could not be loaded.'); }
      return;
    }
    if (req.method === 'POST' && /^\/api\/projects\/[^/]+\/invites$/.test(req.url)) {
      const account = bearer(req);
      if (!account) return error(res, 401, 'unauthorized', 'A Bearer account name is required.');
      const projectId = decodeURIComponent(req.url.split('/')[3]);
      const admins = projectAdmins[projectId] || ['admin'];
      if (!admins.includes(account)) return error(res, 403, 'forbidden', 'Only a project admin can create invites.');
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || key.length < 1 || key.length > 200) return error(res, 400, 'invalid_idempotency_key', 'Provide an Idempotency-Key header.');
      let input;
      try { input = await body(req); } catch (e) { return error(res, 400, e.message === 'body_too_large' ? 'payload_too_large' : 'invalid_json', 'The request body is invalid.'); }
      if (!validEmail(input.email)) return error(res, 400, 'invalid_email', 'Enter a valid email address.');
      if (!['viewer', 'editor'].includes(input.role)) return error(res, 400, 'invalid_role', 'Role must be viewer or editor.');
      const idempotency = `${account}:${projectId}:${key}`;
      const prior = invites.get(idempotency);
      if (prior) return json(res, 200, prior);
      const invite = { inviteId: randomUUID(), projectId, email: input.email.trim().toLowerCase(), role: input.role, invitedBy: account, inviteUrl: `${baseUrl}/invite/${randomUUID()}` };
      invites.set(idempotency, invite); // Retry safety: the same key returns this original invite.
      return json(res, 201, invite);
    }
    return error(res, 404, 'not_found', 'Route not found.');
  });
}
