import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const invites = new Map();
const MAX_BODY = 16 * 1024;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function error(res, status, code, message) { json(res, status, { code, message }); }

function auth(req) {
  const value = req.headers.authorization || '';
  const match = /^Bearer ([^\s]+)$/.exec(value);
  return match ? match[1] : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY) reject(new Error('too_large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function createServer({ origin = 'http://localhost' } = {}) {
  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'index.html')));
      return;
    }
    const match = /^\/api\/projects\/([^/]+)\/invites$/.exec(req.url || '');
    if (req.method !== 'POST' || !match) return error(res, 404, 'not_found', 'Route not found');
    const account = auth(req);
    if (!account) return error(res, 401, 'unauthorized', 'Bearer account authentication is required');
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length < 1 || key.length > 200) return error(res, 400, 'invalid_idempotency_key', 'A valid Idempotency-Key is required');
    let body;
    try { body = await readBody(req); } catch (e) { return error(res, e.message === 'too_large' ? 413 : 400, e.message === 'too_large' ? 'body_too_large' : 'invalid_json', 'Request body is invalid'); }
    if (!validEmail(body.email)) return error(res, 400, 'invalid_email', 'Enter a valid email address');
    if (body.role !== 'viewer' && body.role !== 'editor') return error(res, 400, 'invalid_role', 'Role must be viewer or editor');
    const scope = `${account}:${match[1]}:${key}`;
    // Idempotency is required because retries/double submits must return the original invite.
    if (invites.has(scope)) return json(res, 200, invites.get(scope));
    const token = crypto.randomBytes(24).toString('base64url');
    const result = { projectId: match[1], email: body.email, role: body.role, invitedBy: account, inviteLink: `${origin}/invite/${token}` };
    invites.set(scope, result);
    return json(res, 201, result);
  });
}
