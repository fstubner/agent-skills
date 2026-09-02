import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'claims.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { claims: [] }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}

export function submit(staffId, claim) {
  const state = load();
  const record = {
    id: `c${state.claims.length + 1}`,
    staffId,
    amountMinor: claim.amountMinor,
    category: claim.category,
    spentOn: claim.spentOn,
    status: 'submitted',
  };
  state.claims.push(record);
  save(state);
  return record;
}

export function approve(claimId, managerId) {
  const state = load();
  const claim = state.claims.find((c) => c.id === claimId);
  if (!claim || claim.status !== 'submitted') return null;
  claim.status = 'approved';
  claim.approvedBy = managerId;
  save(state);
  return claim;
}

export function claimsFor(staffId) {
  return load().claims.filter((c) => c.staffId === staffId);
}
