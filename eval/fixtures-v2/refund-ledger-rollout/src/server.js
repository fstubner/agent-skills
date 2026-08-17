import http from 'node:http';

export function createServer(_options = {}) {
  return http.createServer((_req, res) => {
    res.statusCode = 501;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ code: 'not_implemented', message: 'Not implemented' }));
  });
}
