import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const publicDir = path.dirname(fileURLToPath(import.meta.url)).replace(/\/src$/, '/public');

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const error = (res, status, code, message) => json(res, status, { code, message });

export function createServer({ projectAdmins = {}, baseUrl = '' } = {}) {
  const invites = new Map();
  const idempotency = new Map();

  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') {
        const page = await readFile(path.join(publicDir, 'index.html'));
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.end(page);
      }

      const match = req.url?.match(/^\/api\/projects\/([^/]+)\/invites$/);
      if (req.method !== 'POST' || !match) return error(res, 404, 'not_found', 'Resource not found');

      const account = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1]?.trim();
      if (!account) return error(res, 401, 'unauthorized', 'Use an Authorization: Bearer <account> header');

      const projectId = decodeURIComponent(match[1]);
      const admins = projectAdmins[projectId];
      if (Array.isArray(admins) && !admins.includes(account)) {
        return error(res, 403, 'forbidden', 'The authenticated account is not a project admin');
      }
      if (admins === false || admins === null) return error(res, 403, 'forbidden', 'The project has no eligible admin');

      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || !key.trim()) return error(res, 400, 'missing_idempotency_key', 'Idempotency-Key is required');
      const raw = await readBody(req);
      let input;
      try { input = JSON.parse(raw); } catch { return error(res, 400, 'invalid_json', 'Request body must be JSON'); }
      const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
      const role = input.role;
      if (!/^\S+@\S+\.\S+$/.test(email)) return error(res, 400, 'invalid_email', 'Enter a valid email address');
      if (role !== 'viewer' && role !== 'editor') return error(res, 400, 'invalid_role', 'Role must be viewer or editor');

      const fingerprint = JSON.stringify({ projectId, account, email, role });
      const identity = `${account}\0${projectId}\0${key.trim()}`;
      const previous = idempotency.get(identity);
      if (previous) {
        if (previous.fingerprint !== fingerprint) return error(res, 409, 'idempotency_conflict', 'This Idempotency-Key was already used for another invite');
        return json(res, 201, previous.invite);
      }

      const token = randomBytes(24).toString('base64url');
      const invite = { projectId, email, role, invitedBy: account, inviteUrl: `${baseUrl}/invite/${token}` };
      invites.set(token, invite);
      idempotency.set(identity, { fingerprint, invite });
      return json(res, 201, invite);
    } catch (e) {
      return error(res, 500, 'internal_error', 'Unable to create invite');
    }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; if (body.length > 100_000) req.destroy(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
