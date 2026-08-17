import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const roles = new Set(['viewer', 'editor']);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function error(res, status, code, message) { json(res, status, { code, message }); }

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('too_large');
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('invalid_json'); }
}

export function createServer(options = {}) {
  const invites = new Map();
  const projectAdmins = options.projectAdmins ?? { demo: ['admin'] };
  const baseUrl = options.baseUrl;
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') {
        const html = await readFile(path.join(publicDir, 'index.html'));
        res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html); return;
      }
      const match = req.url?.match(/^\/api\/projects\/([^/]+)\/invites$/);
      if (req.method !== 'POST' || !match) { error(res, 404, 'not_found', 'Route not found'); return; }

      const projectId = decodeURIComponent(match[1]);
      const auth = req.headers.authorization;
      const inviter = auth?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
      if (!inviter) { error(res, 401, 'unauthenticated', 'Use a Bearer account name'); return; }
      const admins = projectAdmins[projectId] ?? [];
      if (!admins.includes(inviter)) { error(res, 403, 'forbidden', 'Only a project admin can invite members'); return; }
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || key.length < 1 || key.length > 200) { error(res, 400, 'missing_idempotency_key', 'Idempotency-Key is required'); return; }
      const replay = invites.get(`${inviter}\0${projectId}\0${key}`);
      if (replay) { json(res, 201, replay); return; }
      const input = await body(req);
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const role = input.role;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { error(res, 422, 'invalid_email', 'A valid email is required'); return; }
      if (!roles.has(role)) { error(res, 422, 'invalid_role', 'Role must be viewer or editor'); return; }
      const token = randomBytes(24).toString('base64url');
      const invite = { projectId, email, role, inviter, inviteUrl: `${baseUrl ?? `http://${req.headers.host ?? 'localhost'}`}/invite/${token}` };
      invites.set(`${inviter}\0${projectId}\0${key}`, invite);
      json(res, 201, invite);
    } catch (e) {
      if (e.message === 'invalid_json') error(res, 400, 'invalid_json', 'Request body must be valid JSON');
      else if (e.message === 'too_large') error(res, 413, 'payload_too_large', 'Request body is too large');
      else { res.statusCode = 500; res.end(); }
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) createServer().listen(process.env.PORT ?? 3000);
