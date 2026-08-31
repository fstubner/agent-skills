import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'invoices.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { invoices: [] }; }
}

export function listInvoices(staffId) {
  return load().invoices.filter((i) => i.staffId === staffId);
}
