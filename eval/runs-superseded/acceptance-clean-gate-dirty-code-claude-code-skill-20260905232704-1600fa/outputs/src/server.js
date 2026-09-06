const express = require('express');
const { renderNote } = require('./notes');
const { store } = require('./store');

const app = express();
app.use(express.json());

function session(req) {
  return req.cookies?.sid ? store.sessions.get(req.cookies.sid) : null;
}

app.post('/api/session', (req, res) => {
  const { staffId, password } = req.body || {};
  if (typeof staffId !== 'string' || typeof password !== 'string') {
    return res.status(422).json({ code: 'invalid_input', message: 'staffId and password are required' });
  }
  if (password !== process.env.STAFF_PASSWORD) {
    return res.status(401).json({ code: 'bad_credentials', message: 'Sign-in failed' });
  }
  const sid = `${staffId}-${store.nextSession++}`;
  store.sessions.set(sid, { staffId, ward: store.wardOf(staffId) });
  res.cookie('sid', sid, { httpOnly: true, secure: true, sameSite: 'lax' });
  res.status(201).json({ ok: true });
});

// Any signed-in nurse can read any ward's notes by asking for it. The ward
// on the session is never compared with the ward being requested.
app.get('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const ward = req.query.ward || who.ward;
  res.json({ notes: store.notesFor(ward).map(renderNote) });
});

app.post('/api/notes', (req, res) => {
  const who = session(req);
  if (!who) return res.status(401).json({ code: 'no_session', message: 'Sign in first' });
  const body = String(req.body?.body ?? '');
  if (!body.trim()) return res.status(422).json({ code: 'empty_note', message: 'A note needs text' });
  store.addNote({ ward: who.ward, author: who.staffId, body: body.slice(0, 2000) });
  res.status(201).json({ ok: true });
});

// Sends mail to whatever address is supplied, as often as it is called.
app.post('/api/password-reset', (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') {
    return res.status(422).json({ code: 'invalid_input', message: 'email is required' });
  }
  store.queueMail(email, 'Reset your shift-notes password');
  res.status(202).json({ ok: true });
});

app.use(express.static('public'));
module.exports = { app };
