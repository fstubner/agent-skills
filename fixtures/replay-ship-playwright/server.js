const http = require('http');
const log = (event, fields) => process.stdout.write(`${JSON.stringify({ event, ...fields })}\n`);
http.createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200); return res.end('{"ok":true}'); }
  log('request', { request_id: req.headers['x-request-id'], url: req.url });
  res.end('ok');
}).listen(4180);
