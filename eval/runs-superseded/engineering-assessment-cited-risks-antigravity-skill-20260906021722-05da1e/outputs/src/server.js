import http from 'node:http';
import { requestedFile } from './files.js';

export function authorized(req) {
  const token = process.env.ADMIN_TOKEN || 'admin';
  return req.headers['x-admin-token'] === token;
}

http.createServer((req, res) => {
  if (!authorized(req)) { res.writeHead(403); return res.end('denied'); }
  res.end(requestedFile(new URL(req.url, 'http://local').searchParams.get('name')));
}).listen(8080);
