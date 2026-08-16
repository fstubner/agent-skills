import http from 'node:http';

export function createServer() {
  const orders = new Map();
  return http.createServer(async (req, res) => {
    res.statusCode = 501;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'TODO' }));
  });
}
