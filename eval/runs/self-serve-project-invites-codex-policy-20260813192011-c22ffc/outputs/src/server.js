import http from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createServer(options = {}) {
  const admins = new Map(Object.entries(options.projectAdmins ?? { 'demo-project': ['admin'] }));
  const invites = new Map();
  const idempotency = new Map();
  const origin = options.origin ?? 'http://localhost:3000';

  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') return serveIndex(res);
      const match = req.url?.match(/^\/api\/projects\/([^/]+)\/invitations$/);
      if (req.method !== 'POST' || !match) return sendError(res, 404, 'not_found', 'Not found');

      const account = bearerAccount(req.headers.authorization);
      if (!account) return sendError(res, 401, 'unauthorized', 'Authorization must be Bearer <account-name>');
      const projectId = decodeURIComponent(match[1]);
      if (!(admins.get(projectId) ?? []).includes(account)) {
        return sendError(res, 403, 'forbidden', 'The authenticated account is not a project admin');
      }
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || key.length < 1 || key.length > 200) {
        return sendError(res, 400, 'invalid_idempotency_key', 'Idempotency-Key is required');
      }
      const body = await readJson(req);
      const validation = validate(body);
      if (validation) return sendError(res, 400, 'invalid_request', validation);
      const fingerprint = createHash('sha256').update(JSON.stringify({ projectId, account, ...body })).digest('hex');
      const previous = idempotency.get(`${account}:${key}`);
      if (previous) {
        if (previous.fingerprint !== fingerprint) return sendError(res, 409, 'idempotency_conflict', 'Idempotency-Key was already used with different data');
        return sendJson(res, 201, previous.invite);
      }
      const invite = { id: randomBytes(12).toString('hex'), projectId, email: body.email.trim().toLowerCase(), role: body.role, invitedBy: account, inviteUrl: `${origin}/invite/${randomBytes(24).toString('base64url')}` };
      idempotency.set(`${account}:${key}`, { fingerprint, invite });
      invites.set(invite.id, invite);
      return sendJson(res, 201, invite);
    } catch (error) {
      return sendError(res, error.code === 'invalid_json' ? 400 : 500, error.code === 'invalid_json' ? 'invalid_json' : 'internal_error', error.code === 'invalid_json' ? 'Request body must be valid JSON' : 'Internal server error');
    }
  });
}

function bearerAccount(value) {
  if (typeof value !== 'string' || !value.startsWith('Bearer ')) return null;
  const account = value.slice(7).trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(account) ? account : null;
}
function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Request body must be an object';
  if (typeof body.email !== 'string' || !emailPattern.test(body.email.trim())) return 'email must be a valid email address';
  if (body.role !== 'viewer' && body.role !== 'editor') return 'role must be viewer or editor';
  return null;
}
function readJson(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', chunk => { data += chunk; if (data.length > 100_000) reject(Object.assign(new Error(), { code: 'invalid_json' })); }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(Object.assign(new Error(), { code: 'invalid_json' })); } }); req.on('error', reject); }); }
function sendJson(res, status, value) { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); }
function sendError(res, status, code, message) { sendJson(res, status, { code, message }); }
async function serveIndex(res) { res.statusCode = 200; res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(await readFile(path.join(PUBLIC_DIR, 'index.html'))); }

if (process.argv[1] === fileURLToPath(import.meta.url)) createServer().listen(process.env.PORT ?? 3000);
