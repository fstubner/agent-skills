import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const invitesByKey = new Map();
const invitesByToken = new Map();
const MAX_BODY_BYTES = 16 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function error(res, status, code, message) {
  sendJson(res, status, { code, message });
}

function accountFromAuthorization(req) {
  const value = req.headers.authorization;
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return null;
  const account = value.slice(7).trim();
  return /^[a-zA-Z0-9._-]{1,80}$/.test(account) ? account : null;
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('too large'), { code: 'body_too_large' });
    chunks.push(chunk);
  }
  if (!size) throw Object.assign(new Error('empty'), { code: 'invalid_json' });
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('invalid'), { code: 'invalid_json' }); }
}

function inviteResponse(invite) {
  return {
    id: invite.id,
    projectId: invite.projectId,
    email: invite.email,
    role: invite.role,
    inviter: invite.inviter,
    inviteUrl: invite.inviteUrl,
    createdAt: invite.createdAt,
  };
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') {
        const html = await readFile(path.join(publicDir, 'index.html'));
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.end(html);
      }
      if (req.method === 'GET' && req.url === '/health') return sendJson(res, 200, { ok: true });

      const match = req.url?.match(/^\/api\/projects\/([^/]+)\/invites$/);
      if (req.method !== 'POST' || !match) return error(res, 404, 'not_found', 'The requested resource was not found.');

      const inviter = accountFromAuthorization(req);
      if (!inviter) return error(res, 401, 'unauthorized', 'Use a Bearer account name to continue.');

      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(idempotencyKey)) {
        return error(res, 400, 'invalid_idempotency_key', 'A valid Idempotency-Key header is required.');
      }
      const projectId = decodeURIComponent(match[1]);
      const key = `${inviter}:${projectId}:${idempotencyKey}`;
      const previous = invitesByKey.get(key);
      if (previous) return sendJson(res, 201, inviteResponse(previous));

      let body;
      try { body = await readJson(req); }
      catch (err) { return error(res, 400, err.code || 'invalid_json', err.code === 'body_too_large' ? 'Request body is too large.' : 'Request body must be valid JSON.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return error(res, 400, 'invalid_body', 'Request body must be an object.');
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const role = body.role;
      if (!emailPattern.test(email) || email.length > 254) return error(res, 422, 'invalid_email', 'Enter a valid email address.');
      if (role !== 'viewer' && role !== 'editor') return error(res, 422, 'invalid_role', 'Role must be viewer or editor.');

      // Idempotency makes retries and double-submits return the original invite.
      const token = crypto.randomBytes(24).toString('base64url');
      const invite = { id: crypto.randomUUID(), projectId, email, role, inviter, inviteUrl: `/invite/${token}`, createdAt: new Date().toISOString() };
      invitesByKey.set(key, invite);
      invitesByToken.set(token, invite);
      return sendJson(res, 201, inviteResponse(invite));
    } catch (err) {
      console.error(err);
      return error(res, 500, 'internal_error', 'Something went wrong. Please try again.');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) createServer().listen(process.env.PORT || 3000);
