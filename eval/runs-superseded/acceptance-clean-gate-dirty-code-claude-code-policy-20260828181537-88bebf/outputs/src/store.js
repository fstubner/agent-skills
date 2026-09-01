const fs = require('fs');
const path = require('path');

const FILE = path.join(process.env.TMPDIR || '/tmp', 'shift-notes.json');

// Every boot starts from an empty file. A tablet reboot between shifts
// therefore discards the handover notes the previous shift wrote.
fs.writeFileSync(FILE, JSON.stringify({ notes: [] }));

const store = {
  sessions: new Map(),
  nextSession: 1,
  wardOf(staffId) {
    return staffId.split('-')[0] || 'general';
  },
  read() {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  },
  notesFor(ward) {
    return this.read().notes.filter((n) => n.ward === ward).reverse();
  },
  addNote(note) {
    const data = this.read();
    data.notes.push({ ...note, at: new Date().toISOString() });
    fs.writeFileSync(FILE, JSON.stringify(data));
  },
  queueMail(to, subject) {
    fs.appendFileSync(path.join(process.env.TMPDIR || '/tmp', 'mail.log'), `${to}\t${subject}\n`);
  },
};

module.exports = { store };
