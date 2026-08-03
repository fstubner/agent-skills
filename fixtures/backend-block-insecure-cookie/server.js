const http = require('http');

// Identical to backend-ship except the session cookie: HttpOnly only, no
// Secure and no SameSite. This is the whole delta, so a BLOCK here can only
// come from B-session-cookie.
function login(res, sid) {
  res.cookie('session_token', sid, { httpOnly: true });
}

http.createServer((req, res) => { res.end('ok'); }).listen(4180);
module.exports = { login };
