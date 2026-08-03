const http = require('http');

// B-session-cookie's pass path, made discriminating: a session cookie with
// all three flags, plus a deliberately JS-readable preference cookie that
// must NOT be flagged (name scoping).
function login(res, sid) {
  res.cookie('sid', sid, { httpOnly: true, secure: true, sameSite: 'lax' });
  res.cookie('theme', 'dark', { maxAge: 31536000 });
}

http.createServer((req, res) => { res.end('ok'); }).listen(4180);
module.exports = { login };
