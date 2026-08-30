import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';

const invites = new Map();
const projects = new Map([
  ['demo', new Map([['admin@example.com', 'admin']])],
]);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function error(res, status, code, message) { json(res, status, { code, message }); }

function accountFrom(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ') || header.slice(7).trim() === '') return null;
  return header.slice(7).trim();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 16_384) reject(new Error('too_large')); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('invalid_json')); } });
    req.on('error', reject);
  });
}

function isAdmin(projectId, account) { return projects.get(projectId)?.get(account) === 'admin'; }

export function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Invite people</title><link rel="stylesheet" href="/styles.css"></head><body><main><h1>Invite people to your project</h1><p class="intro">Create a link for someone you trust. They can use it to join as a viewer or editor.</p><form id="invite-form"><label for="project">Project ID</label><input id="project" name="project" value="demo" required><label for="account">Your account name</label><input id="account" name="account" placeholder="admin@example.com" required><label for="email">Invitee email</label><input id="email" name="email" type="email" autocomplete="email" required><label for="role">Access level</label><select id="role" name="role"><option value="viewer">Viewer — can view</option><option value="editor">Editor — can edit</option></select><button type="submit">Create invite link</button><p id="status" role="status" aria-live="polite"></p></form></main><script src="/app.js"></script></body></html>'); return;
    }
    if (req.method === 'GET' && req.url === '/styles.css') {
      res.setHeader('content-type', 'text/css; charset=utf-8'); res.end('body{font:16px system-ui,sans-serif;background:#f6f7fb;color:#172033;margin:0}main{max-width:36rem;margin:4rem auto;padding:2rem;background:white;border:1px solid #d8deea;border-radius:12px;box-shadow:0 8px 24px #17203312}h1{margin-top:0}label{display:block;font-weight:650;margin-top:1rem}input,select,button{box-sizing:border-box;width:100%;padding:.7rem;margin-top:.35rem;border:1px solid #8793aa;border-radius:6px;font:inherit}button{margin-top:1.5rem;background:#2457d6;color:white;border:0;font-weight:700;cursor:pointer}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #a7c7ff;outline-offset:2px}.intro{color:#4d5a70}.success{color:#146b3a}.failure{color:#a12b2b}.link{overflow-wrap:anywhere}'); return;
    }
    if (req.method === 'GET' && req.url === '/app.js') {
      res.setHeader('content-type', 'text/javascript; charset=utf-8'); res.end(`const form=document.querySelector('#invite-form');const status=document.querySelector('#status');form.addEventListener('submit',async e=>{e.preventDefault();status.className='';status.textContent='Creating invite link…';const data=Object.fromEntries(new FormData(form));try{const r=await fetch('/api/projects/'+encodeURIComponent(data.project)+'/invites',{method:'POST',headers:{'Authorization':'Bearer '+data.account,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({email:data.email,role:data.role})});const b=await r.json();if(!r.ok)throw new Error(b.message);status.className='success';status.innerHTML='Invite created: <a class="link" href="'+b.inviteUrl+'">'+b.inviteUrl+'</a>'}catch(err){status.className='failure';status.textContent=err.message}});`); return;
    }
    const match = req.url?.match(/^\/api\/projects\/([^/]+)\/invites$/);
    if (req.method !== 'POST' || !match) return error(res, 404, 'not_found', 'Resource not found.');
    const account = accountFrom(req);
    if (!account) return error(res, 401, 'unauthorized', 'A Bearer account name is required.');
    const projectId = decodeURIComponent(match[1]);
    if (!isAdmin(projectId, account)) return error(res, 403, 'forbidden', 'Only a project admin can create invites.');
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length < 1 || key.length > 200) return error(res, 400, 'invalid_idempotency_key', 'A valid Idempotency-Key is required.');
    if (invites.has(`${account}\0${projectId}\0${key}`)) return json(res, 201, invites.get(`${account}\0${projectId}\0${key}`));
    let body; try { body = await readBody(req); } catch (e) { return error(res, e.message === 'too_large' ? 413 : 400, e.message === 'too_large' ? 'body_too_large' : 'invalid_json', 'Request body must be valid JSON under 16 KB.'); }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = body.role;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error(res, 400, 'invalid_email', 'Enter a valid email address.');
    if (role !== 'viewer' && role !== 'editor') return error(res, 400, 'invalid_role', 'Role must be viewer or editor.');
    // Idempotency makes browser double-submit and network retries return this original invite.
    const result = { inviteId: randomUUID(), projectId, email, role, inviteUrl: `/invite/${randomBytes(24).toString('base64url')}` };
    invites.set(`${account}\0${projectId}\0${key}`, result);
    return json(res, 201, result);
  });
}
