import { ACCOUNT_STATES, materializeAccount } from '../models/account.js';

export function findAccount(records, id) {
  const row = records.find((account) => account.id === id);
  return row ? materializeAccount(row) : null;
}

export function suspendAccount(records, id) {
  const row = records.find((account) => account.id === id);
  if (!row) return null;

  row.state = ACCOUNT_STATES.suspended;
  return materializeAccount(row);
}
