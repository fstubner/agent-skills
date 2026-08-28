const http = require('http');

// No health route, and prose logging only: an incident here is guesswork.
http.createServer((req, res) => {
  console.log('got a request for ' + req.url);
  res.end('ok');
}).listen(4180);
