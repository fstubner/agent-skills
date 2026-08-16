#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootIndex = process.argv.indexOf('--root');
const root = rootIndex < 0 ? null : path.resolve(process.argv[rootIndex + 1] || '');
if (!root) process.exit(2);

const assertions = [];
const add = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const read = (relative) => fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : '';
const sectionEvidence = (text, limit = 500) => text.replace(/\s+/g, ' ').trim().slice(0, limit);
let server;

async function request(base, method, route, { auth, key, body } = {}) {
  const headers = { connection: 'close' };
  if (auth) headers.authorization = `Bearer ${auth}`;
  if (key) headers['idempotency-key'] = key;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { /* HTML and malformed JSON remain text */ }
  return { status: response.status, text, json, contentType: response.headers.get('content-type') || '' };
}

const product = read('PRODUCT.md');
add('product-contract',
  /admin/i.test(product) && /(invite|shareable link)/i.test(product) && /viewer/i.test(product) && /editor/i.test(product)
    && /(no email|without email|email delivery.{0,40}(excluded|non-goal|out of scope))/is.test(product)
    && /(success|acceptance|outcome)/i.test(product),
  sectionEvidence(product) || 'PRODUCT.md missing');

const architecture = read('ARCHITECTURE.md');
add('trust-boundary',
  /(browser|client)/i.test(architecture) && /(api|server)/i.test(architecture)
    && /(untrusted|distrust)/i.test(architecture) && /(bearer|authenticated)/i.test(architecture)
    && /(server.{0,80}(email|role|inviter)|(?:email|role|inviter).{0,80}server)/is.test(architecture)
    && /idempotenc/i.test(architecture),
  sectionEvidence(architecture) || 'ARCHITECTURE.md missing');

try {
  const modulePath = path.join(root, 'src', 'server.js');
  const module = await import(pathToFileURL(modulePath).href + `?v=${Date.now()}`);
  server = module.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  const base = `http://127.0.0.1:${server.address().port}`;

  const page = await request(base, 'GET', '/');
  const html = page.text;
  const labelledEmail = /<label[^>]*for=["'][^"']+["'][^>]*>[^<]*email/i.test(html)
    && /<input[^>]*(?:type=["']email["']|name=["']email["'])/i.test(html);
  const labelledRole = /<label[^>]*for=["'][^"']+["'][^>]*>[^<]*role/i.test(html)
    && /<select[^>]*name=["']role["']/i.test(html);
  const announced = /(aria-live=["'](?:polite|assertive)["']|role=["'](?:status|alert)["'])/i.test(html);
  add('accessible-interface', page.status === 200 && /text\/html/i.test(page.contentType) && labelledEmail && labelledRole && announced,
    `status=${page.status}, labelledEmail=${labelledEmail}, labelledRole=${labelledRole}, announced=${announced}`);

  const missingAuth = await request(base, 'POST', '/invites', { key: 'invite-a', body: { email: 'reader@example.test', role: 'viewer', inviter: 'mallory' } });
  const invalid = await request(base, 'POST', '/invites', { auth: 'alice', key: 'invite-b', body: { email: 'not-an-email', role: 'owner' } });
  const first = await request(base, 'POST', '/invites', { auth: 'alice', key: 'invite-c', body: { email: 'reader@example.test', role: 'viewer', inviter: 'mallory' } });
  const replay = await request(base, 'POST', '/invites', { auth: 'alice', key: 'invite-c', body: { email: 'changed@example.test', role: 'editor' } });
  const other = await request(base, 'POST', '/invites', { auth: 'bob', key: 'invite-c', body: { email: 'reader@example.test', role: 'viewer' } });
  const firstId = first.json?.id || first.json?.invite?.id;
  const replayId = replay.json?.id || replay.json?.invite?.id;
  const otherId = other.json?.id || other.json?.invite?.id;
  const inviter = first.json?.inviter || first.json?.invite?.inviter || first.json?.createdBy || first.json?.invite?.createdBy;

  add('server-authority', [401, 403].includes(missingAuth.status) && first.status >= 200 && first.status < 300 && inviter === 'alice',
    `missingAuth=${missingAuth.status}, create=${first.status}, inviter=${String(inviter)}`);
  add('boundary-validation', invalid.status >= 400 && invalid.status < 500
    && typeof invalid.json?.code === 'string' && typeof invalid.json?.message === 'string',
    `status=${invalid.status}, body=${invalid.text.slice(0, 250)}`);
  add('retry-and-isolation', Boolean(firstId) && firstId === replayId && other.status < 300 && Boolean(otherId) && otherId !== firstId,
    `first=${first.status}/${String(firstId)}, replay=${replay.status}/${String(replayId)}, other=${other.status}/${String(otherId)}`);
} catch (error) {
  for (const id of ['accessible-interface', 'server-authority', 'boundary-validation', 'retry-and-isolation']) {
    if (!assertions.some((assertion) => assertion.id === id)) add(id, false, String(error));
  }
} finally {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'self-serve-project-invites', assertions }, null, 2));
process.exitCode = assertions.some((assertion) => assertion.status === 'fail') ? 1 : 0;
